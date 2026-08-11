import { saveBill } from '$lib/db/repository.js';

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;

// ─── Status detection ────────────────────────────────────────────────────────

function determineBillStatus(bill) {
	const latestActionText = bill.latestAction?.text?.toLowerCase() || '';

	if (
		latestActionText.includes('became public law') ||
		latestActionText.includes('became private law') ||
		latestActionText.includes('signed by president')
	)
		return 'Enacted';

	if (latestActionText.includes('vetoed') || latestActionText.includes('veto message'))
		return 'Vetoed';

	if (
		latestActionText.includes('failed') ||
		latestActionText.includes('rejected') ||
		latestActionText.includes('motion to proceed rejected')
	)
		return 'Failed';

	if (
		latestActionText.includes('passed senate') ||
		latestActionText.includes('received in the senate')
	)
		return 'Passed House';

	if (
		latestActionText.includes('passed house') ||
		latestActionText.includes('received in the house')
	)
		return 'Passed Senate';

	if (latestActionText.includes('referred to') || latestActionText.includes('committee on'))
		return 'In Committee';

	if (latestActionText.includes('introduced in') || bill.introducedDate) return 'Introduced';

	return 'Active';
}

// ─── Detail fetch ────────────────────────────────────────────────────────────

async function getBillDetails(billUrl) {
	if (!CONGRESS_API_KEY) throw new Error('CONGRESS_API_KEY is not defined');
	const urlObj = new URL(billUrl);
	urlObj.searchParams.set('format', 'json');
	urlObj.searchParams.set('api_key', CONGRESS_API_KEY);
	const url = urlObj.toString();
	console.log(`  🔍 Fetching bill details: ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		console.error(`  ❌ Failed to fetch bill details. Status: ${response.status}`);
		return null;
	}
	const data = await response.json();
	console.log(`  ✅ Got details for bill: ${data.bill?.type}${data.bill?.number}`);
	return data.bill;
}

/**
 * Persist a Congress.gov bill summary/detail.
 * @param {object} bill
 * @param {{ detailed?: boolean }} [options] - detailed=false skips per-bill detail/committee fetches (bulk-safe)
 */
async function saveBillToDatabase(bill, { detailed = true } = {}) {
	const billId = `${bill.type}${bill.number}`;
	console.log(`\n📝 Processing bill: ${billId}${detailed ? '' : ' (lightweight)'}`);

	let detailedBill = bill;
	if (detailed && bill.url) {
		try {
			const details = await getBillDetails(bill.url);
			if (details) detailedBill = details;
		} catch (err) {
			console.error(`  ❌ Error fetching details for ${billId}:`, err.message);
		}
	} else if (!bill.url) {
		console.log(`  ⚠️  No URL for bill ${billId}, using summary data only`);
	}

	const committeesUrl = detailedBill.committees?.url || detailedBill.committeesUrl;
	if (detailed && committeesUrl && CONGRESS_API_KEY) {
		try {
			const cUrlObj = new URL(committeesUrl);
			cUrlObj.searchParams.set('format', 'json');
			cUrlObj.searchParams.set('api_key', CONGRESS_API_KEY);
			const commRes = await fetch(cUrlObj.toString());
			if (commRes.ok) {
				const commData = await commRes.json();
				if (commData.committees && commData.committees.length > 0) {
					detailedBill.primaryCommitteeName = commData.committees[0].name;
				}
			}
		} catch (err) {
			console.error(`  ❌ Error fetching committees for ${billId}:`, err.message);
		}
	}

	const billStatus = determineBillStatus(detailedBill);
	console.log(`  📊 Status: ${billStatus}`);

	await saveBill(billId, billStatus, detailedBill);

	return {
		id: billId,
		type: detailedBill.type,
		number: detailedBill.number,
		congress: detailedBill.congress,
		title: detailedBill.title ?? null,
		introducedDate: detailedBill.introducedDate ?? null,
		latestAction: detailedBill.latestAction ?? null,
		originChamber: detailedBill.originChamber ?? null,
		originChamberCode: detailedBill.originChamberCode ?? null,
		updateDate: detailedBill.updateDate ?? null,
		url: detailedBill.url ?? null,
		policyArea: detailedBill.policyArea ?? null,
		sponsors: detailedBill.sponsors ?? null,
		primaryCommitteeName: detailedBill.primaryCommitteeName ?? null,
		status: billStatus
	};
}

/** Try recent Congresses when a user opens a bill we have not synced yet. */
const IMPORT_BILL_CONGRESSES = [119, 118, 117, 116];

/**
 * Fetch a single bill from Congress.gov v3 and persist it (same pipeline as bulk sync).
 * @param {string} rawSlug e.g. "HR123", "hr123", "s456"
 * @returns {Promise<string|null>} canonical Mongo _id (e.g. "HR123") or null
 */
export async function importBillBySlugIfMissing(rawSlug) {
	if (!CONGRESS_API_KEY) return null;
	const slug = String(rawSlug).trim();
	const m = slug.match(/^([A-Za-z]+)(\d+)$/);
	if (!m) return null;
	const billTypePath = m[1].toLowerCase();
	const billNumber = m[2];

	for (const congress of IMPORT_BILL_CONGRESSES) {
		const url = `https://api.congress.gov/v3/bill/${congress}/${billTypePath}/${billNumber}?format=json&api_key=${CONGRESS_API_KEY}`;
		const res = await fetch(url);
		if (!res.ok) continue;
		const data = await res.json();
		const b = data.bill;
		if (!b) continue;
		try {
			await saveBillToDatabase(b, { detailed: true });
			return `${b.type}${b.number}`;
		} catch (err) {
			console.error(`[importBillBySlug] save failed for ${slug}:`, err.message);
			return null;
		}
	}
	return null;
}

