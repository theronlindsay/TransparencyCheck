import { json } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, getBillActions } from '$lib/db/bills.js';
import { importBillBySlugIfMissing } from '$lib/bill-fetcher.js';

export async function GET({ params }) {
	try {
		const rawId = params.id?.trim();
		if (!rawId) {
			return json({ error: 'Missing bill id' }, { status: 400 });
		}

		let billData = await getBillById(rawId);

		if (!billData) {
			const importedId = await importBillBySlugIfMissing(rawId);
			if (importedId) {
				billData = await getBillById(importedId);
			}
		}

		if (!billData) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		const billKey = billData._id;

		const textVersions = await getBillTextVersions(billKey);
		const actions = await getBillActions(billKey);

		// Format the bill data
		const bill = {
			...billData,
			id: billData._id,
			number: formatBillNumber(billData.billNumber, billData.type),
			congress: billData.congress,
			title: billData.title,
			sponsors: billData.sponsors,
			primaryCommitteeName: billData.primaryCommitteeName,
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

		return json({ bill, textVersions, actions });
	} catch (error) {
		console.error(`Error fetching bill ${params.id}:`, error);
		// Log the full stack trace
		if (error.stack) console.error(error.stack);
		return json({ error: error.message, stack: error.stack }, { status: 500 });
	}
}

// Helper function to format sponsors array into a string
function formatSponsor(sponsors) {
	if (!sponsors || sponsors.length === 0) return 'Unknown';
	const sponsor = sponsors[0];
	return `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim() || 'Unknown';
}

// Helper function to format bill number with type prefix
function formatBillNumber(billNumber, billType) {
	if (!billNumber) return '';

	const typeMap = {
		HR: 'HR',
		S: 'S',
		HRES: 'HRES',
		SRES: 'SRES',
		HJRES: 'HJRES',
		SJRES: 'SJRES',
		HCONRES: 'HCONRES',
		SCONRES: 'SCONRES'
	};

	const prefix = typeMap[billType?.toUpperCase()] || billType || '';
	return `${prefix}${billNumber}`;
}

// Helper function to extract text from latestAction object
function getLatestActionText(latestAction) {
	if (!latestAction) return null;
	if (typeof latestAction === 'string') return latestAction;
	return latestAction.text || latestAction.actionText || null;
}
