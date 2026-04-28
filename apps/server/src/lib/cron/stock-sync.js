import { StockTrade } from '$lib/db/models/StockTrade.js';
import Person from '$lib/db/models/Person.js';
import { emptyStockData } from '$lib/server/person-cache.js';

/**
 * FMP `/stable/*` congressional endpoints (not legacy `/api/v4/senate-*`, which 403 for post–Aug 2025 accounts).
 * @see https://financialmodelingprep.com/developer/docs/stable/senate-latest
 */
const FMP_STABLE = 'https://financialmodelingprep.com/stable';

const FETCH_HEADERS_BASE = {
	'User-Agent': 'TransparencyCheck/1.0 (stock sync; +https://github.com)'
};

/**
 * @returns {Promise<Map<string, string>>} lowercase Congress-style name → bioguideId
 */
export async function buildNameToIdMapFromDatabase() {
	const rows = await Person.find({ fullName: { $exists: true, $ne: '' } })
		.select('fullName _id')
		.lean();
	const m = new Map();
	for (const r of rows) {
		m.set(String(r.fullName).toLowerCase(), r._id);
	}
	return m;
}

function fmpPoliticianName(trade) {
	const rep = (trade.representative || trade.senator || '').trim();
	if (rep) return rep.toLowerCase();
	const first = (trade.firstName || '').trim();
	const last = (trade.lastName || '').trim();
	if (first || last) return `${first} ${last}`.trim().toLowerCase();
	return '';
}

/**
 * FMP may return a bare array, or an error object, or a wrapped list.
 * @returns {{ rows: object[] | null, errorSnippet: string | null }}
 */
function extractFmpTradeRows(parsed) {
	if (parsed == null) {
		return { rows: null, errorSnippet: 'empty response' };
	}
	if (Array.isArray(parsed)) {
		return { rows: parsed, errorSnippet: null };
	}
	if (typeof parsed === 'object') {
		const msg = parsed['Error Message'] ?? parsed.error ?? parsed.message;
		if (msg) {
			return { rows: null, errorSnippet: String(msg).slice(0, 280) };
		}
		if (Array.isArray(parsed.data)) {
			return { rows: parsed.data, errorSnippet: null };
		}
		if (Array.isArray(parsed.results)) {
			return { rows: parsed.results, errorSnippet: null };
		}
	}
	return {
		rows: null,
		errorSnippet: JSON.stringify(parsed).slice(0, 200)
	};
}

function fmpRequestHeaders(apiKey) {
	return {
		...FETCH_HEADERS_BASE,
		apikey: apiKey
	};
}

function truncateLogSnippet(value, max = 280) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

/**
 * FMP free/low tiers often:
 * - cap `limit` at 25 (HTTP 402 if higher) — override with FMP_STOCK_PAGE_LIMIT
 * - allow only `page=0` (HTTP 402 on page≥1) — override with FMP_STOCK_MAX_PAGES
 */
export function resolveFmpStockPagination() {
	const rawLimit = process.env.FMP_STOCK_PAGE_LIMIT?.trim();
	let limit = 25;
	if (rawLimit) {
		const n = parseInt(rawLimit, 10);
		if (!Number.isNaN(n) && n >= 1) limit = Math.min(n, 250);
	}

	const rawPages = process.env.FMP_STOCK_MAX_PAGES?.trim();
	let maxPages = 1;
	if (rawPages) {
		const p = parseInt(rawPages, 10);
		if (!Number.isNaN(p) && p >= 1) maxPages = Math.min(p, 100);
	}

	return { limit, maxPages };
}

