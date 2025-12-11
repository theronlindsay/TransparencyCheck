import { json } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, getBillActions } from '$lib/db.js';

export async function GET({ params }) {
	try {
		const billData = await getBillById(params.id);

		if (!billData) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		// Get text versions and actions
		const textVersions = await getBillTextVersions(params.id);
		const actions = await getBillActions(params.id);

		// Format the bill data
		const bill = {
			id: billData.id,
			number: formatBillNumber(billData.billNumber, billData.type),
			congress: billData.congress,
			title: billData.title,
			sponsor: formatSponsor(billData.sponsors),
			committee: billData.primaryCommitteeName || 'Unassigned',
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
		console.error('Error fetching bill:', error);
		return json({ error: error.message }, { status: 500 });
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
		'HR': 'H.R.',
		'S': 'S.',
		'HRES': 'H.RES.',
		'SRES': 'S.RES.',
		'HJRES': 'H.J.RES.',
		'SJRES': 'S.J.RES.',
		'HCONRES': 'H.CON.RES.',
		'SCONRES': 'S.CON.RES.'
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
