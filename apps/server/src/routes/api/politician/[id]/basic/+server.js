import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { mapPersonDetail } from '$lib/server/person-cache.js';

export async function GET({ params }) {
	const bioguideId = params.id?.toUpperCase();

	if (!bioguideId) {
		return json({ error: 'Missing bioguideId parameter' }, { status: 400 });
	}

	try {
		await mongo();

		const memberData = await Person.findOne({ _id: bioguideId }).lean();
		if (!memberData) {
			return json({ error: 'Politician not found in cache.' }, { status: 404 });
		}

		return json(mapPersonDetail(memberData));
	} catch (err) {
		console.error('[BASIC API] DB Error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
