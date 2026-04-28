import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { FinanceProfile } from '$lib/db/models/FinanceProfile.js';
import { DONOR_AGG_VERSION } from '$lib/openfec-donors.js';
import { isValidFecCandidateId } from '$lib/openfec-candidate.js';
import {
	emptyFinancialData,
	normalizeCommitteeScope,
	normalizeFinancialData
} from '$lib/server/person-cache.js';

function isFreshFinancialDataSnapshot(snapshot) {
	if (!snapshot || typeof snapshot !== 'object') {
		return false;
	}

	if (!isValidFecCandidateId(snapshot.fecCandidateId)) {
		return false;
	}

	return Number(snapshot.donorAggVersion) >= DONOR_AGG_VERSION;
}

export async function GET({ params, url }) {
	const bioguideId = params.id?.toUpperCase();
	const committeeScope = normalizeCommitteeScope(url.searchParams.get('committeeScope'));

	if (!bioguideId) {
		return json({ error: 'Missing bioguideId' }, { status: 400 });
	}

	try {
		await mongo();

		const person = await Person.findById(bioguideId).select('financialData').lean();
		if (isFreshFinancialDataSnapshot(person?.financialData)) {
			return json(
				normalizeFinancialData({ ...person.financialData, selectedScope: committeeScope })
			);
		}

		const profile = await FinanceProfile.findOne({ politicianId: bioguideId }).lean();
		if (isFreshFinancialDataSnapshot(profile)) {
			return json(
				normalizeFinancialData({
					fecCandidateId: profile.fecCandidateId || null,
					committees: profile.committees,
					scopeData: profile.scopeData,
					selectedScope: committeeScope,
					includedCommitteeIds: profile.includedCommitteeIds,
					totals: profile.totals,
					donors: profile.donors,
					lastSyncedAt: profile.lastSyncedAt,
					donorAggVersion: profile.donorAggVersion
				})
			);
		}

		return json(emptyFinancialData({ selectedScope: committeeScope }));
	} catch (err) {
		console.error('[FINANCE API] DB Error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
