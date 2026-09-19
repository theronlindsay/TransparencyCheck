import { json } from '@sveltejs/kit';
import { runSyncRepresentativesCron } from '$lib/server/cron-jobs.js';

export async function GET({ request, url }) {
	const authHeader = request.headers.get('authorization');
	const secret = process.env.CRON_SECRET;
	const isCron =
		Boolean(secret) &&
		(authHeader === `Bearer ${secret}` || url.searchParams.get('secret') === secret);

	if (!isCron) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		return json(await runSyncRepresentativesCron());
	} catch (err) {
		console.error('[Cron] Engine Execution Failure:', err);
		return json(
			{ error: 'Representative import failed; check server logs and CONGRESS_API_KEY.' },
			{ status: err.status === 409 ? 409 : 500 }
		);
	}
}