/**
 * Bulk fetch + store. Does not keep full bill documents in memory.
 * @returns {Promise<number>} number of bills processed
 */
export async function fetchAndStoreBills({
	searchQuery,
	congress,
	dateFrom,
	dateTo,
	limit = 20,
	detailed = false
} = {}) {
	let count = 0;
	for await (const _bill of fetchAndStoreBillsGenerator({
		searchQuery,
		congress,
		dateFrom,
		dateTo,
		limit,
		detailed
	})) {
		count += 1;
	}
	return count;
}

export async function* fetchAndStoreBillsGenerator({
	searchQuery,
	congress,
	dateFrom,
	dateTo,
	limit = 20,
	detailed = false
} = {}) {
	if (!CONGRESS_API_KEY) {
		console.error('❌ CONGRESS_API_KEY is not set in environment');
		throw new Error('CONGRESS_API_KEY is not defined');
	}
	console.log(
		`\n🚀 Starting bill fetch (congress: ${congress ?? 'all'}, limit: ${limit}, detailed: ${detailed}${searchQuery ? `, query: "${searchQuery}"` : ''})`
	);

	try {
		const apiParams = new URLSearchParams({
			api_key: CONGRESS_API_KEY,
			format: 'json',
			limit: String(Math.min(Math.max(limit, 1), 50))
		});

		if (searchQuery) apiParams.append('query', searchQuery);
		if (dateFrom) apiParams.append('fromDateTime', `${dateFrom}T00:00:00Z`);
		if (dateTo) apiParams.append('toDateTime', `${dateTo}T23:59:59Z`);

		const baseUrl = congress
			? `https://api.congress.gov/v3/bill/${congress}`
			: `https://api.congress.gov/v3/bill`;

		console.log(`   URL: ${baseUrl}?${apiParams.toString()}`);

		const response = await fetch(`${baseUrl}?${apiParams.toString()}`);
		if (!response.ok)
			throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);

		const data = await response.json();
		const bills = data.bills || [];

		console.log(`Found ${bills.length} bills from Congress.gov API.`);

		for (const bill of bills) {
			try {
				const saved = await saveBillToDatabase(bill, { detailed });
				yield saved;
			} catch (err) {
				console.error(`Error saving bill ${bill.type}${bill.number}:`, err);
			}
		}

		console.log(`Finished processing ${bills.length} bills.`);
	} catch (err) {
		console.error('Failed to fetch and store bills:', err);
		throw err;
	}
}
