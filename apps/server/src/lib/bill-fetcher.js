import { env } from '$env/dynamic/private';
import { saveBill } from '$lib/db/repository.js';

const CONGRESS_API_KEY = env.CONGRESS_API_KEY;

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
	const response = await fetch(url);
	if (!response.ok) {
		console.error(`Failed to fetch bill details from ${url}. Status: ${response.status}`);
		return null;
	}
	const data = await response.json();
	return data.bill;
}

// ─── Save ────────────────────────────────────────────────────────────────────

async function saveBillToDatabase(bill) {
	const billId = `${bill.type}${bill.number}`;

	let detailedBill = bill;
	if (bill.url) {
		try {
			const details = await getBillDetails(bill.url);
			if (details) detailedBill = details;
		} catch (err) {
			console.error(`Error fetching details for ${bill.number}:`, err);
		}
	}

	const billStatus = determineBillStatus(detailedBill);

	// repository handles Mongo-first, SQLite-fallback automatically
	await saveBill(billId, billStatus, detailedBill);

	return billId;
}

export async function fetchAndStoreBills({ searchQuery, dateFrom, dateTo, limit = 40 } = {}) {
	if (!CONGRESS_API_KEY) throw new Error('CONGRESS_API_KEY is not defined');

	try {
		const apiParams = new URLSearchParams({
			api_key: CONGRESS_API_KEY,
			format: 'json',
			limit: limit.toString()
		});

		if (searchQuery) apiParams.append('query', searchQuery);
		if (dateFrom) apiParams.append('fromDateTime', `${dateFrom}T00:00:00Z`);
		if (dateTo) apiParams.append('toDateTime', `${dateTo}T23:59:59Z`);

		const response = await fetch(`https://api.congress.gov/v3/bill?${apiParams.toString()}`);
		if (!response.ok) 
			throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);

		const data = await response.json();
		const bills = data.bills || [];

		console.log(`Found ${bills.length} bills from Congress.gov API.`);

		for (const bill of bills) {
			try {
				await saveBillToDatabase(bill);
			} catch (err) {
				console.error(`Error saving bill ${bill.type}${bill.number}:`, err);
			}
		}

		console.log(`Finished processing ${bills.length} bills.`);
		return bills;
	} catch (err) {
		console.error('Failed to fetch and store bills:', err);
		throw err;
	}
}
