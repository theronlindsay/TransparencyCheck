import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { hasStoredFecCandidateId, lookupFecCandidateId } from '$lib/openfec-candidate.js';
import { OpenFECRateLimitError } from '$lib/openfec-errors.js';

function memberChamber(member) {
	if (member.terms?.item && member.terms.item.length > 0) {
		return member.terms.item[member.terms.item.length - 1].chamber;
	}
	return 'Unknown';
}

/** Max OpenFEC candidate-search calls this request (undefined / empty / 0 = no limit). */
function parseOpenfecLookupCap() {
	const raw = process.env.OPENFEC_FEC_LOOKUPS_PER_REPS_REQUEST;
	if (raw === undefined || raw === '' || raw === '0') return Infinity;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n <= 0) return Infinity;
	return n;
}

/** Payload shape expected by the representatives page (from Congress or Mongo). */
async function loadRepresentativesFromMongo() {
	const rows = await Person.find({
		branch: { $in: ['Senate', 'House of Representatives'] },
		fullName: { $exists: true, $nin: [null, ''] }
	})
		.select('_id fullName party state branch imageUrl fec_candidate_id')
		.lean()
		.sort({ state: 1, fullName: 1 });

	return rows.map((p) => ({
		bioguideId: p._id,
		name: p.fullName,
		partyName: p.party || '',
		state: p.state || '',
		chamber: p.branch || 'Unknown',
		imageUrl: p.imageUrl || null,
		fec_candidate_id: hasStoredFecCandidateId(p.fec_candidate_id) ? p.fec_candidate_id.trim() : null
	}));
}

