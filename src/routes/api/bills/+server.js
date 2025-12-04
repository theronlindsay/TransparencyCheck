import { json } from '@sveltejs/kit';
import { initDatabase, query } from '$lib/db.js';

export async function GET() {
	try {
		await initDatabase();
		
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

		return json(bills);
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