async function fetchFmpPaginatedStable(path, name, fmpKey, { maxPages, limit }) {
	const rows = [];
	const endpointResults = [];
	const headers = fmpRequestHeaders(fmpKey);

	for (let page = 0; page < maxPages; page++) {
		const u = new URL(`${FMP_STABLE}/${path}`);
		u.searchParams.set('apikey', fmpKey);
		u.searchParams.set('page', String(page));
		u.searchParams.set('limit', String(limit));

		const fRes = await fetch(u.toString(), { headers });
		let bodySnippet = '';

		if (!fRes.ok) {
			try {
				bodySnippet = (await fRes.text()).slice(0, 280);
			} catch {
				bodySnippet = '';
			}
			endpointResults.push({
				name: `${name} page=${page}`,
				ok: false,
				rows: 0,
				httpStatus: fRes.status,
				bodySnippet
			});
			break;
		}

		let parsed;
		try {
			const bodyText = await fRes.text();
			bodySnippet = truncateLogSnippet(bodyText, 500);
			parsed = bodyText ? JSON.parse(bodyText) : null;
		} catch {
			endpointResults.push({
				name: `${name} page=${page}`,
				ok: false,
				rows: 0,
				httpStatus: fRes.status,
				bodySnippet: 'invalid JSON'
			});
			break;
		}

		const { rows: pageRows, errorSnippet } = extractFmpTradeRows(parsed);
		if (errorSnippet || pageRows === null) {
			endpointResults.push({
				name: `${name} page=${page}`,
				ok: false,
				rows: 0,
				httpStatus: fRes.status,
				bodySnippet: errorSnippet || 'unrecognized JSON shape'
			});
			break;
		}

		endpointResults.push({
			name: `${name} page=${page}`,
			ok: true,
			rows: pageRows.length,
			httpStatus: fRes.status,
			bodySnippet
		});
		if (pageRows.length === 0) break;
		rows.push(...pageRows);
		if (pageRows.length < limit) break;
	}
	return { rows, endpointResults };
}

export async function syncFmpStockTrades(nameToIdMap, fmpKey) {
	if (!fmpKey?.trim()) {
		return { ok: false, skipped: true, reason: 'FMP_API_KEY missing' };
	}

	const key = fmpKey.trim();

	const { limit, maxPages } = resolveFmpStockPagination();
	const pageOpts = { limit, maxPages };

	const senate = await fetchFmpPaginatedStable(
		'senate-latest',
		'stable/senate-latest',
		key,
		pageOpts
	);
	const house = await fetchFmpPaginatedStable('house-latest', 'stable/house-latest', key, pageOpts);

	const allTrades = [...senate.rows, ...house.rows];
	const endpointResults = [...senate.endpointResults, ...house.endpointResults];

	let unmatched = 0;
	const tradeOps = [];

	for (const trade of allTrades) {
		const targetName = fmpPoliticianName(trade);
		const parts = targetName.split(/\s+/).filter(Boolean);
		let bioguideId = null;

		if (parts.length > 0) {
			const first = parts[0];
			const last = parts[parts.length - 1];
			for (const [keyName, id] of nameToIdMap.entries()) {
				if (keyName.includes(first) && keyName.includes(last)) {
					bioguideId = id;
					break;
				}
			}
		}

		if (!bioguideId) {
			unmatched++;
			continue;
		}

		const txRaw =
			trade.transactionDate || trade.date || trade.disclosureDate || trade.disclosure_date;
		if (!txRaw) {
			unmatched++;
			continue;
		}
		const txDate = new Date(txRaw);
		if (Number.isNaN(txDate.getTime())) {
			unmatched++;
			continue;
		}

		const discRaw = trade.disclosureDate || trade.disclosure_date;
		let discDate;
		if (discRaw) {
			const d = new Date(discRaw);
			if (!Number.isNaN(d.getTime())) discDate = d;
		}

		tradeOps.push({
			politicianId: String(bioguideId).toUpperCase(),
			ticker: trade.symbol || trade.ticker || 'UNKNOWN',
			companyName: trade.company || trade.assetDescription || trade.asset || null,
			transactionDate: txDate,
			disclosureDate: discDate,
			transactionType: trade.type || trade.transaction_type || 'Unknown',
			amountRange: trade.amount || trade.amountRange || 'Unknown Range',
			source: 'Financial Modeling Prep'
		});
	}

	const everyRequestFailed = endpointResults.length > 0 && endpointResults.every((e) => !e.ok);

	// Only replace the collection when FMP responded successfully enough to build rows.
	// Never wipe Mongo on failed/partial fetches — keeps the last good local cache.
	let replacedCollection = false;
	if (!everyRequestFailed && tradeOps.length > 0) {
		await StockTrade.deleteMany({});
		await StockTrade.insertMany(tradeOps);
		replacedCollection = true;
	}

	if (!everyRequestFailed) {
		const allPoliticianIds = [
			...new Set([...nameToIdMap.values()].map((value) => String(value).toUpperCase()))
		];
		const groupedTrades = new Map();

		for (const trade of tradeOps) {
			const key = String(trade.politicianId).toUpperCase();
			if (!groupedTrades.has(key)) {
				groupedTrades.set(key, []);
			}
			groupedTrades.get(key).push({
				ticker: trade.ticker,
				companyName: trade.companyName,
				transactionDate: trade.transactionDate,
				disclosureDate: trade.disclosureDate,
				transactionType: trade.transactionType,
				amountRange: trade.amountRange,
				source: trade.source
			});
		}

		const syncedAt = new Date();
		if (allPoliticianIds.length > 0) {
			await Person.updateMany(
				{ _id: { $in: allPoliticianIds } },
				{
					$set: {
						stockData: emptyStockData({
							trades: [],
							lastSyncedAt: syncedAt
						})
					}
				}
			);
		}

		if (groupedTrades.size > 0) {
			await Promise.all(
				[...groupedTrades.entries()].map(async ([politicianId, trades]) => {
					await Person.updateOne(
						{ _id: politicianId },
						{
							$set: {
								stockData: emptyStockData({
									trades: trades.sort(
										(a, b) =>
											new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
									),
									lastSyncedAt: syncedAt
								})
							}
						}
					);
				})
			);
		}
	}

	const uniquePoliticians = new Set(tradeOps.map((t) => t.politicianId)).size;

	return {
		ok: !everyRequestFailed,
		replacedCollection,
		rawRows: allTrades.length,
		inserted: tradeOps.length,
		unmatched,
		uniquePoliticians,
		nameMapSize: nameToIdMap.size,
		endpoints: endpointResults,
		fmpPageLimit: limit,
		fmpMaxPagesPerEndpoint: maxPages,
		hint: everyRequestFailed
			? 'See endpoint errors above. Typical fixes: valid FMP_API_KEY, congressional /stable/ access, limit ≤25 (default; raise with FMP_STOCK_PAGE_LIMIT), and page=0 only (default; set FMP_STOCK_MAX_PAGES to paginate on higher tiers).'
			: undefined
	};
}

