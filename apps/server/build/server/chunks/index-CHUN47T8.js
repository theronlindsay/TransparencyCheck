import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import sqlite3 from 'sqlite3';
import { b as private_env } from './shared-server-DaWdgxVh.js';

const __filename$2 = fileURLToPath(import.meta.url);
const __dirname$2 = dirname(__filename$2);
const dbPath = join(__dirname$2, "..", "..", "..", "db", "transparency.sqlite");
function getDatabase() {
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
const tables = {
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
        name: "add_status_column",
        check: async (db) => {
          const columns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(bills)`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          return !columns.some((col) => col.name === "status");
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
        name: "add_content_column",
        check: async (db) => {
          const columns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(bill_text_versions)`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          return !columns.some((col) => col.name === "content");
        },
        apply: `ALTER TABLE bill_text_versions ADD COLUMN content TEXT`
      },
      {
        name: "add_contentFetched_column",
        check: async (db) => {
          const columns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(bill_text_versions)`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          return !columns.some((col) => col.name === "contentFetched");
        },
        apply: `ALTER TABLE bill_text_versions ADD COLUMN contentFetched INTEGER DEFAULT 0`
      }
    ]
  }
};
const tableOrder = [
  "committees",
  "people",
  "bills",
  "bill_people",
  "committee_people",
  "bill_committees",
  "bill_actions",
  "bill_text_versions"
];
async function applyMigrations(db, tableName, migrations) {
  if (!migrations || migrations.length === 0) return;
  for (const migration of migrations) {
    try {
      const needsMigration = await migration.check(db);
      if (needsMigration) {
        await new Promise((resolve, reject) => {
          db.run(migration.apply, (err) => {
            if (err) {
              console.error(`❌ Error applying migration ${migration.name} to ${tableName}:`, err.message);
              reject(err);
            } else {
              console.log(`✓ Applied migration: ${migration.name} to ${tableName}`);
              resolve();
            }
          });
        });
      } else {
        console.log(`⏭️  Skipping migration ${migration.name} for ${tableName} (already applied)`);
      }
    } catch (error) {
      console.error(`Error checking/applying migration ${migration.name}:`, error);
    }
  }
}
async function createTable(db, tableName, tableSchema) {
  await new Promise((resolve, reject) => {
    db.run(tableSchema.create, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`✓ Table '${tableName}' created or already exists`);
        resolve();
      }
    });
  });
  if (tableSchema.indexes && tableSchema.indexes.length > 0) {
    for (const index of tableSchema.indexes) {
      await new Promise((resolve, reject) => {
        db.run(index, (err) => {
          if (err) {
            console.error(`❌ Error creating index for ${tableName}:`, err.message);
            resolve();
          } else {
            console.log(`✓ Index created for '${tableName}'`);
            resolve();
          }
        });
      });
    }
  }
  if (tableSchema.migrations) {
    await applyMigrations(db, tableName, tableSchema.migrations);
  }
}
async function query(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) {
        console.error("Query Error:", err);
        console.error("SQL:", sql);
        console.error("Params:", params);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
async function queryOne(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      db.close();
      if (err) {
        console.error("QueryOne Error:", err);
        console.error("SQL:", sql);
        console.error("Params:", params);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}
async function execute(sql, params = []) {
  console.log("=== EXECUTE SQL ===");
  console.log("SQL:", sql);
  console.log("Params:", params);
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error("✗ SQL execution error:", err.message);
        console.error("Failed SQL:", sql);
        console.error("Failed params:", params);
        db.close();
        reject(err);
      } else {
        console.log("✓ SQL executed successfully");
        console.log("  Last ID:", this.lastID);
        console.log("  Changes:", this.changes);
        console.log("==================");
        db.close();
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      }
    });
  });
}
const CONGRESS_API_KEY = private_env.CONGRESS_API_KEY;
function determineBillStatus(bill) {
  const latestActionText = bill.latestAction?.text?.toLowerCase() || "";
  if (latestActionText.includes("became public law") || latestActionText.includes("became private law") || latestActionText.includes("signed by president")) {
    return "Enacted";
  }
  if (latestActionText.includes("vetoed") || latestActionText.includes("veto message")) {
    return "Vetoed";
  }
  if (latestActionText.includes("failed") || latestActionText.includes("rejected") || latestActionText.includes("motion to proceed rejected")) {
    return "Failed";
  }
  if (latestActionText.includes("passed senate") || latestActionText.includes("received in the senate")) {
    return "Passed House";
  }
  if (latestActionText.includes("passed house") || latestActionText.includes("received in the house")) {
    return "Passed Senate";
  }
  if (latestActionText.includes("referred to") || latestActionText.includes("committee on")) {
    return "In Committee";
  }
  if (latestActionText.includes("introduced in") || bill.introducedDate) {
    return "Introduced";
  }
  return "Active";
}
async function getBillDetails(billUrl) {
  if (!CONGRESS_API_KEY) {
    throw new Error("CONGRESS_API_KEY is not defined");
  }
  const url = `${billUrl}?format=json&api_key=${CONGRESS_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch bill details from ${url}. Status: ${response.status}`);
    return null;
  }
  const data = await response.json();
  return data.bill;
}
async function saveBillToDatabase(bill) {
  const billId = `${bill.type}${bill.number}`;
  const existingBill = await query(
    `SELECT id FROM bills WHERE id = ?`,
    [billId]
  );
  if (existingBill.length > 0) {
    return billId;
  }
  let detailedBill = bill;
  if (bill.url) {
    try {
      const details = await getBillDetails(bill.url);
      if (details) {
        detailedBill = details;
      }
    } catch (error) {
      console.error(`Error fetching details for ${bill.number}:`, error);
    }
  }
  const billStatus = determineBillStatus(detailedBill);
  await execute(
    `INSERT OR REPLACE INTO bills 
		(id, billNumber, congress, type, introducedDate, latestAction, status, originChamber, originChamberCode, 
		title, updateDate, updateDateIncludingText, url, legislationUrl, policyArea, primaryCommitteeCode,
		actionsCount, actionsUrl, committeesCount, committeesUrl, cosponsorsCount, cosponsorsUrl, 
		relatedBillsCount, relatedBillsUrl, sponsors, subjectsCount, subjectsUrl, 
		summariesCount, summariesUrl, textVersionsCount, textVersionsUrl, titlesCount, titlesUrl) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      billId,
      detailedBill.number,
      detailedBill.congress,
      detailedBill.type || null,
      detailedBill.introducedDate || null,
      JSON.stringify(detailedBill.latestAction) || null,
      billStatus,
      detailedBill.originChamber || null,
      detailedBill.originChamberCode || null,
      detailedBill.title || null,
      detailedBill.updateDate || null,
      detailedBill.updateDateIncludingText || null,
      detailedBill.url || null,
      detailedBill.legislationUrl || null,
      detailedBill.policyArea ? JSON.stringify(detailedBill.policyArea) : null,
      null,
      detailedBill.actions?.count || null,
      detailedBill.actions?.url || null,
      detailedBill.committees?.count || null,
      detailedBill.committees?.url || null,
      detailedBill.cosponsors?.count || null,
      detailedBill.cosponsors?.url || null,
      detailedBill.relatedBills?.count || null,
      detailedBill.relatedBills?.url || null,
      detailedBill.sponsors ? JSON.stringify(detailedBill.sponsors) : null,
      detailedBill.subjects?.count || null,
      detailedBill.subjects?.url || null,
      detailedBill.summaries?.count || null,
      detailedBill.summaries?.url || null,
      detailedBill.textVersions?.count || null,
      detailedBill.textVersions?.url || null,
      detailedBill.titles?.count || null,
      detailedBill.titles?.url || null
    ]
  );
  if (detailedBill.sponsors && Array.isArray(detailedBill.sponsors)) {
    for (const sponsor of detailedBill.sponsors) {
      if (sponsor.bioguideId) {
        try {
          await execute(
            `INSERT OR REPLACE INTO people 
						(bioguideId, firstName, lastName, fullName, branch, party, state, district, donors, url) 
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sponsor.bioguideId,
              sponsor.firstName || null,
              sponsor.lastName || null,
              sponsor.fullName || null,
              "legislative",
              sponsor.party || null,
              sponsor.state || null,
              sponsor.district || null,
              null,
              sponsor.url || null
            ]
          );
          await execute(
            `INSERT OR REPLACE INTO bill_people 
						(billId, personId, relationship, isByRequest) 
						VALUES (?, ?, ?, ?)`,
            [
              billId,
              sponsor.bioguideId,
              "sponsor",
              sponsor.isByRequest || null
            ]
          );
        } catch (error) {
          console.error(`Error saving sponsor ${sponsor.bioguideId}:`, error);
        }
      }
    }
  }
  return billId;
}
async function fetchAndStoreBills({ searchQuery, dateFrom, dateTo, limit = 250 } = {}) {
  if (!CONGRESS_API_KEY) {
    throw new Error("CONGRESS_API_KEY is not defined");
  }
  try {
    const apiParams = new URLSearchParams({
      api_key: CONGRESS_API_KEY,
      format: "json",
      limit: limit.toString()
      // Use the provided limit
    });
    if (searchQuery) {
      apiParams.append("query", searchQuery);
    }
    if (dateFrom) {
      apiParams.append("fromDateTime", `${dateFrom}T00:00:00Z`);
    }
    if (dateTo) {
      apiParams.append("toDateTime", `${dateTo}T23:59:59Z`);
    }
    const response = await fetch(
      `https://api.congress.gov/v3/bill?${apiParams.toString()}`
    );
    if (!response.ok) {
      throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const bills = data.bills || [];
    console.log(`Found ${bills.length} bills from Congress.gov API.`);
    for (const bill of bills) {
      try {
        await saveBillToDatabase(bill);
      } catch (error) {
        console.error(`Error saving bill ${bill.type}${bill.number} to database:`, error);
      }
    }
    console.log(`Finished processing ${bills.length} bills.`);
    return bills;
  } catch (error) {
    console.error("Failed to fetch and store bills:", error);
    throw error;
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
async function initDatabase() {
  console.log("🗄️  Initializing database...");
  const dbDir = join(__dirname$1, "..", "..", "..", "db");
  await mkdir(dbDir, { recursive: true });
  const db = await getDatabase();
  try {
    for (const tableName of tableOrder) {
      const tableSchema = tables[tableName];
      if (!tableSchema) {
        console.warn(`⚠️  No schema found for table: ${tableName}`);
        continue;
      }
      await createTable(db, tableName, tableSchema);
    }
    console.log("✅ Database initialization complete!");
    db.close();
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    db.close();
    throw error;
  }
}

export { queryOne as a, execute as e, fetchAndStoreBills as f, initDatabase as i, query as q };
//# sourceMappingURL=index-CHUN47T8.js.map
