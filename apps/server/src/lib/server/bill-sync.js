import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { getRecentBills } from '$lib/db/repository.js';

const CURRENT_CONGRESS = 119;
const POLL_INTERVAL_MS = 15 * 60 * 1000;
/** Keep bulk sync small on memory-constrained Dokploy hosts. */
const SEED_LIMIT = 15;
const REFRESH_LIMIT = 15;

async function refreshRecentBills() {
	if (globalThis._billRefreshRunning) {
		console.log('⏭️  Skipping bill refresh — previous run still in progress');
		return;
	}
	globalThis._billRefreshRunning = true;
	console.log('🔄 Background: refreshing bills from Congress.gov...');
	try {
		const dateFrom = new Date();
		dateFrom.setDate(dateFrom.getDate() - 3);
		await fetchAndStoreBills({
			congress: CURRENT_CONGRESS,
			limit: REFRESH_LIMIT,
			dateFrom: dateFrom.toISOString().split('T')[0],
			detailed: false
		});
		console.log('✅ Background: bills refresh complete.');
	} catch (error) {
		console.error('❌ Background: bills refresh failed:', error);
	} finally {
		globalThis._billRefreshRunning = false;
	}
}

/**
 * If Mongo has no current-congress bills, pull a small lightweight batch from Congress.gov.
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
		limit: SEED_LIMIT,
		detailed: false
	})
		.then((count) => {
			console.log(`✅ Initial bill seed complete (${count} bills).`);
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
 * Kick off background seed (non-blocking) + periodic refresh.
 */
export function startBillSync() {
	if (globalThis._billRefreshInterval) return;

	globalThis._billRefreshInterval = true;

	// Never block HTTP on Congress.gov seeding.
	ensureBillsSeeded().catch((err) => {
		console.error('❌ ensureBillsSeeded failed:', err);
	});

	globalThis._billRefreshInterval = setInterval(refreshRecentBills, POLL_INTERVAL_MS);
	console.log(`⏱️  Bill refresh scheduled every ${POLL_INTERVAL_MS / 60000} minutes.`);
}
