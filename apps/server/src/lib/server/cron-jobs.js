import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { FinanceProfile } from '$lib/db/models/FinanceProfile.js';
import { SavedBill } from '$lib/db/models/SavedBill.js';
import { Notification } from '$lib/db/models/Notification.js';
import {
	buildNameToIdMapFromDatabase,
	syncFmpStockTrades,
	logStockSyncSummary
} from '$lib/cron/stock-sync.js';
import {
	DONOR_AGG_VERSION,
	aggregateDonorRows,
	fetchDonorRowsMultiYear
} from '$lib/openfec-donors.js';
import { hasStoredFecCandidateId, lookupFecCandidateId } from '$lib/openfec-candidate.js';
import { OpenFECRateLimitError } from '$lib/openfec-errors.js';
import {
	fetchCandidateCommittees,
	fetchCommitteeTotals,
	splitCandidateCommittees
} from '$lib/openfec-committees.js';
import { fetchSponsoredBillsFromCongress } from '$lib/congress-sponsored-bills.js';
import {
	buildLocalFinanceSnapshot,
	loadLocalCandidateCommittees
} from '$lib/server/fec-bulk-finance.js';
import {
	currentCycleYear,
	FEC_BULK_FINANCE_DATASETS,
	FEC_BULK_METADATA_DATASETS,
	importFecBulkData
} from '$lib/server/fec-bulk-import.js';
import {
	emptyFinancialData,
	emptyStockData,
	normalizeCommitteeScope,
	normalizeSponsoredBills
} from '$lib/server/person-cache.js';

function truncate(value, max = 700) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

async function fetchJsonWithVerboseLogging(url, label, options) {
	console.log(`[Cron:${label}] Requesting ${url}`);
	const response = await fetch(url, options);
	const bodyText = await response.text();
	const preview = truncate(bodyText, 1200);

	console.log(`[Cron:${label}] Response ${response.status} ${response.statusText}`);
	console.log(`[Cron:${label}] Response preview: ${preview || '(empty body)'}`);

	let json = null;
	if (bodyText) {
		try {
			json = JSON.parse(bodyText);
		} catch (error) {
			console.warn(`[Cron:${label}] Failed to parse JSON: ${error.message}`);
		}
	}

	return { response, json, preview };
}

function memberChamber(member) {
	if (member.terms?.item?.length > 0) {
		return member.terms.item[member.terms.item.length - 1].chamber;
	}

	return 'Unknown';
}

async function runWithConcurrency(items, concurrency, worker) {
	const results = [];
	let nextIndex = 0;

	async function consume() {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await worker(items[index], index);
		}
	}

	const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () =>
		consume()
	);
	await Promise.all(workers);
	return results;
}

async function ensurePersonCacheFields(activeBioguideIds) {
	if (activeBioguideIds.length === 0) {
		return;
	}

	await Person.updateMany({ _id: { $in: activeBioguideIds } }, [
		{
			$set: {
				sponsoredBills: { $ifNull: ['$sponsoredBills', []] },
				financialData: { $ifNull: ['$financialData', emptyFinancialData()] },
				stockData: { $ifNull: ['$stockData', emptyStockData()] }
			}
		}
	]);
}

async function syncSponsoredBills(activeBioguideIds, congressKey) {
	const ids = [...activeBioguideIds];
	const summary = {
		processed: 0,
		updated: 0,
		failed: 0
	};

	if (!congressKey || ids.length === 0) {
		return summary;
	}

	const concurrency = Math.max(
		1,
		Number.parseInt(process.env.CONGRESS_MEMBER_SYNC_CONCURRENCY ?? '6', 10) || 6
	);

	await runWithConcurrency(ids, concurrency, async (bioguideId) => {
		summary.processed++;
		try {
			console.log(`[Cron:sync-finance] Fetching sponsored bills for ${bioguideId}`);
			const sponsoredBills = normalizeSponsoredBills(
				await fetchSponsoredBillsFromCongress(bioguideId, congressKey)
			);
			await Person.updateOne({ _id: bioguideId }, { $set: { sponsoredBills } });
			summary.updated++;
			console.log(
				`[Cron:sync-finance] Stored ${sponsoredBills.length} sponsored bill ids for ${bioguideId}`
			);
		} catch (error) {
			summary.failed++;
			console.error(`[Cron:sync-finance] Failed to sync sponsored bills for ${bioguideId}`, error);
		}
	});

	return summary;
}

