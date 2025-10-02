#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  enrichBillsWithDetail,
  fetchRecentBills,
} from "../lib/congress.js";
import { replaceBills } from "../lib/bills.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_DETAIL_LIMIT = 40;

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (!existsSync(envPath)) continue;

    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
    detailLimit: DEFAULT_DETAIL_LIMIT,
    concurrency: undefined,
    detail: true,
  };

  for (const arg of argv) {
    if (arg === "--no-detail") {
      args.detail = false;
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.split("=")[1], 10);
      if (!Number.isNaN(value)) {
        args.limit = value;
      }
    } else if (arg.startsWith("--detail-limit=")) {
      const value = Number.parseInt(arg.split("=")[1], 10);
      if (!Number.isNaN(value)) {
        args.detailLimit = value;
      }
    } else if (arg.startsWith("--concurrency=")) {
      const value = Number.parseInt(arg.split("=")[1], 10);
      if (!Number.isNaN(value)) {
        args.concurrency = value;
      }
    }
  }

  return args;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function deriveBillTypeCode(base, detailBill) {
  return pickString(
    base?.billTypeCode,
    base?.bill_type,
    base?.type,
    detailBill?.billTypeCode,
    detailBill?.type
  ).toUpperCase();
}

function deriveBillNumber(base, detailBill) {
  return pickString(
    base?.billNumber,
    base?.number,
    base?.bill_number,
    detailBill?.billNumber,
    detailBill?.number
  );
}

const TYPE_PREFIX = {
  HR: "H.R.",
  S: "S.",
  HRES: "H.Res.",
  SRES: "S.Res.",
  HCONRES: "H.Con.Res.",
  SCONRES: "S.Con.Res.",
  HJRES: "H.J.Res.",
  SJRES: "S.J.Res.",
};

function buildBillId(typeCode, number) {
  if (!typeCode || !number) return pickString(number);
  const compactType = typeCode.replace(/[^A-Z]/g, "").toLowerCase();
  const compactNumber = number.replace(/[^0-9]/g, "");
  return `${compactType}${compactNumber}`;
}

function buildDisplayNumber(typeCode, number, base) {
  const display = pickString(base?.displayNumber, base?.display_number);
  if (display) return display;
  if (!typeCode || !number) {
    return pickString(number, base?.number);
  }

  const prefix = TYPE_PREFIX[typeCode] ?? typeCode;
  return `${prefix} ${number}`.trim();
}

function deriveSponsor(base, detailBill) {
  const sponsor = base?.sponsors?.[0] ?? detailBill?.sponsors?.[0];
  if (!sponsor) return "";
  return pickString(sponsor.fullName, sponsor.name, sponsor.sponsor, sponsor.displayName);
}

function listCommittees(base, detail) {
  const committees =
    base?.committees ??
    base?.committee ??
    detail?.committees?.items ??
    detail?.committees ??
    [];

  if (!Array.isArray(committees) || committees.length === 0) return "";

  const names = committees
    .map((entry) =>
      pickString(entry.fullName, entry.name, entry.title, entry.committeeName)
    )
    .filter(Boolean);

  return Array.from(new Set(names)).join("; ");
}

function deriveLatestAction(base, detailBill) {
  const action =
    base?.latestAction ??
    base?.latest_action ??
    detailBill?.latestAction ??
    detailBill?.actions?.[0] ??
    detailBill?.actions?.items?.[0];

  const text = pickString(action?.text, action?.description, action?.actionText);
  const date = pickString(action?.actionDate, action?.date, action?.actionDateText);

  if (text && date) {
    return `${text} (${date})`;
  }

  return text || date || "";
}

function deriveStatusTag(latestActionText = "") {
  const text = latestActionText.toLowerCase();
  if (text.includes("became law") || text.includes("enacted")) return "Enacted";
  if (text.includes("passed")) return "Passed";
  if (text.includes("reported")) return "Reported";
  if (text.includes("committee") || text.includes("referred")) return "In Committee";
  if (text.includes("introduced")) return "Introduced";
  return "Active";
}

function deriveSummary(base, detailBill) {
  const summary = pickString(
    detailBill?.latestSummary?.text,
    detailBill?.summaries?.items?.[0]?.summaryText,
    detailBill?.summaries?.items?.[0]?.text,
    detailBill?.summaries?.[0]?.summaryText,
    detailBill?.summary,
    base?.latestSummary?.text,
    base?.summary,
    base?.title
  );

  if (summary) return summary;

  const latestAction = deriveLatestAction(base, detailBill);
  return latestAction || pickString(base?.title);
}

