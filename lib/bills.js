import { selectAll, selectOne, runInTransaction } from "./sqlite.js";

const UPSERT_BILL_SQL = `
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
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

function coerceString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function coerceJson(value) {
  if (!value) return "[]";
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to stringify JSON field for bill", error);
    return "[]";
  }
}

function coerceUpdatedAt(value) {
  if (!value) {
    return new Date().toISOString();
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    console.warn("Invalid updatedAt provided for bill", error);
    return new Date().toISOString();
  }
}

export async function replaceBills(billRecords) {
  const bills = Array.isArray(billRecords) ? billRecords : [];

  if (bills.length === 0) {
    return { inserted: 0, deleted: 0 };
  }

  return runInTransaction(async ({ run }) => {
    const { changes: deleted = 0 } = await run("DELETE FROM bills");

    let inserted = 0;

    for (const bill of bills) {
      if (!bill || !bill.id) continue;

      await run(UPSERT_BILL_SQL, [
        coerceString(bill.id),
        coerceString(bill.number),
        coerceString(bill.title),
        coerceString(bill.sponsor),
        coerceString(bill.summary),
        coerceString(bill.summaryLong ?? bill.summary),
        coerceString(bill.committee),
        coerceString(bill.statusTag),
        coerceString(bill.latestAction),
        coerceString(bill.fullTextUrl),
        coerceJson(bill.votes),
        coerceJson(bill.schedule),
        coerceJson(bill.news),
        coerceUpdatedAt(bill.updatedAt ?? bill.updateDate),
      ]);

      inserted += 1;
    }

    return {
      inserted,
      deleted,
    };
  });
}

function normalizeBill(row) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    sponsor: row.sponsor,
    summary: row.summary,
    summaryLong: row.summary_long,
    committee: row.committee,
    statusTag: row.status_tag,
    latestAction: row.latest_action,
    fullTextUrl: row.full_text_url,
    votes: parseJson(row.votes_json),
    schedule: parseJson(row.schedule_json),
    news: parseJson(row.news_json),
    updatedAt: row.updated_at,
  };
}

function parseJson(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse JSON column", error);
    return [];
  }
}

export async function getBills() {
  const rows = await selectAll(
    `SELECT id, number, title, sponsor, summary, summary_long, committee, status_tag, latest_action, full_text_url, votes_json, schedule_json, news_json, updated_at
     FROM bills
     ORDER BY number ASC`
  );

  return rows.map(normalizeBill);
}

export async function getBillById(billId) {
  const row = await selectOne(
    `SELECT id, number, title, sponsor, summary, summary_long, committee, status_tag, latest_action, full_text_url, votes_json, schedule_json, news_json, updated_at
     FROM bills
     WHERE id = ?
     LIMIT 1`,
    [billId]
  );

  if (!row) {
    return null;
  }

  return normalizeBill(row);
}
