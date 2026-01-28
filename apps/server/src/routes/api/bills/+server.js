import { json } from '@sveltejs/kit';
import { initDatabase, query } from '$lib/db.js';
import { fetchAndStoreBills } from '$lib/bill-fetcher.js';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

// Flag to ensure background job only runs once
let backgroundJobStarted = false;

/**
 * Kick off background job to fetch recent bills (last 3 days)
 */
async function startBackgroundJob() {
	if (backgroundJobStarted) return;
	backgroundJobStarted = true;
	
	console.log('🔄 Starting background job to fetch recent bills...');
	try {
		const dateTo = new Date();
		const dateFrom = new Date();
		dateFrom.setDate(dateTo.getDate() - 3);

		const fromString = dateFrom.toISOString().split('T')[0];
		const toString = dateTo.toISOString().split('T')[0];

		await fetchAndStoreBills({ dateFrom: fromString, dateTo: toString });
		console.log('✅ Background job: Finished fetching recent bills.');
	} catch (error) {
		console.error('❌ Background job: Error fetching recent bills:', error);
	}
}

export async function OPTIONS() {
	return new Response(null, { headers: corsHeaders });
}

export async function GET() {
	try {
		await initDatabase();
		
		// Start background job on first request (non-blocking)
		if (!backgroundJobStarted) {
			startBackgroundJob().catch(err => {
				console.error('Background job failed:', err);
			});
		}
		
		const billsWithData = await query(`
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
			GROUP BY b.id
			ORDER BY b.updateDate DESC
			LIMIT 100
		`);

		// Parse the sponsors and committees JSON for each bill
		const bills = billsWithData.map(bill => ({
			...bill,
			latestAction: bill.latestAction ? JSON.parse(bill.latestAction) : null,
			policyArea: bill.policyArea ? JSON.parse(bill.policyArea) : null,
			sponsors: bill.sponsorsData ? 
				bill.sponsorsData.split('|||').map(s => JSON.parse(s)).filter(s => s.bioguideId) : 
				[],
			committees: bill.committeesData ? 
				bill.committeesData.split('|||').map(c => JSON.parse(c)).filter(c => c.committeeCode) : 
				[]
		}));

		return json(bills, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500, headers: corsHeaders });
	}
}
