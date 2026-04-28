export function normalizeCommitteeScope(value) {
	return value === 'principal' ? 'principal' : 'authorized';
}

function normalizeBillId(value) {
	return String(value || '')
		.trim()
		.toLowerCase();
}

function emptyFinanceTotals(overrides = {}) {
	return {
		receipts: 0,
		disbursements: 0,
		cash_on_hand: 0,
		...overrides
	};
}

function normalizeNumeric(value, fallback = 0) {
	return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function emptyFinancialScope(scope = 'authorized', overrides = {}) {
	return {
		scope: normalizeCommitteeScope(scope),
		committeeIds: [],
		totals: emptyFinanceTotals(),
		donors: [],
		...overrides
	};
}

export function emptyFinancialData(overrides = {}) {
	const defaultScope = emptyFinancialScope('authorized');

	return {
		fecCandidateId: null,
		committees: [],
		scopeData: {
			principal: emptyFinancialScope('principal'),
			authorized: defaultScope
		},
		selectedScope: 'authorized',
		includedCommitteeIds: [],
		includedCommittees: [],
		totals: defaultScope.totals,
		donors: defaultScope.donors,
		lastSyncedAt: null,
		donorAggVersion: 0,
		...overrides
	};
}

export function emptyStockData(overrides = {}) {
	return {
		trades: [],
		lastSyncedAt: null,
		...overrides
	};
}

export function normalizeSponsoredBills(bills = []) {
	if (!Array.isArray(bills)) {
		return [];
	}

	return bills
		.map((bill) => {
			const billId = normalizeBillId(bill?.billId || bill?.number);
			const displayTitle = bill?.displayTitle || bill?.title || 'Untitled';
			if (!billId && !displayTitle) {
				return null;
			}

			return {
				billId: billId || null,
				displayTitle,
				introducedDate: bill?.introducedDate || '',
				congress: bill?.congress ?? null
			};
		})
		.filter(Boolean);
}

export function normalizeFinancialData(value) {
	if (!value || typeof value !== 'object') {
		return emptyFinancialData();
	}

	const selectedScope = normalizeCommitteeScope(value.selectedScope);
	const legacyTotals = emptyFinanceTotals({
		receipts: normalizeNumeric(value.totals?.receipts),
		disbursements: normalizeNumeric(value.totals?.disbursements),
		cash_on_hand: normalizeNumeric(value.totals?.cash_on_hand)
	});
	const legacyDonors = Array.isArray(value.donors) ? value.donors : [];
	const committees = Array.isArray(value.committees) ? value.committees : [];
	const principalScope = emptyFinancialScope('principal', {
		committeeIds: Array.isArray(value.scopeData?.principal?.committeeIds)
			? value.scopeData.principal.committeeIds
			: [],
		totals: emptyFinanceTotals({
			receipts: normalizeNumeric(
				value.scopeData?.principal?.totals?.receipts,
				legacyTotals.receipts
			),
			disbursements: normalizeNumeric(
				value.scopeData?.principal?.totals?.disbursements,
				legacyTotals.disbursements
			),
			cash_on_hand: normalizeNumeric(
				value.scopeData?.principal?.totals?.cash_on_hand,
				legacyTotals.cash_on_hand
			)
		}),
		donors: Array.isArray(value.scopeData?.principal?.donors)
			? value.scopeData.principal.donors
			: legacyDonors
	});
	const authorizedScope = emptyFinancialScope('authorized', {
		committeeIds: Array.isArray(value.scopeData?.authorized?.committeeIds)
			? value.scopeData.authorized.committeeIds
			: [],
		totals: emptyFinanceTotals({
			receipts: normalizeNumeric(
				value.scopeData?.authorized?.totals?.receipts,
				legacyTotals.receipts
			),
			disbursements: normalizeNumeric(
				value.scopeData?.authorized?.totals?.disbursements,
				legacyTotals.disbursements
			),
			cash_on_hand: normalizeNumeric(
				value.scopeData?.authorized?.totals?.cash_on_hand,
				legacyTotals.cash_on_hand
			)
		}),
		donors: Array.isArray(value.scopeData?.authorized?.donors)
			? value.scopeData.authorized.donors
			: legacyDonors
	});
	const activeScope = selectedScope === 'principal' ? principalScope : authorizedScope;
	const includedCommitteeIds = activeScope.committeeIds;
	const includedCommittees = committees.filter((committee) =>
		includedCommitteeIds.includes(committee.committeeId)
	);

	return emptyFinancialData({
		fecCandidateId: value.fecCandidateId || null,
		committees,
		scopeData: {
			principal: principalScope,
			authorized: authorizedScope
		},
		selectedScope,
		includedCommitteeIds,
		includedCommittees,
		totals: activeScope.totals,
		donors: activeScope.donors,
		lastSyncedAt: value.lastSyncedAt || null,
		donorAggVersion: normalizeNumeric(value.donorAggVersion)
	});
}

export function normalizeStockData(value) {
	if (!value || typeof value !== 'object') {
		return emptyStockData();
	}

	return emptyStockData({
		trades: Array.isArray(value.trades) ? value.trades : [],
		lastSyncedAt: value.lastSyncedAt || null
	});
}

export function mapPersonSummary(person) {
	return {
		bioguideId: person._id,
		name: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
		partyName: person.party || '',
		state: person.state || '',
		chamber: person.branch || 'Unknown',
		imageUrl: person.imageUrl || null,
		fec_candidate_id: person.fec_candidate_id || null
	};
}

export function mapPersonDetail(person) {
	const name = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();

	return {
		id: person._id,
		name,
		chamber: person.branch || 'Unknown',
		role: person.branch || 'Unknown',
		party: person.party || '',
		description: `Representative from ${person.state || 'Unknown'}${person.district ? ` - District ${person.district}` : ''}`,
		state: person.state || '',
		headshotUrl: person.imageUrl || '/placeholder-profile.svg',
		fec_candidate_id: person.fec_candidate_id || null,
		sponsoredBills: normalizeSponsoredBills(person.sponsoredBills),
		url: person.url || null,
		financeData: normalizeFinancialData(person.financialData),
		stockData: normalizeStockData(person.stockData)
	};
}