async function updatePersonFinancialData(bioguideId, financialData, fecCandidateId = null) {
	await Person.updateOne(
		{ _id: bioguideId },
		{
			$set: {
				financialData,
				...(fecCandidateId ? { fec_candidate_id: fecCandidateId } : {})
			}
		}
	);
}

function sumFinanceTotals(totalsList = []) {
	return totalsList.reduce(
		(acc, totals) => ({
			receipts: acc.receipts + (Number(totals?.receipts) || 0),
			disbursements: acc.disbursements + (Number(totals?.disbursements) || 0),
			cash_on_hand: acc.cash_on_hand + (Number(totals?.cash_on_hand) || 0)
		}),
		{ receipts: 0, disbursements: 0, cash_on_hand: 0 }
	);
}

function committeeIds(committees = []) {
	return committees.map((committee) => committee.committeeId).filter(Boolean);
}

function buildFinancialScope(
	scope,
	committees,
	totalsByCommitteeId,
	donorRows,
	maxDonors = 150,
	options = {}
) {
	const ids = new Set(committeeIds(committees));
	const scopedTotals = sumFinanceTotals(
		committeeIds(committees).map((committeeId) => totalsByCommitteeId.get(committeeId))
	);

	return {
		scope: normalizeCommitteeScope(scope),
		committeeIds: committeeIds(committees),
		totals: scopedTotals,
		donors: options.alreadyAggregated
			? donorRows
			: aggregateDonorRows(
					donorRows.filter((row) => ids.has(row.committeeId)),
					maxDonors
				)
	};
}

function resolveOpenFecProfileLimit(activeCount) {
	const configuredLimit = process.env.OPENFEC_SYNC_PROFILE_LIMIT?.trim();

	if (!configuredLimit) {
		return activeCount;
	}

	const parsed = Number.parseInt(configuredLimit, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return activeCount;
	}

	return Math.min(activeCount, parsed);
}

function buildFecLookupContext(representative, source) {
	return {
		bioguideId: representative._id,
		source,
		state: representative.state,
		office: representative.branch,
		district: representative.district
	};
}

async function resolveRepresentativeFecId(representative, fecKey, source) {
	if (!representative) {
		throw new Error('Representative record is required.');
	}

	if (hasStoredFecCandidateId(representative.fec_candidate_id)) {
		return representative.fec_candidate_id.trim();
	}

	if (representative.fec_candidate_id_locked) {
		console.log(
			`[Cron:${source}] Skipping FEC lookup for ${representative._id}; candidate id is manually locked`
		);
		return null;
	}

	if (!representative.fullName || !fecKey) {
		return null;
	}

	console.log(
		`[Cron:${source}] Resolving missing FEC id for ${representative.fullName} (${representative._id})`
	);
	const fecId = await lookupFecCandidateId(
		representative.fullName,
		fecKey,
		buildFecLookupContext(representative, source)
	);

	if (fecId) {
		await Person.updateOne(
			{ _id: representative._id },
			{
				$set: {
					fec_candidate_id: fecId
				}
			}
		);
		console.log(`[Cron:${source}] Stored FEC candidate id ${fecId} for ${representative.fullName}`);
	}

	return fecId;
}

function hasValidTotalsForCommittees(committees, totalsByCommitteeId) {
	if (!Array.isArray(committees) || committees.length === 0) {
		return false;
	}

	return committeeIds(committees).every((committeeId) => totalsByCommitteeId.has(committeeId));
}

