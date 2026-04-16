import { OpenFECRateLimitError } from '$lib/openfec-errors.js';
import { selectBestCandidateMatch } from '$lib/openfec-candidate-match.js';

/** True if we already have a non-empty FEC candidate id (skip OpenFEC name search). */
export function hasStoredFecCandidateId(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Resolve a FEC candidate_id via OpenFEC candidate search (first result).
 * Congress.gov list names are usually "Last, First" — same format the API already used elsewhere.
 *
 * @param {string} fullName
 * @param {string} apiKey OPENFEC_API_KEY (backticks stripped by caller if needed)
 * @param {{
 *   state?: string | null,
 *   branch?: string | null,
 *   party?: string | null,
 *   logContext?: Record<string, unknown>
 * }} [options]
 * @returns {Promise<string|null>}
 */
export async function lookupFecCandidateId(fullName, apiKey, options = {}) {
	if (!fullName?.trim() || !apiKey?.trim()) return null;
	const { state = null, branch = null, party = null, logContext = {} } = options;
	const key = apiKey.replace(/`/g, '').trim();
	const u = new URL('https://api.open.fec.gov/v1/candidates/search/');
	u.searchParams.set('api_key', key);
	u.searchParams.set('q', fullName.trim());
	u.searchParams.set('sort_hide_null', 'false');
	u.searchParams.set('sort_null_only', 'false');

	const searchRes = await fetch(u);

	if (searchRes.status === 429) {
		let bodySnippet = '';
		try {
			bodySnippet = (await searchRes.text()).slice(0, 400);
		} catch {
			/* ignore */
		}
		console.warn('[OpenFEC candidate search] rate limited (429); stop further OpenFEC calls in this flow', {
			...logContext,
			query: fullName.trim().slice(0, 80),
			body: bodySnippet || undefined
		});
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
			query: fullName.trim().slice(0, 80),
			status: searchRes.status,
			statusText: searchRes.statusText,
			body: bodySnippet || undefined
		});
		return null;
	}

	let sJson;
	try {
		sJson = await searchRes.json();
	} catch (parseErr) {
		console.warn('[OpenFEC candidate search] response was not JSON', {
			...logContext,
			query: fullName.trim().slice(0, 80),
			error: parseErr?.message || String(parseErr)
		});
		return null;
	}

	const selection = selectBestCandidateMatch(sJson.results, {
		fullName,
		state,
		branch,
		party
	});
	const id = selection.match?.candidate_id;
	if (!id) {
		const preview = JSON.stringify(sJson).slice(0, 1500);
		console.warn('[OpenFEC candidate search] no confident FEC candidate_id resolved', {
			...logContext,
			query: fullName.trim().slice(0, 80),
			state: state || undefined,
			branch: branch || undefined,
			party: party || undefined,
			matchReason: selection.reason,
			resultsLength: Array.isArray(sJson.results) ? sJson.results.length : null,
			topCandidates: selection.candidates.map((row) => ({
				candidate_id: row.candidate?.candidate_id,
				name: row.candidate?.name,
				state: row.candidate?.state,
				office: row.candidate?.office_full || row.candidate?.office,
				party: row.candidate?.party_full || row.candidate?.party,
				score: row.score
			})),
			pagination: sJson.pagination,
			responsePreview: preview
		});
		return null;
	}

	return String(id);
}
