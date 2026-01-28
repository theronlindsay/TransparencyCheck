import { j as json } from './index-CoD1IJuy.js';
import { i as initDatabase, f as fetchAndStoreBills } from './index-CHUN47T8.js';
import 'fs/promises';
import 'url';
import 'path';
import 'sqlite3';
import './shared-server-DaWdgxVh.js';

function determineBillStatus(bill) {
  const latestActionText = bill.latestAction?.text?.toLowerCase() || "";
  if (latestActionText.includes("became public law") || latestActionText.includes("became private law") || latestActionText.includes("signed by president")) {
    return "Enacted";
  }
  if (latestActionText.includes("vetoed") || latestActionText.includes("veto message")) {
    return "Vetoed";
  }
  if (latestActionText.includes("failed") || latestActionText.includes("rejected") || latestActionText.includes("motion to proceed rejected")) {
    return "Failed";
  }
  if (latestActionText.includes("passed senate") || latestActionText.includes("received in the senate")) {
    return "Passed House";
  }
  if (latestActionText.includes("passed house") || latestActionText.includes("received in the house")) {
    return "Passed Senate";
  }
  if (latestActionText.includes("referred to") || latestActionText.includes("committee on")) {
    return "In Committee";
  }
  if (latestActionText.includes("introduced in") || bill.introducedDate) {
    return "Introduced";
  }
  return "Active";
}
async function GET({ url }) {
  const searchQuery = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status");
  const chamber = url.searchParams.get("chamber");
  const sponsor = url.searchParams.get("sponsor");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const stream = url.searchParams.get("stream") === "true";
  try {
    await initDatabase();
    const bills = await fetchAndStoreBills({ searchQuery, dateFrom, dateTo });
    if (stream) {
      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let count = 0;
          console.log(`Starting stream for ${bills.length} bills`);
          for (const bill of bills) {
            try {
              const billStatus = determineBillStatus(bill);
              const formattedBill = {
                id: `${bill.type}${bill.number}`,
                billNumber: `${bill.type}.${bill.number}`,
                congress: bill.congress,
                type: bill.type,
                introducedDate: bill.introducedDate,
                latestAction: bill.latestAction?.text || "",
                status: billStatus,
                originChamber: bill.originChamber,
                originChamberCode: bill.originChamberCode,
                title: bill.title,
                updateDate: bill.updateDate,
                url: bill.url,
                policyArea: bill.policyArea?.name || "",
                sponsors: bill.sponsors?.map((s) => s.fullName).join(", ") || ""
              };
              let shouldInclude = true;
              if (chamber && chamber !== "all" && formattedBill.originChamber !== chamber) {
                shouldInclude = false;
              }
              if (sponsor && shouldInclude) {
                const sponsorLower = sponsor.toLowerCase();
                if (!formattedBill.sponsors.toLowerCase().includes(sponsorLower)) {
                  shouldInclude = false;
                }
              }
              if (status && status !== "all" && formattedBill.status !== status) {
                shouldInclude = false;
              }
              if (shouldInclude) {
                count++;
                const chunk = JSON.stringify(formattedBill) + "\n";
                controller.enqueue(encoder.encode(chunk));
                console.log(`Streamed bill ${count}: ${formattedBill.billNumber}`);
              }
            } catch (error) {
              console.error(`Error processing bill ${bill.type}${bill.number}:`, error);
            }
          }
          console.log(`Stream completed. Total bills streamed: ${count}`);
          controller.close();
        }
      });
      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }
    const formattedBills = bills.map((bill) => {
      const billStatus = determineBillStatus(bill);
      return {
        id: `${bill.type}${bill.number}`,
        billNumber: `${bill.type}.${bill.number}`,
        congress: bill.congress,
        type: bill.type,
        introducedDate: bill.introducedDate,
        latestAction: bill.latestAction?.text || "",
        status: billStatus,
        originChamber: bill.originChamber,
        originChamberCode: bill.originChamberCode,
        title: bill.title,
        updateDate: bill.updateDate,
        url: bill.url,
        policyArea: bill.policyArea?.name || "",
        sponsors: bill.sponsors?.map((s) => s.fullName).join(", ") || ""
      };
    });
    let filteredBills = formattedBills;
    if (chamber && chamber !== "all") {
      filteredBills = filteredBills.filter((bill) => bill.originChamber === chamber);
    }
    if (sponsor) {
      const sponsorLower = sponsor.toLowerCase();
      filteredBills = filteredBills.filter((bill) => {
        const sponsors = bill.sponsors || "";
        return sponsors.toLowerCase().includes(sponsorLower);
      });
    }
    if (status && status !== "all") {
      filteredBills = filteredBills.filter((bill) => bill.status === status);
    }
    return json({
      bills: filteredBills,
      count: filteredBills.length,
      source: "congress.gov"
    });
  } catch (error) {
    console.error("Search bills error:", error);
    return json(
      {
        bills: [],
        count: 0,
        error: error.message
      },
      { status: 500 }
    );
  }
}

export { GET };
//# sourceMappingURL=_server-aUTsoZQC.js.map