async function buildRepresentativeFinanceFromBulk(db, fecId, source, bioguideId) {
	const bulkSnapshot = await buildLocalFinanceSnapshot(db, fecId, {
		cycle: currentCycleYear(),
		maxDonors: 150
	});

	console.log(`[Cron:${source}] Local bulk coverage for ${bioguideId}`, bulkSnapshot.coverage);
	return bulkSnapshot;
}

async function resolveRepresentativeCommittees(db, fecId, fecKey, source, bioguideId) {
	const localCommittees = await loadLocalCandidateCommittees(db, fecId, currentCycleYear());
	if (localCommittees.length > 0) {
		console.log(
			`[Cron:${source}] Using ${localCommittees.length} locally linked committees for ${bioguideId}`
		);
		return localCommittees;
	}

	if (!fecKey) {
		return [];
	}

	return await fetchCandidateCommittees(fecId, fecKey, {
		bioguideId,
		source
	});
}

async function resolveTotalsByCommitteeId(db, committees, fecId, fecKey, source, bioguideId) {
	const localSnapshot = await buildRepresentativeFinanceFromBulk(db, fecId, source, bioguideId);
	if (hasValidTotalsForCommittees(committees, localSnapshot.totalsByCommitteeId)) {
		console.log(`[Cron:${source}] Using local bulk committee summaries for ${bioguideId}`);
		return {
			totalsByCommitteeId: localSnapshot.totalsByCommitteeId,
			bulkSnapshot: localSnapshot
		};
	}

	if (!fecKey) {
		return {
			totalsByCommitteeId: localSnapshot.totalsByCommitteeId,
			bulkSnapshot: localSnapshot
		};
	}

	const totalsByCommitteeId = new Map(localSnapshot.totalsByCommitteeId);
	for (const committee of committees) {
		if (totalsByCommitteeId.has(committee.committeeId)) {
			continue;
		}

		totalsByCommitteeId.set(
			committee.committeeId,
			await fetchCommitteeTotals(committee.committeeId, fecKey, {
				bioguideId,
				source,
				fecCandidateId: fecId
			})
		);
	}

	return {
		totalsByCommitteeId,
		bulkSnapshot: localSnapshot
	};
}

async function resolveDonorRows(db, committees, fecKey, source, bulkSnapshot) {
	if (bulkSnapshot.coverage.individualContributionsImported) {
		console.log(`[Cron:${source}] Using local bulk individual contributions`);
		return null;
	}

	if (!fecKey) {
		return [];
	}

	return await fetchDonorRowsMultiYear(committees, fecKey, {
		periodCount: 4,
		pagesPerPeriod: 2,
		perPage: 100
	});
}

export async function refreshRepresentativeFecIdOnly(bioguideId, source = 'admin-refresh-fec-id') {
	await mongo();

	const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();
	if (!fecKey) {
		throw new Error('OPENFEC_API_KEY missing; OpenFEC lookup unavailable.');
	}

	const representative = await Person.findById(bioguideId).lean();
	if (!representative) {
		throw new Error(`Representative ${bioguideId} not found.`);
	}

	const previousFecId = representative.fec_candidate_id || null;
	const fecId = await resolveRepresentativeFecId(representative, fecKey, source);

	return {
		bioguideId,
		name: representative.fullName || bioguideId,
		previousFecCandidateId: previousFecId,
		fecCandidateId: fecId,
		changed: Boolean(fecId && fecId !== previousFecId),
		locked: Boolean(representative.fec_candidate_id_locked)
	};
}

