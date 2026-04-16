import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { fetchSponsoredBillsFromCongress } from '$lib/congress-sponsored-bills.js';
import { hasStoredFecCandidateId, lookupFecCandidateId } from '$lib/openfec-candidate.js';
import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

function mapPersonToPayload(memberData, bioguideId) {
	const name = memberData.fullName || `${memberData.firstName} ${memberData.lastName}`.trim();
	return {
		id: memberData._id,
		name,
		chamber: memberData.branch,
		role: memberData.branch,
		party: memberData.party,
		description: `Representative from ${memberData.state}${memberData.district ? ` - District ${memberData.district}` : ''}`,
		state: memberData.state,
		headshotUrl: memberData.imageUrl || `https://bioguide.congress.gov/scripts/biodisplay.pl?index=${bioguideId}`,
		fec_candidate_id: memberData.fec_candidate_id || null,
		sponsoredBills: memberData.sponsoredBills || [],
		url: memberData.url || null
	};
}

async function ensureSponsoredBillsOnPerson(bioguideId, current) {
	if (current && current.length > 0) return current;
	const cApiKey = process.env.CONGRESS_API_KEY?.trim();
	if (!cApiKey) return [];
	const fetched = await fetchSponsoredBillsFromCongress(bioguideId, cApiKey);
	if (fetched.length > 0) {
		await Person.updateOne({ _id: bioguideId }, { $set: { sponsoredBills: fetched } });
	}
	return fetched;
}

export async function GET({ params }) {
    const bioguideId = params.id?.toUpperCase();

    if (!bioguideId) {
        return json({ error: 'Missing bioguideId parameter' }, { status: 400 });
    }

    try {
        await mongo();

        // Access the central repository sync rather than making 3 concurrent Congress HTTP fetches
        const memberData = await Person.findOne({ _id: bioguideId }).lean();
        
        if (memberData) {
            const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();
            let merged = memberData;
            if (!hasStoredFecCandidateId(memberData.fec_candidate_id) && memberData.fullName && fecKey) {
                try {
                    const resolved = await lookupFecCandidateId(memberData.fullName, fecKey, {
                        state: memberData.state,
                        branch: memberData.branch,
                        party: memberData.party,
                        logContext: {
                            bioguideId,
                            source: 'politician-basic'
                        }
                    });
                    if (resolved) {
                        await Person.updateOne({ _id: bioguideId }, { $set: { fec_candidate_id: resolved } });
                        merged = { ...memberData, fec_candidate_id: resolved };
                    }
                } catch (e) {
                    if (e instanceof OpenFECRateLimitError) {
                        console.warn('[BASIC API] OpenFEC rate limited; skipping FEC id lookup', { bioguideId });
                    } else {
                        throw e;
                    }
                }
            }

            const sponsoredBills = await ensureSponsoredBillsOnPerson(
                bioguideId,
                merged.sponsoredBills
            );
            return json(mapPersonToPayload({ ...merged, sponsoredBills }, bioguideId));
        }

        // Cache miss fallback (for retired members or if sync daemon hasn't completed natively yet)
        const cApiKey = process.env.CONGRESS_API_KEY?.trim();
        if (cApiKey) {
            const fallbackRes = await fetch(`https://api.congress.gov/v3/member/${bioguideId}?api_key=${cApiKey}&format=json`);
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                const mem = fallbackData.member;
                if (mem) {
                    const fallbackSet = {
                        firstName: mem.firstName || '',
                        lastName: mem.lastName || '',
                        fullName: mem.directOrderName || '',
                        party: mem.partyHistory?.[0]?.partyName || '',
                        state: mem.state || '',
                        branch: mem.terms?.[0]?.chamber || 'Unknown',
                        imageUrl: mem.depiction?.imageUrl || ''
                    };
                    if (mem.officialWebsite) fallbackSet.url = mem.officialWebsite;

                    await Person.updateOne({ _id: bioguideId }, { $set: fallbackSet }, { upsert: true });

                    const sponsoredBills = await ensureSponsoredBillsOnPerson(bioguideId, []);
                    const fresh = await Person.findOne({ _id: bioguideId }).lean();
                    let merged = fresh
                        ? { ...fresh, sponsoredBills }
                        : {
                                _id: bioguideId,
                                fullName: mem.directOrderName,
                                firstName: mem.firstName || '',
                                lastName: mem.lastName || '',
                                party: mem.partyHistory?.[0]?.partyName || '',
                                state: mem.state || '',
                                branch: mem.terms?.[0]?.chamber || 'Unknown',
                                imageUrl: mem.depiction?.imageUrl || '',
                                fec_candidate_id: null,
                                sponsoredBills,
                                url: mem.officialWebsite || null
                            };

                    const fecKeyFallback = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();
                    if (!hasStoredFecCandidateId(merged.fec_candidate_id) && merged.fullName && fecKeyFallback) {
                        try {
                            const resolved = await lookupFecCandidateId(merged.fullName, fecKeyFallback, {
                                state: merged.state,
                                branch: merged.branch,
                                party: merged.party,
                                logContext: {
                                    bioguideId,
                                    source: 'politician-basic-fallback'
                                }
                            });
                            if (resolved) {
                                await Person.updateOne({ _id: bioguideId }, { $set: { fec_candidate_id: resolved } });
                                merged = { ...merged, fec_candidate_id: resolved };
                            }
                        } catch (e) {
                            if (e instanceof OpenFECRateLimitError) {
                                console.warn('[BASIC API] OpenFEC rate limited (fallback path); skipping FEC lookup', {
                                    bioguideId
                                });
                            } else {
                                throw e;
                            }
                        }
                    }

                    return json(mapPersonToPayload(merged, bioguideId));
                }
            }
        }

        return json({ error: 'Politician not dynamically populated yet.' }, { status: 404 });

    } catch (err) {
        console.error('[BASIC API] DB Error:', err);
        return json({ error: 'Database error' }, { status: 500 });
    }
}