export async function GET() {
	try {
		await mongo();

		const apiKey = process.env.CONGRESS_API_KEY?.trim();

		if (!apiKey) {
			console.warn('[REPS API] CONGRESS_API_KEY missing; serving Person collection only.');
			const members = await loadRepresentativesFromMongo();
			return json({
				members,
				servedFromCache: true,
				liveCongressAvailable: false
			});
		}

		console.log(`[REPS API] Fetching current members from Congress.gov…`);
		const rawCongressMembers = [];
		let limit = 250;
		let offset = 0;
		let fetchMore = true;
		/** Set when a Congress request fails (quota, auth, server error) — do not use partial pages. */
		let congressHttpStatus = null;

		while (fetchMore) {
			const url = `https://api.congress.gov/v3/member?api_key=${apiKey}&currentMember=true&limit=${limit}&offset=${offset}&format=json`;
			const res = await fetch(url);

			if (!res.ok) {
				congressHttpStatus = res.status;
				console.warn(`[REPS API] Congress.gov error at offset ${offset}:`, res.status, res.statusText);
				break;
			}

			const data = await res.json();

			if (data.members && data.members.length > 0) {
				rawCongressMembers.push(...data.members);

				if (data.members.length === limit) {
					offset += limit;
				} else {
					fetchMore = false;
				}
			} else {
				fetchMore = false;
			}
		}

		// Any Congress HTTP error or unusable response → do not apply partial data; serve MongoDB instead
		if (congressHttpStatus != null || rawCongressMembers.length === 0) {
			const members = await loadRepresentativesFromMongo();
			console.warn('[REPS API] Using MongoDB Person cache.', {
				congressStatus: congressHttpStatus,
				discardedPartialCongressRows: rawCongressMembers.length,
				mongoCount: members.length
			});
			return json({
				members,
				servedFromCache: true,
				liveCongressAvailable: false
			});
		}

		const bulkOps = rawCongressMembers.map((member) => {
			const chamber = memberChamber(member);
			const setDoc = {
				firstName: member.name.split(',')[1]?.trim(),
				lastName: member.name.split(',')[0]?.trim(),
				fullName: member.name,
				party: member.partyName,
				state: member.state,
				branch: chamber,
				imageUrl: member.depiction?.imageUrl || ''
			};
			if (member.district != null && member.district !== '') {
				setDoc.district = String(member.district);
			}
			return {
				updateOne: {
					filter: { _id: member.bioguideId },
					update: { $set: setDoc },
					upsert: true
				}
			};
		});

		if (bulkOps.length > 0) {
			await Person.bulkWrite(bulkOps);
		}

		const ids = rawCongressMembers.map((m) => m.bioguideId);
		const fecKey = process.env.OPENFEC_API_KEY?.replace(/`/g, '')?.trim();
		const maxFecLookups = parseOpenfecLookupCap();
		const openfecDelayMs = Math.max(
			0,
			Number.parseInt(process.env.OPENFEC_REQUEST_DELAY_MS ?? '0', 10) || 0
		);

		/** @type {Map<string, { _id: string, fec_candidate_id?: string, fullName?: string }>} */
		let byId = new Map();
		if (ids.length > 0) {
			const rows = await Person.find({ _id: { $in: ids } })
				.select('_id fec_candidate_id fullName')
				.lean();
			byId = new Map(rows.map((p) => [p._id, p]));
		}

		let fecApiCalls = 0;
		let fecNewlyResolved = 0;

		if (fecKey) {
			const missingBefore = rawCongressMembers.filter(
				(m) => !hasStoredFecCandidateId(byId.get(m.bioguideId)?.fec_candidate_id)
			).length;

			if (missingBefore === 0) {
				console.log('[REPS API] OpenFEC: every member already has fec_candidate_id; skipping candidate search.');
			} else {
				for (const member of rawCongressMembers) {
					if (fecApiCalls >= maxFecLookups) {
						console.warn(
							`[REPS API] OpenFEC lookup cap reached (${maxFecLookups}); some members may still lack fec_candidate_id.`
						);
						break;
					}
					const row = byId.get(member.bioguideId);
					if (hasStoredFecCandidateId(row?.fec_candidate_id)) continue;

					const nameForSearch = member.name || row?.fullName;
					if (!nameForSearch?.trim()) continue;

					if (openfecDelayMs > 0 && fecApiCalls > 0) {
						await new Promise((r) => setTimeout(r, openfecDelayMs));
					}

					let fecId;
					try {
						fecId = await lookupFecCandidateId(nameForSearch, fecKey, {
							state: member.state,
							branch: chamber,
							party: member.partyName,
							logContext: {
								bioguideId: member.bioguideId,
								source: 'representatives'
							}
						});
					} catch (e) {
						if (e instanceof OpenFECRateLimitError) {
							console.warn('[REPS API] OpenFEC rate limited; stopping candidate lookups.', {
								openfecCallsSoFar: fecApiCalls,
								newlyStored: fecNewlyResolved
							});
							break;
						}
						throw e;
					}
					fecApiCalls++;

					if (fecId) {
						await Person.updateOne({ _id: member.bioguideId }, { $set: { fec_candidate_id: fecId } });
						byId.set(member.bioguideId, {
							...(row || {}),
							_id: member.bioguideId,
							fec_candidate_id: fecId
						});
						fecNewlyResolved++;
					}
				}

				const stillMissing = rawCongressMembers.filter(
					(m) => !hasStoredFecCandidateId(byId.get(m.bioguideId)?.fec_candidate_id)
				).length;

				console.log('[REPS API] OpenFEC candidate search pass', {
					membersNeedingId: missingBefore,
					openfecCalls: fecApiCalls,
					newlyStored: fecNewlyResolved,
					stillMissingFecId: stillMissing,
					lookupCap: Number.isFinite(maxFecLookups) ? maxFecLookups : 'none'
				});
			}
		}

		const allMembers = rawCongressMembers.map((member) => {
			const chamber = memberChamber(member);
			const rowOut = byId.get(member.bioguideId);
			const fecOut = rowOut?.fec_candidate_id;
			return {
				bioguideId: member.bioguideId,
				name: member.name,
				partyName: member.partyName,
				state: member.state,
				chamber,
				imageUrl: member.depiction?.imageUrl || null,
				fec_candidate_id: hasStoredFecCandidateId(fecOut) ? fecOut.trim() : null
			};
		});

		console.log(`[REPS API] Synced ${allMembers.length} members from Congress + Mongo; returning payload.`);
		return json({
			members: allMembers,
			servedFromCache: false,
			liveCongressAvailable: true
		});
	} catch (err) {
		console.error('[REPS API] Error during live sync:', err);
		try {
			await mongo();
			const members = await loadRepresentativesFromMongo();
			console.warn('[REPS API] Exception path: returning MongoDB Person cache.', { count: members.length });
			return json({
				members,
				servedFromCache: true,
				liveCongressAvailable: false
			});
		} catch (fallbackErr) {
			console.error('[REPS API] Mongo fallback failed:', fallbackErr);
			return json({ error: 'Failed to load representatives' }, { status: 500 });
		}
	}
}
