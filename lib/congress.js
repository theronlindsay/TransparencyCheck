import { setTimeout as delay } from "node:timers/promises";

const API_BASE_URL = "https://api.congress.gov/v3";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const DETAIL_CONCURRENCY = 4;

const apiKey =
  process.env.CONGRESS_API_KEY ??
  process.env.CONGRESS_GOV_API_KEY ??
  process.env.CONGRESS_GPO_API_KEY ??
  process.env.GPO_CONGRESS_API_KEY ??
  process.env.CONGRESS_DOT_GOV_API_KEY;

function assertApiKey() {
  if (!apiKey) {
    throw new Error(
      "Missing Congress.gov API key. Set CONGRESS_API_KEY in your environment before running the sync."
    );
  }
}

function buildUrl(path, searchParams = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("api_key", apiKey);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  return url;
}

async function fetchJson(url, { retries = 3, retryDelay = 500 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Congress.gov request failed (${response.status} ${response.statusText}): ${body}`
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await delay(retryDelay * Math.pow(2, attempt));
      attempt += 1;
    }
  }

  throw lastError;
}

export async function fetchRecentBills({ limit = DEFAULT_LIMIT } = {}) {
  assertApiKey();

  const cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const url = buildUrl("/bill", {
    limit: cappedLimit,
    sort: "updateDate desc",
  });

  const payload = await fetchJson(url);
  const bills = payload?.data?.bills ?? payload?.bills ?? [];

  return bills.map((entry) => entry.bill ?? entry);
}

export async function fetchBillDetail(congress, billTypeCode, billNumber) {
  assertApiKey();

  const normalizedType = (billTypeCode ?? "").toLowerCase();
  if (!congress || !normalizedType || !billNumber) {
    throw new Error(
      `Cannot fetch bill detail without full identifier (congress=${congress}, billType=${billTypeCode}, number=${billNumber}).`
    );
  }

  const path = `/bill/${congress}/${normalizedType}/${billNumber}`;
  const payload = await fetchJson(buildUrl(path));
  return payload?.data ?? payload;
}

export async function enrichBillsWithDetail(bills, { concurrency = DETAIL_CONCURRENCY } = {}) {
  assertApiKey();
  if (!Array.isArray(bills) || bills.length === 0) {
    return [];
  }

  const queue = [...bills];
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const bill = queue.shift();
      if (!bill) break;

      try {
        const detail = await fetchBillDetail(
          bill.congress ?? bill.bill?.congress,
          bill.billTypeCode ?? bill.bill_type ?? bill.type ?? bill.bill?.billTypeCode,
          bill.billNumber ?? bill.number ?? bill.bill?.billNumber
        );
        results.push({ bill, detail });
      } catch (error) {
        results.push({ bill, detail: null, error });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await Promise.all(workers);

  // preserve original ordering
  return bills.map((bill) =>
    results.find((entry) => entry.bill === bill) ?? { bill, detail: null }
  );
}