/**
 * @param {Awaited<ReturnType<typeof syncFmpStockTrades>>} summary
 */
export function logStockSyncSummary(summary) {
	console.log('');
	console.log('[Stock sync] ─────────────────────────────────────────────────');
	if (!summary || summary.skipped) {
		console.log('[Stock sync] Skipped:', summary?.reason ?? 'unknown');
		console.log('[Stock sync] ─────────────────────────────────────────────────');
		console.log('');
		return;
	}
	if (!summary.ok) {
		console.log(
			'[Stock sync] Failed: all FMP /stable/ requests failed or returned an error payload.'
		);
		if (summary.fmpPageLimit != null) {
			console.log(
				`[Stock sync]   Request limit was: ${summary.fmpPageLimit}/page; max pages/endpoint: ${summary.fmpMaxPagesPerEndpoint ?? '—'}`
			);
		}
		if (summary.hint) console.log(`[Stock sync] ${summary.hint}`);
		console.log('[Stock sync]   Mongo cache:           unchanged (prior trades kept)');
		console.log('[Stock sync] ─────────────────────────────────────────────────');
		console.log('');
		return;
	}

	if (summary.fmpPageLimit != null) {
		console.log(
			`[Stock sync]   Request limit: ${summary.fmpPageLimit}/page (env FMP_STOCK_PAGE_LIMIT, default 25); max pages/endpoint: ${summary.fmpMaxPagesPerEndpoint ?? '—'}`
		);
	}
	for (const ep of summary.endpoints) {
		const status = ep.ok ? 'ok' : 'failed';
		let line = `[Stock sync]   FMP ${ep.name}: ${status} — ${ep.rows} row(s)${ep.httpStatus ? ` (HTTP ${ep.httpStatus})` : ''}`;
		if (ep.bodySnippet) {
			line += `\n[Stock sync]     → ${ep.bodySnippet.replace(/\s+/g, ' ').trim()}`;
		}
		console.log(line);
	}
	console.log(`[Stock sync]   Combined raw rows:     ${summary.rawRows}`);
	console.log(`[Stock sync]   Matched & inserted:    ${summary.inserted}`);
	console.log(`[Stock sync]   Unmatched (no bioguide): ${summary.unmatched}`);
	console.log(`[Stock sync]   Unique politicians:    ${summary.uniquePoliticians}`);
	console.log(`[Stock sync]   Name map entries:      ${summary.nameMapSize}`);
	if (summary.replacedCollection != null) {
		console.log(
			`[Stock sync]   Mongo cache:           ${summary.replacedCollection ? 'replaced with new snapshot' : 'unchanged (prior trades kept)'}`
		);
	}
	console.log('[Stock sync] ─────────────────────────────────────────────────');
	console.log('');
}