export async function refreshAllRepresentativeFecIds(source = 'admin-refresh-fec-ids') {
	await mongo();

	const representatives = await Person.find({
		branch: { $in: ['Senate', 'House of Representatives'] },
		fullName: { $exists: true, $nin: [null, ''] }
	})
		.select('_id fullName fec_candidate_id fec_candidate_id_locked state district branch')
		.sort({ state: 1, district: 1, lastName: 1, firstName: 1, _id: 1 })
		.lean();

	const summary = {
		total: representatives.length,
		processed: 0,
		resolved: 0,
		unchanged: 0,
		lockedSkipped: 0,
		missingStillMissing: 0
	};

	for (const representative of representatives) {
		if (representative.fec_candidate_id_locked) {
			summary.lockedSkipped++;
			continue;
		}

		summary.processed++;
		const result = await refreshRepresentativeFecIdOnly(representative._id, source);

		if (result.changed) {
			summary.resolved++;
		} else if (result.fecCandidateId) {
			summary.unchanged++;
		} else {
			summary.missingStillMissing++;
		}
	}

	return summary;
}

export async function refreshRepresentativeFinancialData(bioguideId, source = 'admin-refresh') {
	const db = await mongo();

	const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();

	const representative = await Person.findById(bioguideId).lean();
	if (!representative) {
		throw new Error(`Representative ${bioguideId} not found.`);
	}

	const fecId =
		representative.fec_candidate_id && hasStoredFecCandidateId(representative.fec_candidate_id)
			? representative.fec_candidate_id.trim()
			: await resolveRepresentativeFecId(representative, fecKey, source);
	if (!fecId) {
		throw new Error(`No FEC candidate id available for ${bioguideId}.`);
	}

	const committees = await resolveRepresentativeCommittees(db, fecId, fecKey, source, bioguideId);
	if (committees.length === 0) {
		throw new Error(`No linked committees available for ${bioguideId}.`);
	}

	const { principal, authorized } = splitCandidateCommittees(committees);
	const includedCommittees = authorized.length > 0 ? authorized : principal;
	const { totalsByCommitteeId, bulkSnapshot } = await resolveTotalsByCommitteeId(
		db,
		includedCommittees,
		fecId,
		fecKey,
		source,
		bioguideId
	);
	const donorRows = await resolveDonorRows(db, includedCommittees, fecKey, source, bulkSnapshot);
	const useBulkDonors = bulkSnapshot.coverage.individualContributionsImported;
	const principalScope = buildFinancialScope(
		'principal',
		principal,
		totalsByCommitteeId,
		useBulkDonors ? bulkSnapshot.principalDonors : donorRows,
		150,
		{ alreadyAggregated: useBulkDonors }
	);
	const authorizedScope = buildFinancialScope(
		'authorized',
		includedCommittees,
		totalsByCommitteeId,
		useBulkDonors ? bulkSnapshot.authorizedDonors : donorRows,
		150,
		{ alreadyAggregated: useBulkDonors }
	);

	console.log(
		`[Cron:${source}] Aggregated ${authorizedScope.donors.length} donor rows for ${representative.fullName || bioguideId}`
	);

	const syncedAt = new Date();
	const financialData = emptyFinancialData({
		fecCandidateId: fecId,
		committees,
		scopeData: {
			principal: principalScope,
			authorized: authorizedScope
		},
		selectedScope: 'authorized',
		includedCommitteeIds: authorizedScope.committeeIds,
		totals: authorizedScope.totals,
		donors: authorizedScope.donors,
		lastSyncedAt: syncedAt,
		donorAggVersion: DONOR_AGG_VERSION
	});

	await FinanceProfile.updateOne(
		{ politicianId: bioguideId },
		{
			$set: {
				committees,
				scopeData: {
					principal: principalScope,
					authorized: authorizedScope
				},
				selectedScope: 'authorized',
				includedCommitteeIds: authorizedScope.committeeIds,
				totals: authorizedScope.totals,
				donors: authorizedScope.donors,
				lastSyncedAt: syncedAt,
				donorAggVersion: DONOR_AGG_VERSION,
				fecCandidateId: fecId
			}
		},
		{ upsert: true }
	);

	await updatePersonFinancialData(bioguideId, financialData, fecId);

	return {
		bioguideId,
		name: representative.fullName || bioguideId,
		fecCandidateId: fecId,
		committeeCount: committees.length,
		principalCommitteeCount: principal.length,
		authorizedCommitteeCount: includedCommittees.length,
		donorCount: authorizedScope.donors.length,
		dataSource: useBulkDonors ? 'fec-bulk' : 'openfec',
		lastSyncedAt: syncedAt.toISOString()
	};
}

