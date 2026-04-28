import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

/** Bump with fetch strategy changes; stored on FinanceProfile for cache invalidation. */
export const DONOR_AGG_VERSION = 4;

/**
 * OpenFEC uses two-year transaction periods (even years, e.g. 2024, 2022).
 * @param {number} count — how many periods to include (default ~8 years)
 */
export function recentTwoYearPeriods(count = 4) {
	const y = new Date().getFullYear();
	let end = y % 2 === 0 ? y : y - 1;
	const periods = [];
	for (let i = 0; i < count; i++) {
		periods.push(end - i * 2);
	}
	return periods;
}

function mapScheduleARow(r) {
	return {
		committeeId: r.committee?.committee_id || null,
		committeeName: r.committee?.name || r.committee?.committee_name || 'Unknown committee',
		donorName: (r.contributor_name || r.committee_name || 'Unknown').trim() || 'Unknown',
		amount: Number(r.contribution_receipt_amount) || 0,
		date: r.contribution_receipt_date || ''
	};
}

/**
 * Fetch schedule A pages for one or more committees across several two-year periods.
 *
 * @param {Array<{ committeeId: string, name?: string }>} committees
 * @param {string} apiKey
 * @param {{ periodCount?: number, pagesPerPeriod?: number, perPage?: number }} opts
 */
export async function fetchDonorRowsMultiYear(committees, apiKey, opts = {}) {
	const { periodCount = 4, pagesPerPeriod = 2, perPage = 100 } = opts;

	const periods = recentTwoYearPeriods(periodCount);
	const cap = Math.min(perPage, 100);
	const allRows = [];

	for (const committee of committees || []) {
		if (!committee?.committeeId) {
			continue;
		}

		for (const period of periods) {
			for (let page = 1; page <= pagesPerPeriod; page++) {
				const u = new URL('https://api.open.fec.gov/v1/schedules/schedule_a/');
				u.searchParams.set('api_key', apiKey);
				u.searchParams.set('committee_id', committee.committeeId);
				u.searchParams.set('sort', '-contribution_receipt_amount');
				u.searchParams.set('per_page', String(cap));
				u.searchParams.set('two_year_transaction_period', String(period));
				u.searchParams.set('page', String(page));

				console.log('[OpenFEC donors] requesting', {
					committeeId: committee.committeeId,
					committeeName: committee.name || null,
					period,
					page,
					url: u.toString()
				});

				const res = await fetch(u.toString());
				if (res.status === 429) {
					throw new OpenFECRateLimitError('OpenFEC schedule_a returned 429');
				}
				if (!res.ok) break;
				const bodyText = await res.text();
				console.log('[OpenFEC donors] response preview', {
					committeeId: committee.committeeId,
					committeeName: committee.name || null,
					period,
					page,
					status: res.status,
					body: bodyText.slice(0, 1200)
				});
				const j = bodyText ? JSON.parse(bodyText) : {};
				const results = j.results || [];
				if (results.length === 0) break;
				for (const r of results) {
					allRows.push(mapScheduleARow(r));
				}
				const totalPages = j.pagination?.pages ?? 1;
				if (page >= totalPages) break;
			}
		}
	}

	return allRows;
}

export function aggregateDonorRows(rows, maxDonors = 150) {
	const byKey = new Map();
	for (const row of rows || []) {
		const key = row.donorName.toLowerCase();
		const prev = byKey.get(key);
		if (!prev) {
			byKey.set(key, {
				donorName: row.donorName,
				amount: row.amount,
				date: row.date
			});
		} else {
			prev.amount += row.amount;
			if (row.date && (!prev.date || row.date > prev.date)) prev.date = row.date;
		}
	}

	return [...byKey.values()].sort((a, b) => b.amount - a.amount).slice(0, maxDonors);
}
