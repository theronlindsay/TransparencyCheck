/**
 * Bill-related database operations
 */

import { query, queryOne, execute } from './queries.js';
import { getDatabase } from './connection.js';
import { fetchAndStoreBills } from '../bill-fetcher.js';

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

	// Helper for safe JSON parsing
	const safeParse = (str, fallback = null) => {
		if (!str) return fallback;
		try {
			return JSON.parse(str);
		} catch (e) {
			console.error(`Error parsing JSON for bill ${billId}:`, e);
			return fallback;
		}
	};

	// Parse JSON fields
	return {
		...bill,
		latestAction: safeParse(bill.latestAction),
		policyArea: safeParse(bill.policyArea),
		sponsors: bill.sponsorsData ? 
			bill.sponsorsData.split('|||')
				.map(s => safeParse(s, {}))
				.filter(s => s.bioguideId) : 
			[],
		committees: bill.committeesData ? 
			bill.committeesData.split('|||')
				.map(c => safeParse(c, {}))
				.filter(c => c.committeeCode) : 
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

/**
 * Get the most recently updated bills (limit 20)
 */
export async function getRecentBills(limit = 20) {
  return await query(
    `SELECT * FROM bills ORDER BY updateDateIncludingText DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Sync bills from Congress.gov API and fetch recent bills
 */
export async function syncAndFetchBills() {
  try {
    // Fetch recent bills from Congress.gov (limit to 20 for background sync)
    await fetchAndStoreBills({ limit: 20 });
    // Return the most recently updated bills from database
    return await getRecentBills(20);
  } catch (error) {
    console.error('Error syncing bills:', error);
    // If sync fails, still try to return existing bills
    return await getRecentBills(20);
  }
}

/**
 * Fetch text versions from Congress.gov API and store in database
 * @param {string} billId - The bill ID (e.g., "HR3062")
 * @param {string} textVersionsUrl - The API URL for text versions
 * @param {string} apiKey - Congress.gov API key
 * @returns {Promise<Array>} - Array of stored text versions
 */
export async function fetchAndStoreTextVersions(billId, textVersionsUrl, apiKey) {
	const url = `${textVersionsUrl}&api_key=${apiKey}`;
	console.log(`\n🔄 Fetching text versions for ${billId}`);
	console.log(`   URL: ${url}`);
	
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch text versions: ${response.status}`);
		}
		
		const data = await response.json();
		const textVersions = data.textVersions || [];
		
		console.log(`📦 Found ${textVersions.length} text versions in API response`);
		
		if (textVersions.length === 0) {
			return [];
		}
		
		// Store each text version with its formats
		for (const version of textVersions) {
			if (!version.formats || !Array.isArray(version.formats)) {
				continue;
			}
			
			for (const format of version.formats) {
				try {
					// Insert the metadata
					await execute(`
						INSERT OR REPLACE INTO bill_text_versions 
						(billId, type, date, formatType, url, content, contentFetched)
						VALUES (?, ?, ?, ?, ?, NULL, 0)
					`, [
						billId,
						version.type || null,
						version.date || null,
						format.type || null,
						format.url || null
					]);
					
					// Download content for HTML/Text formats
					const formatType = format.type?.toUpperCase();
					if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
						try {
							const contentResponse = await fetch(format.url);
							const content = await contentResponse.text();
							
							await execute(`
								UPDATE bill_text_versions 
								SET content = ?, contentFetched = 1
								WHERE billId = ? AND type = ? AND formatType = ?
							`, [
								content,
								billId,
								version.type || null,
								format.type || null
							]);
							
							console.log(`  ✅ Content stored for ${version.type} (${format.type})`);
						} catch (contentErr) {
							console.error(`  ❌ Error downloading content:`, contentErr.message);
						}
					}
				} catch (err) {
					console.error(`  ❌ Error storing text version:`, err.message);
				}
			}
		}
		
		// Return the stored versions
		return await getBillTextVersions(billId);
	} catch (error) {
		console.error(`Error fetching text versions for ${billId}:`, error);
		return [];
	}
}
