/**
 * Bill-related database operations
 */

import { query, queryOne, execute } from './sql/queries.js';
import { getDatabase } from './sql/connection.js';
import { fetchAndStoreBills } from '../bill-fetcher.js';

import { prisma } from '$lib/db/prisma.js';

/**
 * Get a bill by ID with its sponsors and committees
 */
export async function getBillById(billId) {
	try {
		// First try fetching from Mongo via Prisma
		const bill = await prisma.bill.findUnique({
			where: { id: billId }
		});

		if (!bill) {
			// If not in Mongo, fallback to SQLite as requested in Option B
			return await getBillByIdFallback(billId);
		}

		// Helper for safe JSON parsing (since schema defined these as Strings)
		const safeParse = (str, fallback = null) => {
			if (!str) return fallback;
			try {
				return JSON.parse(str);
			} catch (e) {
				console.error(`Error parsing JSON for bill ${billId}:`, e);
				return fallback;
			}
		};

		return {
			...bill,
			latestAction: safeParse(bill.latestAction),
			policyArea: safeParse(bill.policyArea),
			sponsors: safeParse(bill.sponsors, []),
			// Committees are unfortunately not safely stored directly on the MongoDB model yet,
			// so they return empty for now unless explicitly inserted
			committees: []
		};
	} catch (error) {
		console.error(`Prisma error fetching bill ${billId}, falling back to SQLite:`, error);
		return await getBillByIdFallback(billId);
	}
}

/**
 * Original SQLite implementation retained for fallback purposes
 */
async function getBillByIdFallback(billId) {
	const bill = await queryOne(
		`
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
	`,
		[billId]
	);

	if (!bill) return null;

	const safeParse = (str, fallback = null) => {
		if (!str) return fallback;
		try {
			return JSON.parse(str);
		} catch (e) {
			return fallback;
		}
	};

	return {
		...bill,
		latestAction: safeParse(bill.latestAction),
		policyArea: safeParse(bill.policyArea),
		sponsors: bill.sponsorsData
			? bill.sponsorsData
					.split('|||')
					.map((s) => safeParse(s, {}))
					.filter((s) => s.bioguideId)
			: [],
		committees: bill.committeesData
			? bill.committeesData
					.split('|||')
					.map((c) => safeParse(c, {}))
					.filter((c) => c.committeeCode)
			: []
	};
}

/**
 * Get text versions for a bill
 */
export async function getBillTextVersions(billId) {
	try {
		const versions = await prisma.billTextVersion.findMany({
			where: { billId: billId },
			orderBy: { date: 'desc' }
		});

		if (versions && versions.length > 0) {
			console.log(`Prisma: getBillTextVersions for ${billId}: found ${versions.length} versions`);
			return versions;
		}

		console.log(`Prisma: no bill text versions found in Mongo, falling back to SQLite`);
		return await getBillTextVersionsFallback(billId);
	} catch (error) {
		console.error(`Prisma error fetching text versions for ${billId}:`, error);
		return await getBillTextVersionsFallback(billId);
	}
}

async function getBillTextVersionsFallback(billId) {
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

	const versions = await query(
		`
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
	`,
		[billId]
	);

	console.log(`getBillTextVersions for ${billId}: found ${versions?.length || 0} versions`);

	return versions || [];
}

/**
 * Get all actions for a specific bill
 */
export async function getBillActions(billId) {
	try {
		const actions = await prisma.billAction.findMany({
			where: { billId: billId },
			orderBy: { actionDate: 'desc' }
		});

		if (actions && actions.length > 0) return actions;

		return await getBillActionsFallback(billId);
	} catch (error) {
		console.error(`Prisma error fetching actions:`, error);
		return await getBillActionsFallback(billId);
	}
}

async function getBillActionsFallback(billId) {
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
	let sqliteInsertedCount = 0;

	// 1. Prisma MongoDB Upsert
	try {
		// Prisma MongoDB doesn't have an elegant "upsert many" or "insert ignore",
		// so we'll delete existing for the bill and recreate them (same as SQLite logic)
		await prisma.billAction.deleteMany({
			where: { billId: billId }
		});

		const formattedActions = actions.map((action) => ({
			billId: billId,
			actionDate: action.actionDate || null,
			text: action.text || null,
			type: action.type || null,
			actionCode: action.actionCode || null,
			sourceSystem: JSON.stringify(action.sourceSystem || null)
		}));

		if (formattedActions.length > 0) {
			await prisma.billAction.createMany({
				data: formattedActions
			});
			console.log(`Prisma: Saved ${formattedActions.length} actions for bill ${billId}`);
		}
	} catch (error) {
		console.error(
			`Prisma error saving actions for bill ${billId}, continuing to SQLite:`,
			error.message
		);
	}

	// 2. Original SQLite Fallback Sync
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
						function (err) {
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
	return await query(`SELECT * FROM bills ORDER BY updateDateIncludingText DESC LIMIT ?`, [limit]);
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
				const formatType = format.type?.toUpperCase();
				let downloadedContent = null;
				let isFetched = 0;

				// Try downloading
				if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
					try {
						const contentResponse = await fetch(format.url);
						downloadedContent = await contentResponse.text();
						isFetched = 1;
						console.log(`  ✅ Content downloaded for ${version.type} (${format.type})`);
					} catch (contentErr) {
						console.error(`  ❌ Error downloading content:`, contentErr.message);
					}
				}

				// 1. Prisma MongoDB Upsert
				try {
					await prisma.billTextVersion.upsert({
						where: {
							billId_type_formatType: {
								billId: billId,
								type: version.type || '',
								formatType: format.type || ''
							}
						},
						update: {
							date: version.date || null,
							url: format.url || null,
							content: downloadedContent,
							contentFetched: isFetched
						},
						create: {
							billId: billId,
							type: version.type || '',
							date: version.date || null,
							formatType: format.type || '',
							url: format.url || null,
							content: downloadedContent,
							contentFetched: isFetched
						}
					});
				} catch (prismaErr) {
					console.error(
						`Prisma error upserting text version for ${billId}, continuing to SQLite:`,
						prismaErr.message
					);
				}

				// 2. Original SQLite Fallback Sync
				try {
					await execute(
						`
						INSERT OR REPLACE INTO bill_text_versions 
						(billId, type, date, formatType, url, content, contentFetched)
						VALUES (?, ?, ?, ?, ?, ?, ?)
					`,
						[
							billId,
							version.type || null,
							version.date || null,
							format.type || null,
							format.url || null,
							downloadedContent,
							isFetched
						]
					);
				} catch (err) {
					console.error(`  ❌ SQLite Error storing text version:`, err.message);
				}
			}
		}

		// Return the stored versions (uses Prisma fallback chain now)
		return await getBillTextVersions(billId);
	} catch (error) {
		console.error(`Error fetching text versions for ${billId}:`, error);
		return [];
	}
}
