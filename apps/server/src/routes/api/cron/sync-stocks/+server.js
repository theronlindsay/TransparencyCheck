import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import {
	buildNameToIdMapFromDatabase,
	syncFmpStockTrades,
	logStockSyncSummary
} from '$lib/cron/stock-sync.js';

export async function GET({ request, url }) {
	const authHeader = request.headers.get('authorization');
	const secret = process.env.CRON_SECRET || 'dev_secret';
	const isCron =
		authHeader === `Bearer ${secret}` || url.searchParams.get('secret') === secret;

	if (!isCron) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await mongo();

		const nameToIdMap = await buildNameToIdMapFromDatabase();
		if (nameToIdMap.size === 0) {
			return json(
				{
					error: 'No Person records with fullName. Run /api/cron/sync-finance first (Congress sync) or seed members.'
				},
				{ status: 400 }
			);
		}

		const fmpKey = process.env.FMP_API_KEY?.trim();
		const summary = await syncFmpStockTrades(nameToIdMap, fmpKey);
		logStockSyncSummary(summary);

		return json({
			success: summary.ok && !summary.skipped,
			stocks: summary
		});
	} catch (err) {
		console.error('[sync-stocks]', err);
		return json({ error: err.message || 'Stock sync failed' }, { status: 500 });
	}
}