export async function rebuildRepresentativeFinanceCachesFromBulk(
	source = 'fec-bulk-rebuild-caches'
) {
	await mongo();

	const representatives = await Person.find({
		branch: { $in: ['Senate', 'House of Representatives'] },
		$or: [
			{ fec_candidate_id: { $exists: true, $nin: [null, ''] } },
			{ fec_candidate_id_locked: true }
		]
	})
		.select('_id fullName fec_candidate_id fec_candidate_id_locked')
		.sort({ fullName: 1, _id: 1 })
		.lean();

	const summary = {
		total: representatives.length,
		processed: 0,
		rebuilt: 0,
		failed: 0
	};

	for (const representative of representatives) {
		if (!hasStoredFecCandidateId(representative.fec_candidate_id)) {
			continue;
		}

		summary.processed++;
		try {
			await refreshRepresentativeFinancialData(representative._id, source);
			summary.rebuilt++;
		} catch (error) {
			summary.failed++;
			console.error(
				`[Cron:${source}] Failed to rebuild finance cache for ${representative._id}`,
				error
			);
		}
	}

	return summary;
}

export async function runSyncFecBulkCron(source = 'sync-fec-bulk') {
	await mongo();

	const cycle = currentCycleYear();
	console.log(`[Cron:${source}] Checking FEC bulk datasets for ${cycle}`);

	const metadataImports = await importFecBulkData({
		cycle,
		datasets: FEC_BULK_METADATA_DATASETS,
		onlyIfChanged: true
	});
	const financeImports = await importFecBulkData({
		cycle,
		datasets: FEC_BULK_FINANCE_DATASETS,
		onlyIfChanged: true
	});
	const rebuildSummary = await rebuildRepresentativeFinanceCachesFromBulk(
		`${source}:rebuild-caches`
	);

	return {
		cycle,
		imports: [...metadataImports, ...financeImports],
		rebuildSummary
	};
}

export async function runSyncStocksCron() {
	console.log('[Cron:sync-stocks] Starting stock sync job');
	await mongo();

	const nameToIdMap = await buildNameToIdMapFromDatabase();
	console.log(`[Cron:sync-stocks] Loaded ${nameToIdMap.size} representative names from MongoDB`);

	if (nameToIdMap.size === 0) {
		throw new Error(
			'No Person records with fullName. Run sync-finance first or seed members before syncing stocks.'
		);
	}

	const fmpKey = process.env.FMP_API_KEY?.trim();
	const summary = await syncFmpStockTrades(nameToIdMap, fmpKey);
	logStockSyncSummary(summary);

	console.log('[Cron:sync-stocks] Completed stock sync job', summary);

	return {
		success: summary.ok && !summary.skipped,
		stocks: summary
	};
}