function deriveFullTextUrl(base, detailBill) {
  const collections = [
    detailBill?.texts?.items,
    detailBill?.texts,
    detailBill?.textVersions?.items,
    detailBill?.textVersions,
  ].filter(Array.isArray);

  for (const entries of collections) {
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;

      const directUrl = pickString(entry.url, entry.pdfUrl, entry.txtUrl);
      if (directUrl) return directUrl;

      const nestedFormats = Array.isArray(entry.formats)
        ? entry.formats
        : Array.isArray(entry.formats?.items)
          ? entry.formats.items
          : [];

      for (const format of nestedFormats) {
        if (!format || typeof format !== "object") continue;
        const formatUrl = pickString(format.url, format.downloadUrl);
        if (formatUrl) return formatUrl;
      }
    }
  }

  return pickString(
    detailBill?.congressDotGovUrl,
    detailBill?.congressdotgov_url,
    base?.url,
    base?.billUrl,
    base?.congressDotGovUrl
  );
}

function deriveUpdatedAt(base, detailBill) {
  return pickString(
    detailBill?.updateDate,
    detailBill?.updateDateIncludingText,
    detailBill?.updateDateIncludingSummaries,
    base?.updateDate,
    base?.modifiedDate
  );
}

function toRecord({ bill, detail }) {
  const base = bill?.bill ?? bill ?? {};
  const detailBill = detail?.bill ?? detail ?? {};

  const typeCode = deriveBillTypeCode(base, detailBill);
  const number = deriveBillNumber(base, detailBill);
  const id = buildBillId(typeCode, number);
  const latestAction = deriveLatestAction(base, detailBill);

  return {
    id,
    number: buildDisplayNumber(typeCode, number, base),
    title: pickString(
      detailBill?.title,
      base?.title,
      detailBill?.titles?.items?.[0]?.title,
      detailBill?.titles?.[0]?.title
    ),
    sponsor: deriveSponsor(base, detailBill),
    summary: deriveSummary(base, detailBill),
    summaryLong: deriveSummary(base, detailBill),
    committee: listCommittees(base, detailBill),
    latestAction,
    statusTag: deriveStatusTag(latestAction),
    fullTextUrl: deriveFullTextUrl(base, detailBill),
    votes: [],
    schedule: [],
    news: [],
    updatedAt: deriveUpdatedAt(base, detailBill),
  };
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const bills = await fetchRecentBills({ limit: args.limit });

  console.log(`Fetched ${bills.length} bills from Congress.gov`);

  let enriched = bills.map((bill) => ({ bill, detail: null }));

  if (args.detail) {
    const detailSlice = bills.slice(0, args.detailLimit);
    const hydrated = await enrichBillsWithDetail(detailSlice, {
      concurrency: args.concurrency,
    });

    const detailMap = new Map(
      hydrated.map((entry) => {
        const base = entry.bill.bill ?? entry.bill;
        const type = pickString(
          base?.billTypeCode,
          base?.bill_type,
          base?.type
        ).toUpperCase();
        const key = `${base?.congress ?? ""}|${type}|${
          base?.billNumber ?? base?.number ?? ""
        }`;
        return [key, entry];
      })
    );

    enriched = bills.map((original) => {
      const base = original.bill ?? original;
      const type = pickString(
        base?.billTypeCode,
        base?.bill_type,
        base?.type
      ).toUpperCase();
      const key = `${base?.congress ?? ""}|${type}|${
        base?.billNumber ?? base?.number ?? ""
      }`;
      return detailMap.get(key) ?? { bill: original, detail: null };
    });
  }

  const records = enriched.map(toRecord);
  const uniqueRecords = Array.from(
    records.reduce((map, record) => {
      if (record.id) {
        map.set(record.id, record);
      }
      return map;
    }, new Map()).values()
  );

  const { inserted, deleted } = await replaceBills(uniqueRecords);

  console.log(
    `Replaced ${deleted ?? 0} existing bills with ${inserted} current records.`
  );
}

main().catch((error) => {
  console.error("Failed to sync bills", error);
  process.exitCode = 1;
});
