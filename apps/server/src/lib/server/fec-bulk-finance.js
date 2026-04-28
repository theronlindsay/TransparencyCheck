import { splitCandidateCommittees } from '$lib/openfec-committees.js';
import {
	currentCycleYear,
	getFecBulkImportStatus,
	FEC_BULK_FINANCE_DATASETS
} from '$lib/server/fec-bulk-import.js';

function normalizeCommitteeDocument(link, committeeDoc) {
	const designation = committeeDoc?.designation || link?.committeeDesignation || null;
	const type = committeeDoc?.type || link?.committeeType || null;

	return {
		committeeId: link?.committeeId || committeeDoc?.committeeId || null,
		name: committeeDoc?.name || 'Unknown committee',
		designation,
		designationFull: null,
		type,
		typeFull: null,
		filingFrequency: committeeDoc?.filingFrequency || null,
		isPrincipal: designation === 'P',
		isAuthorized: ['P', 'A', 'J'].includes(designation)
	};
}

async function loadCandidateCommitteeLinks(db, fecCandidateId, cycle) {
	const links = await db
		.collection('fec_candidate_committee_links')
		.find({ candidateId: fecCandidateId })
		.sort({ fecElectionYear: -1, committeeId: 1 })
		.toArray();

	if (links.length === 0) {
		return [];
	}

	const exactCycleLinks = links.filter((link) => Number(link.fecElectionYear) === Number(cycle));
	return exactCycleLinks.length > 0 ? exactCycleLinks : links;
}

async function loadCandidateMasterRecord(db, fecCandidateId, cycle) {
	const exact = await db.collection('fec_candidates').findOne({
		candidateId: fecCandidateId,
		electionYear: cycle
	});
	if (exact) {
		return exact;
	}

	return await db
		.collection('fec_candidates')
		.find({ candidateId: fecCandidateId })
		.sort({ electionYear: -1 })
		.limit(1)
		.next();
}

export async function loadLocalCandidateCommittees(db, fecCandidateId, cycle = currentCycleYear()) {
	const links = await loadCandidateCommitteeLinks(db, fecCandidateId, cycle);
	const candidateRecord = await loadCandidateMasterRecord(db, fecCandidateId, cycle);
	const committeeIds = new Set(links.map((link) => link.committeeId).filter(Boolean));

	if (committeeIds.size === 0 && candidateRecord?.principalCommitteeId) {
		committeeIds.add(candidateRecord.principalCommitteeId);
		links.push({
			committeeId: candidateRecord.principalCommitteeId,
			committeeDesignation: 'P',
			committeeType: null
		});
	}

	if (committeeIds.size === 0) {
		return [];
	}

	const committeeDocs = await db
		.collection('fec_committees')
		.find({ committeeId: { $in: [...committeeIds] } })
		.toArray();
	const committeeMap = new Map(committeeDocs.map((doc) => [doc.committeeId, doc]));

	return links
		.map((link) => normalizeCommitteeDocument(link, committeeMap.get(link.committeeId)))
		.filter((committee, index, all) => {
			if (!committee.committeeId) {
				return false;
			}

			return all.findIndex((entry) => entry.committeeId === committee.committeeId) === index;
		});
}

export async function loadLocalCommitteeTotals(db, committeeIds, cycle = currentCycleYear()) {
	if (!Array.isArray(committeeIds) || committeeIds.length === 0) {
		return new Map();
	}

	const docs = await db
		.collection('fec_committee_summaries')
		.find({ committeeId: { $in: committeeIds } })
		.sort({ fecElectionYear: -1 })
		.toArray();

	const totalsByCommitteeId = new Map();
	for (const doc of docs) {
		if (!doc?.committeeId || totalsByCommitteeId.has(doc.committeeId)) {
			continue;
		}

		if (doc.fecElectionYear && Number(doc.fecElectionYear) !== Number(cycle)) {
			const hasCycleDoc = docs.some(
				(entry) =>
					entry.committeeId === doc.committeeId && Number(entry.fecElectionYear) === Number(cycle)
			);
			if (hasCycleDoc) {
				continue;
			}
		}

		totalsByCommitteeId.set(doc.committeeId, {
			receipts: Number(doc.totalReceipts) || 0,
			disbursements: Number(doc.totalDisbursements) || 0,
			cash_on_hand: Number(doc.cashOnHandClosing) || 0
		});
	}

	return totalsByCommitteeId;
}

export async function loadLocalIndividualDonorRows(db, committeeIds, maxDonors = 150) {
	if (!Array.isArray(committeeIds) || committeeIds.length === 0) {
		return [];
	}

	const grouped = await db
		.collection('fec_individual_contributions')
		.aggregate([
			{
				$match: {
					committeeId: { $in: committeeIds },
					transactionAmount: { $gt: 0 },
					donorName: { $nin: [null, ''] }
				}
			},
			{
				$group: {
					_id: { $toLower: '$donorName' },
					donorName: { $first: '$donorName' },
					amount: { $sum: '$transactionAmount' },
					date: { $max: '$transactionDate' }
				}
			},
			{ $sort: { amount: -1, donorName: 1 } },
			{ $limit: maxDonors }
		])
		.toArray();

	return grouped.map((entry) => ({
		donorName: entry.donorName,
		amount: Number(entry.amount) || 0,
		date: entry.date || ''
	}));
}

export async function getLocalBulkCoverage(db, cycle = currentCycleYear()) {
	const [committeeSummaryStatus, individualStatus, committeeTransactionStatus] = await Promise.all(
		FEC_BULK_FINANCE_DATASETS.map((datasetKey) => getFecBulkImportStatus(db, datasetKey, cycle))
	);

	return {
		committeeSummariesImported: Boolean(committeeSummaryStatus?.lastImportedAt),
		individualContributionsImported: Boolean(individualStatus?.lastImportedAt),
		committeeTransactionsImported: Boolean(committeeTransactionStatus?.lastImportedAt)
	};
}

export async function buildLocalFinanceSnapshot(db, fecCandidateId, options = {}) {
	const cycle = options.cycle ?? currentCycleYear();
	const maxDonors = options.maxDonors ?? 150;
	const coverage = await getLocalBulkCoverage(db, cycle);
	const committees = await loadLocalCandidateCommittees(db, fecCandidateId, cycle);

	if (committees.length === 0) {
		return {
			committees: [],
			principal: [],
			authorized: [],
			totalsByCommitteeId: new Map(),
			principalDonors: [],
			authorizedDonors: [],
			coverage
		};
	}

	const { principal, authorized } = splitCandidateCommittees(committees);
	const includedCommittees = authorized.length > 0 ? authorized : principal;
	const includedCommitteeIds = includedCommittees.map((committee) => committee.committeeId);
	const principalCommitteeIds = principal.map((committee) => committee.committeeId);
	const totalsByCommitteeId = coverage.committeeSummariesImported
		? await loadLocalCommitteeTotals(db, includedCommitteeIds, cycle)
		: new Map();
	const principalDonors = coverage.individualContributionsImported
		? await loadLocalIndividualDonorRows(db, principalCommitteeIds, maxDonors)
		: [];
	const authorizedDonors = coverage.individualContributionsImported
		? await loadLocalIndividualDonorRows(db, includedCommitteeIds, maxDonors)
		: [];

	return {
		committees,
		principal,
		authorized: includedCommittees,
		totalsByCommitteeId,
		principalDonors,
		authorizedDonors,
		coverage
	};
}
