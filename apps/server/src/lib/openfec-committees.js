import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

function normalizeCommittee(record) {
	return {
		committeeId: record?.committee_id || null,
		name: record?.name || record?.committee_name || 'Unknown committee',
		designation: record?.designation || null,
		designationFull: record?.designation_full || null,
		type: record?.committee_type || null,
		typeFull: record?.committee_type_full || null,
		filingFrequency: record?.filing_frequency || null,
		isPrincipal: record?.designation === 'P',
		isAuthorized: ['P', 'A', 'J'].includes(record?.designation)
	};
}

export function splitCandidateCommittees(committees = []) {
	const normalized = committees.filter((committee) => committee?.committeeId);
	const principal = normalized.filter((committee) => committee.isPrincipal);
	const authorized = normalized.filter((committee) => committee.isAuthorized);

	return {
		principal,
		authorized
	};
}

export async function fetchCandidateCommittees(fecCandidateId, apiKey, logContext = {}) {
	const committees = [];
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages) {
		const url = new URL(
			`https://api.open.fec.gov/v1/candidate/${encodeURIComponent(fecCandidateId)}/committees/`
		);
		url.searchParams.set('api_key', apiKey);
		url.searchParams.set('page', String(page));
		url.searchParams.set('per_page', '100');
		url.searchParams.set('sort', 'name');
		url.searchParams.set('sort_hide_null', 'false');
		url.searchParams.set('sort_null_only', 'false');

		console.log('[OpenFEC committees] requesting', {
			...logContext,
			fecCandidateId,
			page,
			url: url.toString()
		});

		const res = await fetch(url.toString());
		if (res.status === 429) {
			throw new OpenFECRateLimitError('OpenFEC candidate committees returned 429');
		}

		const bodyText = await res.text();
		console.log('[OpenFEC committees] response preview', {
			...logContext,
			fecCandidateId,
			page,
			status: res.status,
			body: bodyText.slice(0, 1200)
		});

		if (!res.ok) {
			break;
		}

		const json = bodyText ? JSON.parse(bodyText) : {};
		const results = Array.isArray(json.results) ? json.results : [];
		totalPages = Number(json.pagination?.pages) || 1;
		for (const result of results) {
			committees.push(normalizeCommittee(result));
		}

		if (results.length === 0) {
			break;
		}

		page++;
	}

	return committees.filter((committee, index, all) => {
		if (!committee.committeeId) {
			return false;
		}

		return all.findIndex((entry) => entry.committeeId === committee.committeeId) === index;
	});
}

export async function fetchCommitteeTotals(committeeId, apiKey, logContext = {}) {
	const url = new URL(
		`https://api.open.fec.gov/v1/committee/${encodeURIComponent(committeeId)}/totals/`
	);
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('sort', '-cycle');
	url.searchParams.set('per_page', '1');
	url.searchParams.set('sort_hide_null', 'false');
	url.searchParams.set('sort_null_only', 'false');

	console.log('[OpenFEC committee totals] requesting', {
		...logContext,
		committeeId,
		url: url.toString()
	});

	const res = await fetch(url.toString());
	if (res.status === 429) {
		throw new OpenFECRateLimitError('OpenFEC committee totals returned 429');
	}

	const bodyText = await res.text();
	console.log('[OpenFEC committee totals] response preview', {
		...logContext,
		committeeId,
		status: res.status,
		body: bodyText.slice(0, 1200)
	});

	if (!res.ok) {
		return {
			receipts: 0,
			disbursements: 0,
			cash_on_hand: 0
		};
	}

	const json = bodyText ? JSON.parse(bodyText) : {};
	const result = Array.isArray(json.results) ? json.results[0] : null;

	return {
		receipts: Number(result?.receipts) || 0,
		disbursements: Number(result?.disbursements) || 0,
		cash_on_hand:
			Number(result?.cash_on_hand_end_period ?? result?.last_cash_on_hand_end_period) || 0
	};
}
