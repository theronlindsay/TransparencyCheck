import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { FinanceProfile } from '$lib/db/models/FinanceProfile.js';
import { DONOR_AGG_VERSION, fetchDonorsMultiYear } from '$lib/openfec-donors.js';
import { hasStoredFecCandidateId, lookupFecCandidateId } from '$lib/openfec-candidate.js';
import { OpenFECRateLimitError } from '$lib/openfec-errors.js';
import { syncFmpStockTrades, logStockSyncSummary } from '$lib/cron/stock-sync.js';

export async function GET({ request, url }) {
    // Vercel / Cloudflare cron expects GET or POST with authentication header or queried local secrets
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET || 'dev_secret';
    const isCron = authHeader === `Bearer ${secret}` || url.searchParams.get('secret') === secret;

    if (!isCron) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await mongo();
        console.log('[Cron] Starting 24h background sync architecture...');

        const congressKey = process.env.CONGRESS_API_KEY?.trim();
        const fmpKey = process.env.FMP_API_KEY?.trim();
        const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();

        if (!congressKey) throw new Error('Missing CONGRESS_API_KEY');

        // 1. Sync Base Representative Array
        console.log('[Cron] Syncing Congress API Base Members...');
        let offset = 0;
        let limit = 250;
        let fetchMore = true;
        let activeBioguideIds = new Set();
        let nameToIdMap = new Map(); // Used to map FMP names back to Bioguide IDs

        while (fetchMore) {
            const memRes = await fetch(`https://api.congress.gov/v3/member?api_key=${congressKey}&currentMember=true&limit=${limit}&offset=${offset}&format=json`);
            if (!memRes.ok) break;
            const data = await memRes.json();
            
            if (data.members && data.members.length > 0) {
                const bulkOps = data.members.map(member => {
                    activeBioguideIds.add(member.bioguideId);
                    nameToIdMap.set(member.name.toLowerCase(), member.bioguideId);

                    let chamber = 'Unknown';
                    if (member.terms?.item?.length > 0) {
                        chamber = member.terms.item[member.terms.item.length - 1].chamber;
                    }
                    
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
                                    branch: chamber,
                                    imageUrl: member.depiction?.imageUrl || ''
                                }
                            },
                            upsert: true
                        }
                    };
                });
                await Person.bulkWrite(bulkOps);

                if (data.members.length === limit) {
                    offset += limit;
                } else {
                    fetchMore = false;
                }
            } else {
                fetchMore = false;
            }
        }
        console.log(`[Cron] Synced ${activeBioguideIds.size} core members to Person collection.`);

        // 2. FMP Stock Disclosures (Bulk)
        const stockSummary = await syncFmpStockTrades(nameToIdMap, fmpKey);
        logStockSyncSummary(stockSummary);
        if (stockSummary.skipped) {
            console.warn('[Cron] FMP_API_KEY missing, skipping bulk stock disclosure sync.');
        }

        // 3. OpenFEC Totals (Iterative Fetch)
        // Because of 1,000/hr limit, we only process the first 5 active profiles as a safe POC 
        // until we hook into the official bulk data file endpoints.
        if (fecKey) {
            console.log('[Cron] Iterating OpenFEC profiles (Limited safe batch)...');
            const targetIds = Array.from(activeBioguideIds).slice(0, 5); 
            
            for (const bid of targetIds) {
                try {
                    const rep = await Person.findById(bid).lean();
                    if (!rep) continue;

                    let fecId = rep.fec_candidate_id;

                    // If missing in DB, find via OpenFEC name search (skip if already stored)
                    if (!hasStoredFecCandidateId(fecId) && rep.fullName) {
                        fecId = await lookupFecCandidateId(rep.fullName, fecKey, {
                            state: rep.state,
                            branch: rep.branch,
                            party: rep.party,
                            logContext: {
                                bioguideId: bid,
                                source: 'cron-sync-finance'
                            }
                        });
                        if (fecId) {
                            await Person.updateOne({ _id: bid }, { $set: { fec_candidate_id: fecId } });
                        }
                    }

                    if (fecId) {
                        let totalsObj = { receipts: 0, disbursements: 0, cash_on_hand: 0 };

                        const tRes = await fetch(
                            `https://api.open.fec.gov/v1/candidate/${fecId}/totals/?api_key=${fecKey}`
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

                        const donorsArr = await fetchDonorsMultiYear(fecId, fecKey, {
                            periodCount: 4,
                            pagesPerPeriod: 2,
                            perPage: 100,
                            maxDonors: 150
                        });

                        await FinanceProfile.updateOne(
                            { politicianId: bid },
                            {
                                $set: {
                                    totals: totalsObj,
                                    donors: donorsArr,
                                    lastSyncedAt: new Date(),
                                    donorAggVersion: DONOR_AGG_VERSION,
                                    fecCandidateId: fecId
                                }
                            },
                            { upsert: true }
                        );
                    }
                } catch (e) {
                    if (e instanceof OpenFECRateLimitError) {
                        console.warn('[Cron] OpenFEC rate limited; stopping further OpenFEC requests this run.');
                        break;
                    }
                    throw e;
                }
            }
            console.log('[Cron] Limited OpenFEC POC Sync successfully mapped.');
        } else {
            console.warn('[Cron] NO OPENFEC_API_KEY detected. Skipping FEC totals ingestion.');
        }

        console.log('[Cron] 24h background sync architecture complete.');
        return json({
            success: true,
            message: 'Sync gracefully executed across pipelines.',
            stocks: stockSummary
        });

    } catch (err) {
        console.error('[Cron] Engine Execution Failure:', err);
        return json({ error: 'Internal server error during DB aggregate' }, { status: 500 });
    }
}
