import { json } from '@sveltejs/kit';
import { runSyncFecBulkCron } from '$lib/server/cron-jobs.js';

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
		return json(await runSyncFecBulkCron());
	} catch (err) {
		console.error('[Cron] FEC bulk sync failure:', err);
		return json(
			{ error: 'Internal server error during FEC bulk sync' },
			{ status: err.status === 409 ? 409 : 500 }
		);
	}
}
