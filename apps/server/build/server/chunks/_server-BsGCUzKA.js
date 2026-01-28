import { j as json } from './index-CoD1IJuy.js';
import { i as initDatabase, a as queryOne, q as query, e as execute } from './index-CHUN47T8.js';
import { b as private_env } from './shared-server-DaWdgxVh.js';
import 'fs/promises';
import 'url';
import 'path';
import 'sqlite3';

async function getBillById(billId) {
  const bill = await queryOne(`
		SELECT 
			b.*,
			pc.name as primaryCommitteeName,
			GROUP_CONCAT(
				json_object(
					'bioguideId', p.bioguideId,
					'firstName', p.firstName,
					'lastName', p.lastName,
					'fullName', p.fullName,
					'party', p.party,
					'state', p.state,
					'district', p.district
				), '|||'
			) as sponsorsData,
			GROUP_CONCAT(
				json_object(
					'committeeCode', c.committeeCode,
					'name', c.name,
					'chamber', c.chamber,
					'type', c.type
				), '|||'
			) as committeesData
		FROM bills b
		LEFT JOIN committees pc ON b.primaryCommitteeCode = pc.committeeCode
		LEFT JOIN bill_people bp ON b.id = bp.billId AND bp.relationship = 'sponsor'
		LEFT JOIN people p ON bp.personId = p.bioguideId
		LEFT JOIN bill_committees bc ON b.id = bc.billId
		LEFT JOIN committees c ON bc.committeeCode = c.committeeCode
		WHERE b.id = ?
		GROUP BY b.id
	`, [billId]);
  if (!bill) return null;
  const safeParse = (str, fallback = null) => {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.error(`Error parsing JSON for bill ${billId}:`, e);
      return fallback;
    }
  };
  return {
    ...bill,
    latestAction: safeParse(bill.latestAction),
    policyArea: safeParse(bill.policyArea),
    sponsors: bill.sponsorsData ? bill.sponsorsData.split("|||").map((s) => safeParse(s, {})).filter((s) => s.bioguideId) : [],
    committees: bill.committeesData ? bill.committeesData.split("|||").map((c) => safeParse(c, {})).filter((c) => c.committeeCode) : []
  };
}
async function getBillTextVersions(billId) {
  try {
    const tableCheck = await query(`
			SELECT name FROM sqlite_master 
			WHERE type='table' AND name='bill_text_versions'
		`);
    if (tableCheck.length === 0) {
      console.error("❌ bill_text_versions table does not exist!");
      return [];
    }
  } catch (err) {
    console.error("Error checking table existence:", err);
    return [];
  }
  const versions = await query(`
		SELECT 
			id,
			billId,
			type,
			date,
			formatType,
			url,
			content,
			contentFetched
		FROM bill_text_versions
		WHERE billId = ?
		ORDER BY date DESC
	`, [billId]);
  console.log(`getBillTextVersions for ${billId}: found ${versions?.length || 0} versions`);
  return versions || [];
}
async function getBillActions(billId) {
  const actions = await query(
    "SELECT * FROM bill_actions WHERE billId = ? ORDER BY actionDate DESC",
    [billId]
  );
  return actions || [];
}
async function fetchAndStoreTextVersions(billId, textVersionsUrl, apiKey) {
  const url = `${textVersionsUrl}&api_key=${apiKey}`;
  console.log(`
🔄 Fetching text versions for ${billId}`);
  console.log(`   URL: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch text versions: ${response.status}`);
    }
    const data = await response.json();
    const textVersions = data.textVersions || [];
    console.log(`📦 Found ${textVersions.length} text versions in API response`);
    if (textVersions.length === 0) {
      return [];
    }
    for (const version of textVersions) {
      if (!version.formats || !Array.isArray(version.formats)) {
        continue;
      }
      for (const format of version.formats) {
        try {
          await execute(`
						INSERT OR REPLACE INTO bill_text_versions 
						(billId, type, date, formatType, url, content, contentFetched)
						VALUES (?, ?, ?, ?, ?, NULL, 0)
					`, [
            billId,
            version.type || null,
            version.date || null,
            format.type || null,
            format.url || null
          ]);
          const formatType = format.type?.toUpperCase();
          if (formatType === "FORMATTED TEXT" || formatType?.includes("HTM")) {
            try {
              const contentResponse = await fetch(format.url);
              const content = await contentResponse.text();
              await execute(`
								UPDATE bill_text_versions 
								SET content = ?, contentFetched = 1
								WHERE billId = ? AND type = ? AND formatType = ?
							`, [
                content,
                billId,
                version.type || null,
                format.type || null
              ]);
              console.log(`  ✅ Content stored for ${version.type} (${format.type})`);
            } catch (contentErr) {
              console.error(`  ❌ Error downloading content:`, contentErr.message);
            }
          }
        } catch (err) {
          console.error(`  ❌ Error storing text version:`, err.message);
        }
      }
    }
    return await getBillTextVersions(billId);
  } catch (error) {
    console.error(`Error fetching text versions for ${billId}:`, error);
    return [];
  }
}
const CONGRESS_API_KEY = private_env.CONGRESS_API_KEY;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
async function GET({ params }) {
  try {
    await initDatabase();
    const billData = await getBillById(params.id);
    if (!billData) {
      return json({ error: "Bill not found" }, { status: 404, headers: corsHeaders });
    }
    let textVersions = await getBillTextVersions(params.id);
    if (textVersions.length === 0 && billData.textVersionsUrl && CONGRESS_API_KEY) {
      console.log(`📥 Fetching text versions for ${params.id} from Congress.gov`);
      try {
        textVersions = await fetchAndStoreTextVersions(
          params.id,
          billData.textVersionsUrl,
          CONGRESS_API_KEY
        );
        console.log(`✅ Fetched and stored ${textVersions.length} text versions`);
      } catch (err) {
        console.error("Error fetching text versions:", err);
      }
    }
    const actions = await getBillActions(params.id);
    const bill = {
      id: billData.id,
      number: formatBillNumber(billData.billNumber, billData.type),
      congress: billData.congress,
      title: billData.title,
      sponsor: formatSponsor(billData.sponsors),
      committee: billData.primaryCommitteeName || "Unassigned",
      updatedAt: billData.updateDate,
      latestAction: getLatestActionText(billData.latestAction),
      summary: billData.summaries || null,
      summaryLong: null,
      status: billData.status || null,
      statusTag: billData.status || billData.billType?.toUpperCase() || null,
      votes: [],
      schedule: [],
      news: []
    };
    return json({ bill, textVersions, actions }, { headers: corsHeaders });
  } catch (error) {
    console.error(`Error fetching bill ${params.id}:`, error);
    if (error.stack) console.error(error.stack);
    return json({ error: error.message, stack: error.stack }, { status: 500, headers: corsHeaders });
  }
}
function formatSponsor(sponsors) {
  if (!sponsors || sponsors.length === 0) return "Unknown";
  const sponsor = sponsors[0];
  return `${sponsor.firstName || ""} ${sponsor.lastName || ""}`.trim() || "Unknown";
}
function formatBillNumber(billNumber, billType) {
  if (!billNumber) return "";
  const typeMap = {
    "HR": "H.R.",
    "S": "S.",
    "HRES": "H.RES.",
    "SRES": "S.RES.",
    "HJRES": "H.J.RES.",
    "SJRES": "S.J.RES.",
    "HCONRES": "H.CON.RES.",
    "SCONRES": "S.CON.RES."
  };
  const prefix = typeMap[billType?.toUpperCase()] || billType || "";
  return `${prefix}${billNumber}`;
}
function getLatestActionText(latestAction) {
  if (!latestAction) return null;
  if (typeof latestAction === "string") return latestAction;
  return latestAction.text || latestAction.actionText || null;
}

export { GET, OPTIONS };
//# sourceMappingURL=_server-BsGCUzKA.js.map
