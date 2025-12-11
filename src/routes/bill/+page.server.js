import { query } from '$lib/db.js';

// Load all bills with their sponsors and committees for the bills page
export async function load() {
	// Return a promise that will resolve later, allowing the page to render immediately
	const billsPromise = fetchBillsWithData();

	return {
		// This will stream to the client as it resolves
		bills: billsPromise
	};
}

// Separate function to fetch bills
async function fetchBillsWithData() {
	// Fetch all bills with related data
	const billsWithData = await query(`
		SELECT 
			b.*,
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
			) as committeesData,
			pc.name as primaryCommitteeName
		FROM bills b
		LEFT JOIN bill_people bp ON b.id = bp.billId AND bp.relationship = 'sponsor'
		LEFT JOIN people p ON bp.personId = p.bioguideId
		LEFT JOIN bill_committees bc ON b.id = bc.billId
		LEFT JOIN committees c ON bc.committeeCode = c.committeeCode
		LEFT JOIN committees pc ON b.primaryCommitteeCode = pc.committeeCode
		GROUP BY b.id
		ORDER BY b.updateDate DESC
	`);

	// Parse JSON fields for each bill
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
	
	return bills;
}
