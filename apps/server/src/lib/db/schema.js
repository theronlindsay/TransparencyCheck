/**
 * Database table schemas
 * Each table definition includes the CREATE TABLE statement and any indexes
 */

export const tables = {
	bills: {
		create: `
			CREATE TABLE IF NOT EXISTS bills (
				id TEXT PRIMARY KEY,
				billNumber TEXT NOT NULL,
				congress INTEGER NOT NULL,
				type TEXT,
				introducedDate TEXT,
				latestAction TEXT,
				status TEXT,
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
		`,
		indexes: [],
		migrations: [
			{
				name: 'add_status_column',
				check: async (db) => {
					const columns = await new Promise((resolve, reject) => {
						db.all(`PRAGMA table_info(bills)`, (err, rows) => {
							if (err) reject(err);
							else resolve(rows);
						});
					});
					return !columns.some(col => col.name === 'status');
				},
				apply: `ALTER TABLE bills ADD COLUMN status TEXT`
			}
		]
	},

	people: {
		create: `
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
		`,
		indexes: []
	},

	bill_people: {
		create: `
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
		`,
		indexes: []
	},

	committees: {
		create: `
			CREATE TABLE IF NOT EXISTS committees (
				committeeCode TEXT PRIMARY KEY,
				name TEXT,
				chamber TEXT,
				type TEXT,
				subcommitteeCode TEXT,
				parentCommitteeCode TEXT,
				url TEXT
			)
		`,
		indexes: []
	},

	committee_people: {
		create: `
			CREATE TABLE IF NOT EXISTS committee_people (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				committeeCode TEXT NOT NULL,
				personId TEXT NOT NULL,
				role TEXT,
				FOREIGN KEY (committeeCode) REFERENCES committees(committeeCode),
				FOREIGN KEY (personId) REFERENCES people(bioguideId),
				UNIQUE(committeeCode, personId)
			)
		`,
		indexes: []
	},

	bill_committees: {
		create: `
			CREATE TABLE IF NOT EXISTS bill_committees (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				billId TEXT NOT NULL,
				committeeCode TEXT NOT NULL,
				FOREIGN KEY (billId) REFERENCES bills(id),
				FOREIGN KEY (committeeCode) REFERENCES committees(committeeCode),
				UNIQUE(billId, committeeCode)
			)
		`,
		indexes: []
	},

	bill_actions: {
		create: `
			CREATE TABLE IF NOT EXISTS bill_actions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				billId TEXT NOT NULL,
				actionDate TEXT,
				text TEXT,
				type TEXT,
				actionCode TEXT,
				sourceSystem TEXT,
				FOREIGN KEY (billId) REFERENCES bills(id),
				UNIQUE(billId, actionDate, text, actionCode)
			)
		`,
		indexes: [
			`CREATE INDEX IF NOT EXISTS idx_bill_actions_billId 
			 ON bill_actions(billId, actionDate DESC)`
		]
	},

	bill_text_versions: {
		create: `
			CREATE TABLE IF NOT EXISTS bill_text_versions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				billId TEXT NOT NULL,
				type TEXT,
				date TEXT,
				formatType TEXT,
				url TEXT,
				content TEXT,
				contentFetched INTEGER DEFAULT 0,
				FOREIGN KEY (billId) REFERENCES bills(id),
				UNIQUE(billId, type, formatType)
			)
		`,
		indexes: [],
		migrations: [
			{
				name: 'add_content_column',
				check: async (db) => {
					const columns = await new Promise((resolve, reject) => {
						db.all(`PRAGMA table_info(bill_text_versions)`, (err, rows) => {
							if (err) reject(err);
							else resolve(rows);
						});
					});
					return !columns.some(col => col.name === 'content');
				},
				apply: `ALTER TABLE bill_text_versions ADD COLUMN content TEXT`
			},
			{
				name: 'add_contentFetched_column',
				check: async (db) => {
					const columns = await new Promise((resolve, reject) => {
						db.all(`PRAGMA table_info(bill_text_versions)`, (err, rows) => {
							if (err) reject(err);
							else resolve(rows);
						});
					});
					return !columns.some(col => col.name === 'contentFetched');
				},
				apply: `ALTER TABLE bill_text_versions ADD COLUMN contentFetched INTEGER DEFAULT 0`
			}
		]
	}
};

/**
 * The order in which tables should be created (respects foreign key dependencies)
 */
export const tableOrder = [
	'committees',
	'people',
	'bills',
	'bill_people',
	'committee_people',
	'bill_committees',
	'bill_actions',
	'bill_text_versions'
];
