import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { FinanceProfile } from '$lib/db/models/FinanceProfile.js';
import { DONOR_AGG_VERSION, fetchDonorsMultiYear } from '$lib/openfec-donors.js';
import { hasStoredFecCandidateId, lookupFecCandidateId } from '$lib/openfec-candidate.js';
import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

function financeProfileHasUsableCache(profile) {
	if (!profile) return false;
	if (Array.isArray(profile.donors) && profile.donors.length > 0) return true;
	const t = profile.totals;
	return Boolean(
		t && (Number(t.receipts) > 0 || Number(t.disbursements) > 0 || Number(t.cash_on_hand) > 0)
	);
}

export async function GET({ params, url }) {
    const bioguideId = params.id?.toUpperCase();
    let fecId = url.searchParams.get('fec_candidate_id');
    const name = url.searchParams.get('name');

    if (!bioguideId) {
        return json({ error: 'Missing bioguideId' }, { status: 400 });
    }

    console.log('[FINANCE API] attempt', {
        bioguideId,
        fec_candidate_id: fecId || null,
        name: name ? `${name.slice(0, 80)}${name.length > 80 ? '…' : ''}` : null
    });

    try {
        await mongo();

        const profile = await FinanceProfile.findOne({ politicianId: bioguideId });

        if (
            profile &&
            profile.donors &&
            profile.donors.length > 0 &&
            (profile.donorAggVersion ?? 0) >= DONOR_AGG_VERSION
        ) {
            console.log('[FINANCE API] served from cache', {
                bioguideId,
                donorCount: profile.donors.length,
                donorAggVersion: profile.donorAggVersion
            });
            return json({
                totals: profile.totals,
                donors: profile.donors
            });
        }

        console.log('[FINANCE API] cache miss or stale', {
            bioguideId,
            hadProfile: Boolean(profile),
            donorCount: profile?.donors?.length ?? 0,
            donorAggVersion: profile?.donorAggVersion ?? null
        });

        const personLean = await Person.findById(bioguideId).select('fec_candidate_id fullName state branch party').lean();
        const storedFecId = hasStoredFecCandidateId(personLean?.fec_candidate_id)
            ? personLean.fec_candidate_id.trim()
            : null;

        // Cache miss: use query param, then Person.fec_candidate_id, then optional name search (skip OpenFEC name lookup if DB already has id)
        const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();
        const fecFromQuery = hasStoredFecCandidateId(fecId) ? fecId.trim() : null;
        let fallbackFecId = fecFromQuery || storedFecId || null;
        let fecIdFromNameLookup = false;

        if (!fallbackFecId && name && fecKey) {
            console.log('[FINANCE API] OpenFEC candidate search', { bioguideId, nameSnippet: name.slice(0, 60) });
            try {
                fallbackFecId = await lookupFecCandidateId(name, fecKey, {
                    state: personLean?.state,
                    branch: personLean?.branch,
                    party: personLean?.party,
                    logContext: {
                        bioguideId,
                        source: 'politician-finance'
                    }
                });
                fecIdFromNameLookup = Boolean(fallbackFecId);
            } catch (lookupErr) {
                if (lookupErr instanceof OpenFECRateLimitError) {
                    if (financeProfileHasUsableCache(profile)) {
                        console.warn(
                            '[FINANCE API] OpenFEC rate limited during candidate search; returning cached FinanceProfile',
                            { bioguideId }
                        );
                        return json({
                            totals: profile.totals,
                            donors: profile.donors
                        });
                    }
                    console.warn('[FINANCE API] OpenFEC rate limited during candidate search; no local cache', {
                        bioguideId
                    });
                    return json({
                        totals: { receipts: 0, disbursements: 0, cash_on_hand: 0 },
                        donors: []
                    });
                }
                throw lookupErr;
            }
        }

        if (fallbackFecId && fecIdFromNameLookup) {
            await Person.updateOne({ _id: bioguideId }, { $set: { fec_candidate_id: fallbackFecId } }).catch(
                () => {}
            );
        }

        if (fallbackFecId && fecKey) {
            try {
                console.log('[FINANCE API] OpenFEC live fetch', { bioguideId, fecCandidateId: fallbackFecId });
                let totalsObj = { receipts: 0, disbursements: 0, cash_on_hand: 0 };

                const tRes = await fetch(
                    `https://api.open.fec.gov/v1/candidate/${fallbackFecId}/totals/?api_key=${fecKey}`
                );
                if (tRes.status === 429) {
                    throw new OpenFECRateLimitError('OpenFEC candidate totals returned 429');
                }
                if (tRes.ok) {
                    const tJson = await tRes.json();
                    if (tJson.results?.length > 0) {
                        totalsObj.receipts = tJson.results[0].receipts;
                        totalsObj.disbursements = tJson.results[0].disbursements;
                        totalsObj.cash_on_hand = tJson.results[0].cash_on_hand_end_period;
                    }
                }

                const donorsArr = await fetchDonorsMultiYear(fallbackFecId, fecKey, {
                    periodCount: 4,
                    pagesPerPeriod: 2,
                    perPage: 100,
                    maxDonors: 150
                });

                await FinanceProfile.updateOne(
                    { politicianId: bioguideId },
                    {
                        $set: {
                            totals: totalsObj,
                            donors: donorsArr,
                            lastSyncedAt: new Date(),
                            donorAggVersion: DONOR_AGG_VERSION,
                            fecCandidateId: fallbackFecId
                        }
                    },
                    { upsert: true }
                );

                console.log('[FINANCE API] OpenFEC fetch done', {
                    bioguideId,
                    fecCandidateId: fallbackFecId,
                    donorCount: donorsArr.length
                });
                return json({ totals: totalsObj, donors: donorsArr });
            } catch (inner) {
                if (inner instanceof OpenFECRateLimitError) {
                    if (financeProfileHasUsableCache(profile)) {
                        console.warn(
                            '[FINANCE API] OpenFEC rate limited; returning cached FinanceProfile',
                            { bioguideId }
                        );
                        return json({
                            totals: profile.totals,
                            donors: profile.donors
                        });
                    }
                    console.warn('[FINANCE API] OpenFEC rate limited; no local finance cache', {
                        bioguideId
                    });
                    return json({
                        totals: { receipts: 0, disbursements: 0, cash_on_hand: 0 },
                        donors: []
                    });
                }
                throw inner;
            }
        }

        console.log('[FINANCE API] empty result (no FEC id or API key)', {
            bioguideId,
            hasOpenfecKey: Boolean(fecKey),
            hadFecParam: Boolean(fecFromQuery),
            usedStoredFecId: Boolean(storedFecId && !fecFromQuery)
        });
        return json({
            totals: { receipts: 0, disbursements: 0, cash_on_hand: 0 },
            donors: []
        });

    } catch (err) {
        console.error('[FINANCE API] DB Error:', err);
        return json({ error: 'Database error' }, { status: 500 });
    }
}
