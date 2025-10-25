import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the database file
const dbPath = join(__dirname, '..', '..', 'db', 'transparency.sqlite');

// Initialize the database
export async function initDatabase() {
	// Ensure the db directory exists
	const dbDir = join(__dirname, '..', '..', 'db');
	await mkdir(dbDir, { recursive: true });

	return new Promise((resolve, reject) => {
		const db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				reject(err);
			} else {
				console.log('Connected to transparency.sqlite database');
				
				// Create the bills table
				db.run(`
					CREATE TABLE IF NOT EXISTS bills (
						id TEXT PRIMARY KEY,
						billNumber TEXT NOT NULL,
						congress INTEGER NOT NULL,
						type TEXT,
						introducedDate TEXT,
						latestAction TEXT,
						originChamber TEXT,
						originChamberCode TEXT,
						title TEXT,
						updateDate TEXT,
						updateDateIncludingText TEXT,
						url TEXT,
						legislationUrl TEXT,
						policyArea TEXT,
						primaryCommitteeCode TEXT,
						actionsCount INTEGER,
						actionsUrl TEXT,
						committeesCount INTEGER,
						committeesUrl TEXT,
						cosponsorsCount INTEGER,
						cosponsorsUrl TEXT,
						relatedBillsCount INTEGER,
						relatedBillsUrl TEXT,
						sponsors TEXT,
						subjectsCount INTEGER,
						subjectsUrl TEXT,
						summariesCount INTEGER,
						summariesUrl TEXT,
						textVersionsCount INTEGER,
						textVersionsUrl TEXT,
						titlesCount INTEGER,
						titlesUrl TEXT,
						UNIQUE(billNumber, congress),
						FOREIGN KEY (primaryCommitteeCode) REFERENCES committees(committeeCode)
					)
				`, (err) => {
					if (err) {
						reject(err);
					} else {
						console.log('Bills table created or already exists');
						
						// Create the people table
						db.run(`
							CREATE TABLE IF NOT EXISTS people (
								bioguideId TEXT PRIMARY KEY,
								firstName TEXT,
								lastName TEXT,
								fullName TEXT,
								branch TEXT,
								party TEXT,
								state TEXT,
								district TEXT,
								donors TEXT,
								url TEXT
							)
						`, (err) => {
							if (err) {
								reject(err);
							} else {
								console.log('People table created or already exists');
								
								// Create the bill_people junction table
								db.run(`
									CREATE TABLE IF NOT EXISTS bill_people (
										id INTEGER PRIMARY KEY AUTOINCREMENT,
										billId TEXT NOT NULL,
										personId TEXT NOT NULL,
										relationship TEXT,
										isByRequest TEXT,
										FOREIGN KEY (billId) REFERENCES bills(id),
										FOREIGN KEY (personId) REFERENCES people(bioguideId),
										UNIQUE(billId, personId, relationship)
									)
								`, (err) => {
									if (err) {
										reject(err);
									} else {
										console.log('Bill_people table created or already exists');
										
										// Create the committees table
										db.run(`
											CREATE TABLE IF NOT EXISTS committees (
												committeeCode TEXT PRIMARY KEY,
												name TEXT,
												chamber TEXT,
												type TEXT,
												subcommitteeCode TEXT,
												parentCommitteeCode TEXT,
												url TEXT
											)
										`, (err) => {
											if (err) {
												reject(err);
											} else {
												console.log('Committees table created or already exists');
												
												// Create the committee_people junction table
												db.run(`
													CREATE TABLE IF NOT EXISTS committee_people (
														id INTEGER PRIMARY KEY AUTOINCREMENT,
														committeeCode TEXT NOT NULL,
														personId TEXT NOT NULL,
														role TEXT,
														FOREIGN KEY (committeeCode) REFERENCES committees(committeeCode),
														FOREIGN KEY (personId) REFERENCES people(bioguideId),
														UNIQUE(committeeCode, personId)
													)
												`, (err) => {
													if (err) {
														reject(err);
													} else {
														console.log('Committee_people table created or already exists');
														
														// Create the bill_committees junction table
														db.run(`
															CREATE TABLE IF NOT EXISTS bill_committees (
																id INTEGER PRIMARY KEY AUTOINCREMENT,
																billId TEXT NOT NULL,
																committeeCode TEXT NOT NULL,
																FOREIGN KEY (billId) REFERENCES bills(id),
																FOREIGN KEY (committeeCode) REFERENCES committees(committeeCode),
																UNIQUE(billId, committeeCode)
															)
														`, (err) => {
															if (err) {
																reject(err);
															} else {
																console.log('Bill_committees table created or already exists');
																
																// Create the bill_text_versions table
																db.run(`
																	CREATE TABLE IF NOT EXISTS bill_text_versions (
																		id INTEGER PRIMARY KEY AUTOINCREMENT,
																		billId TEXT NOT NULL,
																		type TEXT,
																		date TEXT,
																		formatType TEXT,
																		url TEXT,
																		FOREIGN KEY (billId) REFERENCES bills(id),
																		UNIQUE(billId, type, formatType)
																	)
																`, (err) => {
																	if (err) {
																		reject(err);
																	} else {
																		console.log('Bill_text_versions table created or already exists');
																		resolve(db);
																	}
																});
															}
														});
													}
												});
											}
										});
									}
								});
							}
						});
					}
				});
			}
		});
	});
}

// Get database connection
export function getDatabase() {
	return new Promise((resolve, reject) => {
		const db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve(db);
			}
		});
	});
}

// Close database connection
export function closeDatabase(db) {
	return new Promise((resolve, reject) => {
		db.close((err) => {
			if (err) {
				reject(err);
			} else {
				console.log('Database connection closed');
				resolve();
			}
		});
	});
}

// Execute a query that returns multiple rows (SELECT queries)
export async function query(sql, params = []) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			db.close();
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
}

// Execute a query that returns a single row (SELECT with LIMIT 1)
export async function queryOne(sql, params = []) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			db.close();
			if (err) {
				reject(err);
			} else {
				resolve(row);
			}
		});
	});
}

// Get a bill by ID with its sponsors and committees
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

// Get text versions for a bill
export async function getBillTextVersions(billId) {
	const versions = await query(`
		SELECT 
			id,
			billId,
			type,
			date,
			formatType,
			url
		FROM bill_text_versions
		WHERE billId = ?
		ORDER BY date DESC
	`, [billId]);
	
	console.log(`getBillTextVersions for ${billId}: found ${versions?.length || 0} versions`);
	if (versions && versions.length > 0) {
		console.log('First version:', versions[0]);
	}
	
	return versions || [];
}

// Execute a query that modifies data (INSERT, UPDATE, DELETE)
export async function execute(sql, params = []) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.run(sql, params, function(err) {
			db.close();
			if (err) {
				reject(err);
			} else {
				// 'this' contains lastID and changes
				resolve({
					lastID: this.lastID,
					changes: this.changes
				});
			}
		});
	});
}

// Execute multiple queries in a transaction
export async function transaction(callback) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run('BEGIN TRANSACTION');
			
			Promise.resolve(callback(db))
				.then((result) => {
					db.run('COMMIT', (err) => {
						db.close();
						if (err) {
							reject(err);
						} else {
							resolve(result);
						}
					});
				})
				.catch((error) => {
					db.run('ROLLBACK', () => {
						db.close();
						reject(error);
					});
				});
		});
	});
}
