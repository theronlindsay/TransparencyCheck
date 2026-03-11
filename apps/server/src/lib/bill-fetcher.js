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
	const url = `${billUrl}?format=json&api_key=${CONGRESS_API_KEY}`;
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

// ─── Save ────────────────────────────────────────────────────────────────────

async function saveBillToDatabase(bill) {
	const billId = `${bill.type}${bill.number}`;
	console.log(`\n📝 Processing bill: ${billId}`);

	let detailedBill = bill;
	if (bill.url) {
		try {
			const details = await getBillDetails(bill.url);
			if (details) detailedBill = details;
		} catch (err) {
			console.error(`  ❌ Error fetching details for ${billId}:`, err.message);
		}
	} else {
		console.log(`  ⚠️  No URL for bill ${billId}, using summary data only`);
	}

	// Fetch primary committee name if available
	const committeesUrl = detailedBill.committees?.url || detailedBill.committeesUrl;
	if (committeesUrl && CONGRESS_API_KEY) {
		try {
			const commUrl = `${committeesUrl}&api_key=${CONGRESS_API_KEY}`;
			const commRes = await fetch(commUrl);
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

	return detailedBill;
}

export async function fetchAndStoreBills({ searchQuery, congress, dateFrom, dateTo, limit = 40 } = {}) {
	const bills = [];
	for await (const bill of fetchAndStoreBillsGenerator({ searchQuery, congress, dateFrom, dateTo, limit })) {
		bills.push(bill);
	}
	return bills;
}

export async function* fetchAndStoreBillsGenerator({ searchQuery, congress, dateFrom, dateTo, limit = 40 } = {}) {
	if (!CONGRESS_API_KEY) {
		console.error('❌ CONGRESS_API_KEY is not set in environment');
		throw new Error('CONGRESS_API_KEY is not defined');
	}
	console.log(`\n🚀 Starting bill fetch (congress: ${congress ?? 'all'}, limit: ${limit}${searchQuery ? `, query: "${searchQuery}"` : ''})`);

	try {
		const apiParams = new URLSearchParams({
			api_key: CONGRESS_API_KEY,
			format: 'json',
			limit: limit.toString()
		});

		if (searchQuery) apiParams.append('query', searchQuery);
		if (dateFrom) apiParams.append('fromDateTime', `${dateFrom}T00:00:00Z`);
		if (dateTo) apiParams.append('toDateTime', `${dateTo}T23:59:59Z`);

		// Use congress-specific endpoint if provided to avoid old bills surfacing via updateDate
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
				const detailedBill = await saveBillToDatabase(bill);
				yield detailedBill;
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
