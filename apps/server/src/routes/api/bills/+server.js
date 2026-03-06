import { json } from '@sveltejs/kit';
import { getRecentBills } from '$lib/db/repository.js';
import { fetchAndStoreBills } from '$lib/bill-fetcher.js';

// Flag to ensure background job only runs once
let backgroundJobStarted = false;

/**
 * Kick off background job to fetch recent bills (last 3 days)
 */
async function startBackgroundJob() {
	if (backgroundJobStarted) return;
	backgroundJobStarted = true;

	console.log('🔄 Starting background job to fetch recent bills...');
	try {
		const dateTo = new Date();
		const dateFrom = new Date();
		dateFrom.setDate(dateTo.getDate() - 3);

		const fromString = dateFrom.toISOString().split('T')[0];
		const toString = dateTo.toISOString().split('T')[0];

		await fetchAndStoreBills({ dateFrom: fromString, dateTo: toString });
		console.log('✅ Background job: Finished fetching recent bills.');
	} catch (error) {
		console.error('❌ Background job: Error fetching recent bills:', error);
	}
}

export async function GET() {
	try {
		// Start background job on first request (non-blocking)
		if (!backgroundJobStarted) {
			startBackgroundJob().catch((err) => {
				console.error('Background job failed:', err);
			});
		}

		// Repository handles Mongo-first with SQLite fallback
		const bills = await getRecentBills(100);

		return json(bills);
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

