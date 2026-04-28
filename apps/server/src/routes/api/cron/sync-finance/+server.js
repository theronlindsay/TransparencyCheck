import { json } from '@sveltejs/kit';
import { runSyncFinanceCron } from '$lib/server/cron-jobs.js';

export async function GET({ request, url }) {
	const authHeader = request.headers.get('authorization');
	const secret = process.env.CRON_SECRET || 'dev_secret';
	const isCron = authHeader === `Bearer ${secret}` || url.searchParams.get('secret') === secret;

	if (!isCron) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		return json(await runSyncFinanceCron());
	} catch (err) {
		console.error('[Cron] Engine Execution Failure:', err);
		return json({ error: 'Internal server error during DB aggregate' }, { status: 500 });
	}
}
