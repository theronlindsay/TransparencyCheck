/**
 * Bill-related database operations
 */

import { query, queryOne } from './queries.js';
import { getDatabase } from './connection.js';

/**
 * Get a bill by ID with its sponsors and committees
 */
export async function getBillById(billId) {
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

	// Parse JSON fields
	return {
		...bill,
		latestAction: bill.latestAction ? JSON.parse(bill.latestAction) : null,
		policyArea: bill.policyArea ? JSON.parse(bill.policyArea) : null,
		sponsors: bill.sponsorsData ? 
			bill.sponsorsData.split('|||').map(s => JSON.parse(s)).filter(s => s.bioguideId) : 
			[],
		committees: bill.committeesData ? 
			bill.committeesData.split('|||').map(c => JSON.parse(c)).filter(c => c.committeeCode) : 
			[]
	};
}

/**
 * Get text versions for a bill
 */
export async function getBillTextVersions(billId) {
	// First check if the table exists
	try {
		const tableCheck = await query(`
			SELECT name FROM sqlite_master 
			WHERE type='table' AND name='bill_text_versions'
		`);
		
		if (tableCheck.length === 0) {
			console.error('❌ bill_text_versions table does not exist!');
			return [];
		}
	} catch (err) {
		console.error('Error checking table existence:', err);
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

/**
 * Get all actions for a specific bill
 */
export async function getBillActions(billId) {
	const actions = await query(
		'SELECT * FROM bill_actions WHERE billId = ? ORDER BY actionDate DESC',
		[billId]
	);
	
	return actions || [];
}

/**
 * Insert or replace bill actions in batch
 */
export async function saveBillActions(billId, actions) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run('BEGIN TRANSACTION');
			
			// First, delete all existing actions for this bill to avoid duplicates
			db.run('DELETE FROM bill_actions WHERE billId = ?', [billId], (err) => {
				if (err) {
					db.run('ROLLBACK', () => {
						db.close();
						reject(err);
					});
					return;
				}
				
				// Now insert the new actions
				const stmt = db.prepare(`
					INSERT INTO bill_actions 
					(billId, actionDate, text, type, actionCode, sourceSystem)
					VALUES (?, ?, ?, ?, ?, ?)
				`);
				
				let errors = [];
				let inserted = 0;
				
				for (const action of actions) {
					stmt.run(
						billId,
						action.actionDate || null,
						action.text || null,
						action.type || null,
						action.actionCode || null,
						JSON.stringify(action.sourceSystem || null),
						function(err) {
							if (err) {
								errors.push(err);
							} else {
								inserted++;
							}
						}
					);
				}
				
				stmt.finalize((err) => {
					if (err) {
						errors.push(err);
					}
					
					if (errors.length > 0) {
						db.run('ROLLBACK', () => {
							db.close();
							reject(errors[0]);
						});
					} else {
						db.run('COMMIT', (err) => {
							db.close();
							if (err) {
								reject(err);
							} else {
								resolve({ inserted });
							}
						});
					}
				});
			});
		});
	});
}
