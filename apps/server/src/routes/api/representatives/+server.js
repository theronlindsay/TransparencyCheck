import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { mapPersonSummary } from '$lib/server/person-cache.js';

export async function GET() {
	try {
		await mongo();

		const members = await Person.find({
			branch: { $in: ['Senate', 'House of Representatives'] },
			fullName: { $exists: true, $nin: [null, ''] }
		})
			.select('_id fullName firstName lastName party state branch imageUrl fec_candidate_id')
			.lean()
			.sort({ state: 1, fullName: 1 });

		return json({
			members: members.map(mapPersonSummary),
			servedFromCache: true,
			liveCongressAvailable: false
		});
	} catch (err) {
		console.error('[REPS API] Database read failed:', err);
		return json({ error: 'Failed to load representatives from cache' }, { status: 500 });
	}
}
