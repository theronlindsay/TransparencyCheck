import initSqlJs from "sql.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { bills } from "../app/data/bills.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDirectory = path.join(__dirname, "..", "db");
const dbPath = path.join(dbDirectory, "transparency.sqlite");
const sqlJsDist = path.join(__dirname, "..", "node_modules", "sql.js", "dist");

async function seed() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlJsDist, file),
  });

  const db = new SQL.Database();

  db.run(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      number TEXT,
      title TEXT,
      sponsor TEXT,
      summary TEXT,
      summary_long TEXT,
      committee TEXT,
      status_tag TEXT,
      latest_action TEXT,
      full_text_url TEXT,
      votes_json TEXT,
      schedule_json TEXT,
      news_json TEXT,
      updated_at TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO bills (
      id,
      number,
      title,
      sponsor,
      summary,
      summary_long,
      committee,
      status_tag,
      latest_action,
      full_text_url,
      votes_json,
      schedule_json,
      news_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
  `);

  for (const bill of bills) {
    insert.run([
      bill.id,
      bill.number,
      bill.title,
      bill.sponsor,
      bill.summary,
      bill.summaryLong,
      bill.committee,
      bill.statusTag,
      bill.latestAction,
      bill.fullTextUrl,
      JSON.stringify(bill.votes ?? []),
      JSON.stringify(bill.schedule ?? []),
      JSON.stringify(bill.news ?? []),
    ]);
  }

  insert.free();

  await mkdir(dbDirectory, { recursive: true });

  const data = db.export();
  const buffer = Buffer.from(data);
  await writeFile(dbPath, buffer);

  const billCount = bills.length;
  db.close();

  console.log(`Seeded ${billCount} bills into ${dbPath}`);
}

seed().catch((error) => {
  console.error("Failed to seed database", error);
  process.exitCode = 1;
});