export async function runSyncFinanceCron() {
	await mongo();
	console.log('[Cron:sync-finance] Starting finance sync job');

	const congressKey = process.env.CONGRESS_API_KEY?.trim();
	const fmpKey = process.env.FMP_API_KEY?.trim();
	const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();

	if (!congressKey) {
		throw new Error('Missing CONGRESS_API_KEY');
	}

	let offset = 0;
	const limit = 250;
	let fetchMore = true;
	const activeBioguideIds = new Set();
	const nameToIdMap = new Map();

	while (fetchMore) {
		const url = `https://api.congress.gov/v3/member?api_key=${congressKey}&currentMember=true&limit=${limit}&offset=${offset}&format=json`;
		const { response, json } = await fetchJsonWithVerboseLogging(
			url,
			'sync-finance:congress-members'
		);

		if (!response.ok) {
			throw new Error(
				`Congress member sync failed at offset ${offset} with HTTP ${response.status}`
			);
		}

		const members = json?.members || [];
		if (members.length === 0) {
			fetchMore = false;
			continue;
		}

		const bulkOps = members.map((member) => {
			activeBioguideIds.add(member.bioguideId);
			nameToIdMap.set(member.name.toLowerCase(), member.bioguideId);

			return {
				updateOne: {
					filter: { _id: member.bioguideId },
					update: {
						$set: {
							firstName: member.name.split(',')[1]?.trim(),
							lastName: member.name.split(',')[0]?.trim(),
							fullName: member.name,
							party: member.partyName,
							state: member.state,
							district: member.district?.toString(),
							branch: memberChamber(member),
							imageUrl: member.depiction?.imageUrl || ''
						}
					},
					upsert: true
				}
			};
		});

		if (bulkOps.length > 0) {
			await Person.bulkWrite(bulkOps);
		}

		console.log(
			`[Cron:sync-finance] Synced ${members.length} Congress members from offset ${offset}`
		);

		if (members.length === limit) {
			offset += limit;
		} else {
			fetchMore = false;
		}
	}

	const activeIds = [...activeBioguideIds];
	await ensurePersonCacheFields(activeIds);

	console.log(
		`[Cron:sync-finance] Synced ${activeBioguideIds.size} total active members into Person collection`
	);

	const sponsoredBillsSummary = await syncSponsoredBills(activeIds, congressKey);

	const stockSummary = await syncFmpStockTrades(nameToIdMap, fmpKey);
	logStockSyncSummary(stockSummary);
	if (stockSummary.skipped) {
		console.warn('[Cron:sync-finance] FMP_API_KEY missing; stock sync skipped');
	}

	const fecBulkSummary = await runSyncFecBulkCron('sync-finance:fec-bulk');

	const openFecSummary = {
		processedProfiles: 0,
		updatedProfiles: 0,
		stoppedForRateLimit: false,
		profileLimit: resolveOpenFecProfileLimit(activeIds.length)
	};

	if (fecKey) {
		console.log('[Cron:sync-finance] Starting representative finance cache refresh');
		const targetIds = activeIds.slice(0, openFecSummary.profileLimit);

		for (const bioguideId of targetIds) {
			try {
				openFecSummary.processedProfiles++;
				const representative = await Person.findById(bioguideId).lean();
				if (!representative) {
					console.warn(
						`[Cron:sync-finance] Representative ${bioguideId} not found during OpenFEC sync`
					);
					continue;
				}
				if (hasStoredFecCandidateId(representative.fec_candidate_id)) {
					console.log(
						`[Cron:sync-finance] Skipping ${bioguideId}; bulk-backed refresh already handled stored FEC id`
					);
					continue;
				}
				if (
					!hasStoredFecCandidateId(representative.fec_candidate_id) &&
					representative.fec_candidate_id_locked
				) {
					console.warn(
						`[Cron:sync-finance] Skipping OpenFEC totals for ${bioguideId}; FEC id is locked but empty`
					);
					continue;
				}

				await refreshRepresentativeFinancialData(bioguideId, 'sync-finance');
				openFecSummary.updatedProfiles++;
			} catch (error) {
				if (error instanceof OpenFECRateLimitError) {
					openFecSummary.stoppedForRateLimit = true;
					console.warn(
						'[Cron:sync-finance] OpenFEC rate limit reached; stopping remaining finance profile updates'
					);
					break;
				}

				throw error;
			}
		}
	} else {
		console.warn('[Cron:sync-finance] OPENFEC_API_KEY missing; OpenFEC sync skipped');
	}

	console.log('[Cron:sync-finance] Completed finance sync job', {
		activeMembers: activeBioguideIds.size,
		sponsoredBillsSummary,
		fecBulkSummary,
		openFecSummary,
		stocks: stockSummary
	});

	return {
		success: true,
		message: 'Sync gracefully executed across pipelines.',
		sponsoredBills: sponsoredBillsSummary,
		fecBulk: fecBulkSummary,
		stocks: stockSummary,
		openFec: openFecSummary,
		activeMembers: activeBioguideIds.size
	};
}

