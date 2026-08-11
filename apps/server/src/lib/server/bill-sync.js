import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { getRecentBills } from '$lib/db/repository.js';

const CURRENT_CONGRESS = 119;
const POLL_INTERVAL_MS = 15 * 60 * 1000;
const SEED_LIMIT = 40;
const REFRESH_LIMIT = 40;

async function refreshRecentBills() {
	console.log('🔄 Background: refreshing bills from Congress.gov...');
	try {
		const dateFrom = new Date();
		dateFrom.setDate(dateFrom.getDate() - 3);
		await fetchAndStoreBills({
			congress: CURRENT_CONGRESS,
			limit: REFRESH_LIMIT,
			dateFrom: dateFrom.toISOString().split('T')[0]
		});
		console.log('✅ Background: bills refresh complete.');
	} catch (error) {
		console.error('❌ Background: bills refresh failed:', error);
	}
}

/**
 * If Mongo has no current-congress bills, pull a batch from Congress.gov.
 * Safe to call concurrently — only one seed runs at a time.
 */
export async function ensureBillsSeeded() {
	const existing = await getRecentBills(1);
	if (existing.length > 0) return existing;

	if (globalThis._billSeedPromise) {
		await globalThis._billSeedPromise;
		return await getRecentBills(1);
	}

	console.log(`📭 DB empty for congress ${CURRENT_CONGRESS} — seeding from Congress.gov...`);
	globalThis._billSeedPromise = fetchAndStoreBills({
		congress: CURRENT_CONGRESS,
		limit: SEED_LIMIT
	})
		.then(() => {
			console.log('✅ Initial bill seed complete.');
		})
		.catch((err) => {
			console.error('❌ Startup bill seed failed:', err);
			throw err;
		})
		.finally(() => {
			globalThis._billSeedPromise = undefined;
		});

	await globalThis._billSeedPromise;
	return await getRecentBills(1);
}

/**
 * Seed on first request if needed, then refresh periodically.
 */
export function startBillSync() {
	if (globalThis._billRefreshInterval) return;

	globalThis._billRefreshInterval = true;

	ensureBillsSeeded().catch((err) => {
		console.error('❌ ensureBillsSeeded failed:', err);
	});

	globalThis._billRefreshInterval = setInterval(refreshRecentBills, POLL_INTERVAL_MS);
	console.log(`⏱️  Bill refresh scheduled every ${POLL_INTERVAL_MS / 60000} minutes.`);
}
