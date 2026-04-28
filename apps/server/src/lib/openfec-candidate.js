import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

export function isValidFecCandidateId(value) {
	return typeof value === 'string' && /^[HSP][0-9A-Z]{8}$/i.test(value.trim());
}

/** True if we already have a non-empty FEC candidate id (skip OpenFEC name search). */
export function hasStoredFecCandidateId(value) {
	return isValidFecCandidateId(value);
}

function normalizeOffice(officeOrBranch) {
	const raw = String(officeOrBranch || '')
		.trim()
		.toUpperCase();
	if (!raw) return null;
	if (raw === 'H' || raw.includes('HOUSE')) return 'H';
	if (raw === 'S' || raw.includes('SENATE')) return 'S';
	if (raw === 'P' || raw.includes('PRESIDENT')) return 'P';
	return raw;
}

const STATE_ABBREVIATIONS = {
	ALABAMA: 'AL',
	ALASKA: 'AK',
	ARIZONA: 'AZ',
	ARKANSAS: 'AR',
	CALIFORNIA: 'CA',
	COLORADO: 'CO',
	CONNECTICUT: 'CT',
	DELAWARE: 'DE',
	FLORIDA: 'FL',
	GEORGIA: 'GA',
	HAWAII: 'HI',
	IDAHO: 'ID',
	ILLINOIS: 'IL',
	INDIANA: 'IN',
	IOWA: 'IA',
	KANSAS: 'KS',
	KENTUCKY: 'KY',
	LOUISIANA: 'LA',
	MAINE: 'ME',
	MARYLAND: 'MD',
	MASSACHUSETTS: 'MA',
	MICHIGAN: 'MI',
	MINNESOTA: 'MN',
	MISSISSIPPI: 'MS',
	MISSOURI: 'MO',
	MONTANA: 'MT',
	NEBRASKA: 'NE',
	NEVADA: 'NV',
	'NEW HAMPSHIRE': 'NH',
	'NEW JERSEY': 'NJ',
	'NEW MEXICO': 'NM',
	'NEW YORK': 'NY',
	'NORTH CAROLINA': 'NC',
	'NORTH DAKOTA': 'ND',
	OHIO: 'OH',
	OKLAHOMA: 'OK',
	OREGON: 'OR',
	PENNSYLVANIA: 'PA',
	'RHODE ISLAND': 'RI',
	'SOUTH CAROLINA': 'SC',
	'SOUTH DAKOTA': 'SD',
	TENNESSEE: 'TN',
	TEXAS: 'TX',
	UTAH: 'UT',
	VERMONT: 'VT',
	VIRGINIA: 'VA',
	WASHINGTON: 'WA',
	'WEST VIRGINIA': 'WV',
	WISCONSIN: 'WI',
	WYOMING: 'WY',
	'DISTRICT OF COLUMBIA': 'DC'
};

function normalizeState(state) {
	const raw = String(state || '')
		.trim()
		.toUpperCase();
	if (!raw) return null;
	if (raw.length === 2) return raw;
	return STATE_ABBREVIATIONS[raw] || raw;
}

function normalizeDistrict(district) {
	if (district == null || district === '') return null;
	return String(district).trim();
}

function latestElectionYear(result) {
	const years = Array.isArray(result?.election_years) ? result.election_years : [];
	return years.reduce((max, year) => (Number(year) > max ? Number(year) : max), 0);
}

function scoreCandidateResult(result, criteria = {}) {
	let score = 0;

	if (criteria.state && result?.state === criteria.state) score += 50;
	if (criteria.office && result?.office === criteria.office) score += 50;
	if (criteria.district && String(result?.district || '') === criteria.district) score += 15;
	score += latestElectionYear(result) / 10000;

	return score;
}

function chooseBestCandidateResult(results, criteria = {}) {
	if (!Array.isArray(results) || results.length === 0) {
		return null;
	}

	const ranked = results
		.map((result) => ({
			result,
			score: scoreCandidateResult(result, criteria)
		}))
		.sort((a, b) => b.score - a.score);

	return ranked[0]?.result || null;
}

function stripMiddleInitial(fullName) {
	const trimmed = String(fullName || '').trim();
	if (!trimmed.includes(',')) {
		return trimmed;
	}

	const [lastNamePart, givenNamesPart] = trimmed.split(',', 2);
	const givenNames = givenNamesPart.trim().split(/\s+/).filter(Boolean);

	if (givenNames.length < 2) {
		return trimmed;
	}

	const normalizedGivenNames = givenNames.filter((name, index) => {
		if (index === 0) {
			return true;
		}

		return !/^[A-Z]\.?$/i.test(name);
	});

	if (normalizedGivenNames.length === givenNames.length) {
		return trimmed;
	}

	return `${lastNamePart.trim()}, ${normalizedGivenNames.join(' ')}`.trim();
}

function extractLastNameQuery(fullName) {
	const trimmed = String(fullName || '').trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.includes(',')) {
		return trimmed.split(',', 1)[0]?.trim() || null;
	}

	const parts = trimmed.split(/\s+/).filter(Boolean);
	return parts.length > 1 ? parts[parts.length - 1] : null;
}

