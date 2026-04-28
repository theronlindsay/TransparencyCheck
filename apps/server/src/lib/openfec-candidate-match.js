function compact(value) {
	return String(value || '')
		.toUpperCase()
		.replace(/[^A-Z0-9,\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function stripSuffixes(tokens) {
	return tokens.filter((token) => !['JR', 'SR', 'II', 'III', 'IV', 'V'].includes(token));
}

export function normalizePersonName(value) {
	const raw = compact(value);
	if (!raw) {
		return {
			raw: '',
			canonical: '',
			first: '',
			last: '',
			tokens: []
		};
	}

	let firstPart = raw;
	let lastPart = '';

	if (raw.includes(',')) {
		const [left, ...rest] = raw.split(',');
		lastPart = compact(left);
		firstPart = compact(rest.join(' '));
	}

	const firstTokens = stripSuffixes(firstPart.split(' ').filter(Boolean));
	const lastTokens = stripSuffixes(lastPart.split(' ').filter(Boolean));
	const tokens = [...firstTokens, ...lastTokens].filter(Boolean);

	return {
		raw,
		canonical: tokens.join(' ').trim(),
		first: firstTokens[0] || '',
		last: lastTokens[0] || firstTokens[firstTokens.length - 1] || '',
		tokens
	};
}

export function normalizeBranch(value) {
	const raw = compact(value);
	if (!raw) return null;
	if (raw.includes('SENATE') || raw === 'S') return 'S';
	if (raw.includes('HOUSE') || raw.includes('REPRESENTATIVE') || raw === 'H') return 'H';
	return null;
}

export function normalizeParty(value) {
	const raw = compact(value);
	if (!raw) return null;
	if (raw.startsWith('DEM')) return 'DEM';
	if (raw.startsWith('REP')) return 'REP';
	if (raw.startsWith('IND')) return 'IND';
	return raw;
}

function candidateName(candidate) {
	if (candidate?.name) return candidate.name;
	const parts = [candidate?.last_name, candidate?.first_name, candidate?.middle_name].filter(Boolean);
	return parts.join(', ');
}

function candidateState(candidate) {
	return compact(candidate?.state || candidate?.state_abbreviation || candidate?.candidate_state || '').trim() || null;
}

function candidateBranch(candidate) {
	return normalizeBranch(candidate?.office || candidate?.office_full || candidate?.office_sought_full || candidate?.office_sought);
}

function candidateParty(candidate) {
	return normalizeParty(candidate?.party_full || candidate?.party || candidate?.party_affiliation);
}

function candidateRecentYear(candidate) {
	const years = [];
	for (const value of [
		...(Array.isArray(candidate?.election_years) ? candidate.election_years : []),
		...(Array.isArray(candidate?.cycles) ? candidate.cycles : []),
		candidate?.election_year,
		candidate?.active_through
	]) {
		const year = Number.parseInt(String(value), 10);
		if (Number.isFinite(year)) years.push(year);
	}
	return years.length > 0 ? Math.max(...years) : null;
}

function buildNameScore(target, candidate) {
	if (!target.canonical || !candidate.canonical) return 0;
	if (target.canonical === candidate.canonical) return 120;
	if (target.first && target.last && target.first === candidate.first && target.last === candidate.last) {
		return 110;
	}
	if (target.last && candidate.last && target.last === candidate.last) {
		if (target.first && candidate.first && target.first[0] === candidate.first[0]) return 92;
		return 72;
	}

	const candidateTokens = new Set(candidate.tokens);
	let overlap = 0;
	for (const token of target.tokens) {
		if (candidateTokens.has(token)) overlap++;
	}
	return overlap >= 2 ? 60 + overlap * 5 : 0;
}

export function evaluateCandidateMatch(candidate, matchContext = {}) {
	const targetName = normalizePersonName(matchContext.fullName);
	const matchedName = normalizePersonName(candidateName(candidate));
	const targetState = compact(matchContext.state || '').trim() || null;
	const targetBranch = normalizeBranch(matchContext.branch);
	const targetParty = normalizeParty(matchContext.party);
	const matchedState = candidateState(candidate);
	const matchedBranch = candidateBranch(candidate);
	const matchedParty = candidateParty(candidate);

	if (targetState && matchedState && targetState !== matchedState) {
		return { score: -Infinity, reason: 'state-mismatch' };
	}
	if (targetBranch && matchedBranch && targetBranch !== matchedBranch) {
		return { score: -Infinity, reason: 'branch-mismatch' };
	}

	let score = buildNameScore(targetName, matchedName);
	if (score === 0) {
		return { score: 0, reason: 'name-mismatch' };
	}

	if (targetState && matchedState && targetState === matchedState) score += 25;
	if (targetBranch && matchedBranch && targetBranch === matchedBranch) score += 25;
	if (targetParty && matchedParty && targetParty === matchedParty) score += 8;
	if (targetParty && matchedParty && targetParty !== matchedParty) score -= 12;

	const recentYear = candidateRecentYear(candidate);
	const currentYear = new Date().getFullYear();
	if (recentYear != null) {
		if (recentYear >= currentYear - 2) score += 6;
		else if (recentYear < currentYear - 8) score -= 8;
	}

	if (compact(candidate?.incumbent_challenge_full || '').includes('INCUMBENT')) {
		score += 4;
	}

	return {
		score,
		reason: 'ok',
		details: {
			targetName: targetName.canonical,
			candidateName: matchedName.canonical,
			targetState,
			matchedState,
			targetBranch,
			matchedBranch,
			targetParty,
			matchedParty,
			recentYear
		}
	};
}

export function selectBestCandidateMatch(candidates, matchContext = {}) {
	const evaluated = (Array.isArray(candidates) ? candidates : [])
		.map((candidate) => ({
			candidate,
			...evaluateCandidateMatch(candidate, matchContext)
		}))
		.filter((row) => Number.isFinite(row.score) && row.score > 0)
		.sort((a, b) => b.score - a.score);

	if (evaluated.length === 0) {
		return { match: null, reason: 'no-viable-candidates', candidates: [] };
	}

	const best = evaluated[0];
	const second = evaluated[1];
	if (best.score < 110) {
		return { match: null, reason: 'low-confidence', candidates: evaluated.slice(0, 3) };
	}
	if (second && best.score - second.score < 12) {
		return { match: null, reason: 'ambiguous', candidates: evaluated.slice(0, 3) };
	}

	return { match: best.candidate, reason: 'matched', candidates: evaluated.slice(0, 3) };
}
