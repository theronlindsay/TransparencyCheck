import { json } from '@sveltejs/kit';
import { runSyncStocksCron } from '$lib/server/cron-jobs.js';

export async function GET({ request, url }) {
	const authHeader = request.headers.get('authorization');
	const secret = process.env.CRON_SECRET || 'dev_secret';
	const isCron = authHeader === `Bearer ${secret}` || url.searchParams.get('secret') === secret;

	if (!isCron) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		return json(await runSyncStocksCron());
	} catch (err) {
		console.error('[sync-stocks]', err);
		return json({ error: err.message || 'Stock sync failed' }, { status: 500 });
	}
}
