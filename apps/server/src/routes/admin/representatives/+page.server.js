import { fail } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import {
	rebuildRepresentativeFinanceCachesFromBulk,
	refreshAllRepresentativeFecIds,
	refreshRepresentativeFinancialData
} from '$lib/server/cron-jobs.js';
import {
	currentCycleYear,
	FEC_BULK_FINANCE_DATASETS,
	FEC_BULK_METADATA_DATASETS,
	importFecBulkData
} from '$lib/server/fec-bulk-import.js';
import { runWithLogCapture } from '$lib/server/logging.js';

function normalizeFecCandidateId(value) {
	return String(value || '')
		.trim()
		.toUpperCase();
}

async function loadRepresentatives() {
	await mongo();

	const representatives = await Person.find({
		branch: { $in: ['Senate', 'House of Representatives'] },
		fullName: { $exists: true, $nin: [null, ''] }
	})
		.select(
			'_id fullName firstName lastName party state district branch fec_candidate_id fec_candidate_id_locked financialData.lastSyncedAt financialData.fecCandidateId financialData.donors'
		)
		.sort({ state: 1, district: 1, lastName: 1, firstName: 1, _id: 1 })
		.lean();

	return representatives.map((person) => ({
		bioguideId: person._id,
		name: person.fullName || `${person.lastName || ''}, ${person.firstName || ''}`.trim(),
		party: person.party || '',
		state: person.state || '',
		district: person.district || '',
		branch: person.branch || '',
		fecCandidateId: person.fec_candidate_id || '',
		fecCandidateIdLocked: Boolean(person.fec_candidate_id_locked),
		financeFecCandidateId: person.financialData?.fecCandidateId || '',
		financialLastSyncedAt: person.financialData?.lastSyncedAt
			? new Date(person.financialData.lastSyncedAt).toISOString()
			: null,
		donorCount: Array.isArray(person.financialData?.donors) ? person.financialData.donors.length : 0
	}));
}

export async function load() {
	const representatives = await loadRepresentatives();

	return {
		representatives,
		summary: {
			total: representatives.length,
			missingFecIds: representatives.filter((entry) => !entry.fecCandidateId).length,
			lockedFecIds: representatives.filter((entry) => entry.fecCandidateIdLocked).length
		}
	};
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const intent = String(formData.get('intent') || '');
		const bioguideId = String(formData.get('bioguideId') || '').trim();

		if (
			![
				'refresh-fec-ids',
				'import-fec-bulk',
				'import-fec-bulk-finance',
				'rebuild-finance-caches'
			].includes(intent) &&
			!bioguideId
		) {
			return fail(400, { error: 'Representative id is required.' });
		}

		try {
			if (intent === 'import-fec-bulk') {
				const { result, logs } = await runWithLogCapture(
					async () =>
						await importFecBulkData({
							cycle: currentCycleYear(),
							datasets: FEC_BULK_METADATA_DATASETS
						})
				);

				return {
					intent,
					message: `Imported FEC bulk metadata for the ${currentCycleYear()} cycle.`,
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			if (intent === 'import-fec-bulk-finance') {
				const { result, logs } = await runWithLogCapture(
					async () =>
						await importFecBulkData({
							cycle: currentCycleYear(),
							datasets: FEC_BULK_FINANCE_DATASETS,
							onlyIfChanged: true
						})
				);

				return {
					intent,
					message: `Checked and imported changed FEC bulk finance data for the ${currentCycleYear()} cycle.`,
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			if (intent === 'refresh-fec-ids') {
				const { result, logs } = await runWithLogCapture(
					async () => await refreshAllRepresentativeFecIds('admin-representatives-fec-only')
				);

				return {
					intent,
					message: 'Refreshed FEC candidate IDs only.',
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			if (intent === 'rebuild-finance-caches') {
				const { result, logs } = await runWithLogCapture(
					async () =>
						await rebuildRepresentativeFinanceCachesFromBulk(
							'admin-representatives-rebuild-bulk-finance'
						)
				);

				return {
					intent,
					message: 'Rebuilt representative finance caches from local FEC bulk data.',
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			if (intent === 'update-fec-id') {
				await mongo();
				const fecCandidateId = normalizeFecCandidateId(formData.get('fecCandidateId'));
				const representative = await Person.findById(bioguideId).lean();

				if (!representative) {
					return fail(404, { error: `Representative ${bioguideId} not found.` });
				}

				await Person.updateOne(
					{ _id: bioguideId },
					{
						$set: {
							fec_candidate_id: fecCandidateId,
							fec_candidate_id_locked: Boolean(fecCandidateId)
						}
					}
				);

				return {
					intent,
					bioguideId,
					message: fecCandidateId
						? `Saved FEC candidate id ${fecCandidateId} for ${representative.fullName || bioguideId}. Cron will not auto-replace it.`
						: `Cleared FEC candidate id for ${representative.fullName || bioguideId}. Automatic lookup is enabled again.`
				};
			}

			if (intent === 'refresh-financial-data') {
				const { result, logs } = await runWithLogCapture(
					async () => await refreshRepresentativeFinancialData(bioguideId, 'admin-representatives')
				);

				return {
					intent,
					bioguideId,
					message: `Refreshed financial data for ${result.name}.`,
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			return fail(400, { error: 'Unknown representative admin action.' });
		} catch (error) {
			console.error('[Admin Representatives] Action failed:', error);
			return fail(500, {
				intent,
				bioguideId,
				error: error?.message || 'Representative admin action failed.'
			});
		}
	}
};
