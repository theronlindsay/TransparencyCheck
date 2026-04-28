import { json } from '@sveltejs/kit';
import { runCheckBillsCron } from '$lib/server/cron-jobs.js';

export async function GET({ request }) {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		return json(await runCheckBillsCron());
	} catch (err) {
		console.error('Error processing bill check cron:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