export async function runCheckBillsCron() {
	await mongo();
	console.log('[Cron:check-bills] Starting saved-bill status check job');

	const distinctBillIds = await SavedBill.distinct('billId');
	console.log(`[Cron:check-bills] Loaded ${distinctBillIds.length} distinct saved bill ids`);

	let updateCount = 0;
	let notificationCount = 0;

	for (const billId of distinctBillIds) {
		console.log(
			`[Cron:check-bills] Bill ${billId} still uses mock status refresh logic; no live Congress status fetch is implemented yet`
		);

		const latestStatus = 'Status Mock - Updated Action';
		const outdatedSaves = await SavedBill.find({ billId, status: { $ne: latestStatus } });
		console.log(
			`[Cron:check-bills] Found ${outdatedSaves.length} saved entries needing status update for ${billId}`
		);

		if (outdatedSaves.length === 0) {
			continue;
		}

		await SavedBill.updateMany({ billId }, { $set: { status: latestStatus } });
		updateCount++;

		const notificationsToInsert = outdatedSaves.map((save) => ({
			userId: save.userId,
			title: `Update on ${save.title || billId}`,
			message: `The status has changed to: ${latestStatus}`,
			link: `/bill/${billId}`,
			read: false
		}));

		if (notificationsToInsert.length > 0) {
			await Notification.insertMany(notificationsToInsert);
			notificationCount += notificationsToInsert.length;
		}
	}

	console.log('[Cron:check-bills] Completed saved-bill status check job', {
		updates: updateCount,
		notifications: notificationCount
	});

	return {
		success: true,
		updates: updateCount,
		notifications: notificationCount,
		note: 'This cron currently uses mock bill status updates and does not yet call Congress.gov.'
	};
}

export const ADMIN_CRON_JOBS = [
	{
		id: 'sync-fec-bulk',
		label: 'Sync FEC bulk',
		description:
			'Check current-cycle FEC bulk metadata and finance files, import changed datasets, and rebuild representative finance caches.'
	},
	{
		id: 'sync-finance',
		label: 'Sync finance',
		description:
			'Refresh representatives, sponsored bills, bulk-backed finance profiles, fallback OpenFEC data, and stock data.'
	},
	{
		id: 'sync-stocks',
		label: 'Sync stocks',
		description: 'Refresh congressional stock disclosures from Financial Modeling Prep.'
	},
	{
		id: 'check-bills',
		label: 'Check bills',
		description:
			'Re-run the saved bill status monitor and queue notifications when statuses change.'
	}
];

export async function runAdminCronJob(jobId) {
	switch (jobId) {
		case 'sync-fec-bulk':
			return await runSyncFecBulkCron();
		case 'sync-finance':
			return await runSyncFinanceCron();
		case 'sync-stocks':
			return await runSyncStocksCron();
		case 'check-bills':
			return await runCheckBillsCron();
		default:
			throw new Error(`Unknown cron job: ${jobId}`);
	}
}

export async function runAllAdminCronJobs() {
	const results = [];

	for (const job of ADMIN_CRON_JOBS) {
		console.log(`[Cron:admin] Running ${job.id}`);
		const result = await runAdminCronJob(job.id);
		results.push({ id: job.id, result });
	}

	console.log('[Cron:admin] Finished running all configured cron jobs');
	return results;
}