/**
 * Resolve a FEC candidate_id via OpenFEC candidate search.
 * Congress.gov list names are usually "Last, First" — same format the API already used elsewhere.
 *
 * @param {string} fullName
 * @param {string} apiKey OPENFEC_API_KEY (backticks stripped by caller if needed)
 * @param {Record<string, unknown> & { state?: string, office?: string, district?: string|number }} [logContext]
 * Optional fields (e.g. bioguideId, source) for filtering and failure logs
 * @returns {Promise<string|null>}
 */
export async function lookupFecCandidateId(fullName, apiKey, logContext = {}) {
	if (!fullName?.trim() || !apiKey?.trim()) return null;
	const key = apiKey.replace(/`/g, '').trim();
	const queryVariants = [fullName.trim()];
	const strippedQuery = stripMiddleInitial(fullName);
	if (strippedQuery && strippedQuery !== queryVariants[0]) {
		queryVariants.push(strippedQuery);
	}
	const lastNameQuery = extractLastNameQuery(fullName);
	if (lastNameQuery && !queryVariants.includes(lastNameQuery)) {
		queryVariants.push(lastNameQuery);
	}
	const criteria = {
		state: normalizeState(logContext.state),
		office: normalizeOffice(logContext.office),
		district: normalizeDistrict(logContext.district)
	};

	const buildSearchUrl = ({ includeFilters, query }) => {
		const u = new URL('https://api.open.fec.gov/v1/candidates/search/');
		u.searchParams.set('api_key', key);
		u.searchParams.set('q', query);
		u.searchParams.set('sort_hide_null', 'false');
		u.searchParams.set('sort_null_only', 'false');
		if (includeFilters && criteria.state) u.searchParams.set('state', criteria.state);
		if (includeFilters && criteria.office) u.searchParams.set('office', criteria.office);
		return u;
	};

	const executeSearch = async ({ includeFilters, query }) => {
		const u = buildSearchUrl({ includeFilters, query });
		console.log('[OpenFEC candidate search] requesting', {
			...logContext,
			query: query.slice(0, 80),
			state: criteria.state,
			office: criteria.office,
			district: criteria.district,
			filtered: includeFilters,
			url: u.toString()
		});

		const searchRes = await fetch(u);

		if (searchRes.status === 429) {
			let bodySnippet = '';
			try {
				bodySnippet = (await searchRes.text()).slice(0, 400);
			} catch {
				/* ignore */
			}
			console.warn(
				'[OpenFEC candidate search] rate limited (429); stop further OpenFEC calls in this flow',
				{
					...logContext,
					query: query.slice(0, 80),
					body: bodySnippet || undefined
				}
			);
			throw new OpenFECRateLimitError('OpenFEC candidates/search returned 429');
		}

		if (!searchRes.ok) {
			let bodySnippet = '';
			try {
				bodySnippet = (await searchRes.text()).slice(0, 800);
			} catch {
				/* ignore */
			}
			console.warn('[OpenFEC candidate search] request failed', {
				...logContext,
				query: query.slice(0, 80),
				status: searchRes.status,
				statusText: searchRes.statusText,
				body: bodySnippet || undefined
			});
			return null;
		}

		let sJson;
		try {
			const bodyText = await searchRes.text();
			console.log('[OpenFEC candidate search] response preview', {
				...logContext,
				query: query.slice(0, 80),
				status: searchRes.status,
				filtered: includeFilters,
				body: bodyText.slice(0, 1200)
			});
			sJson = bodyText ? JSON.parse(bodyText) : null;
		} catch (parseErr) {
			console.warn('[OpenFEC candidate search] response was not JSON', {
				...logContext,
				query: query.slice(0, 80),
				error: parseErr?.message || String(parseErr)
			});
			return null;
		}

		return sJson;
	};

	let sJson = null;
	let best = null;
	let resolvedQuery = queryVariants[0];

	for (const query of queryVariants) {
		sJson = await executeSearch({ includeFilters: true, query });
		best = chooseBestCandidateResult(sJson?.results, criteria);

		if (!best && (criteria.state || criteria.office)) {
			sJson = await executeSearch({ includeFilters: false, query });
			best = chooseBestCandidateResult(sJson?.results, criteria);
		}

		if (best?.candidate_id) {
			resolvedQuery = query;
			break;
		}
	}

	const id = best?.candidate_id;
	if (!id) {
		const preview = JSON.stringify(sJson).slice(0, 1500);
		console.warn('[OpenFEC candidate search] no FEC candidate_id resolved', {
			...logContext,
			query: queryVariants[0].slice(0, 80),
			fallbackQuery: queryVariants[1]?.slice(0, 80) || null,
			state: criteria.state,
			office: criteria.office,
			district: criteria.district,
			resultsLength: Array.isArray(sJson?.results) ? sJson.results.length : null,
			pagination: sJson?.pagination,
			responsePreview: preview
		});
		return null;
	}

	console.log('[OpenFEC candidate search] selected candidate', {
		...logContext,
		query: resolvedQuery.slice(0, 80),
		candidate_id: String(id),
		state: best.state || null,
		office: best.office || null,
		district: best.district || null,
		latestElectionYear: latestElectionYear(best) || null
	});

	return String(id);
}
