import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { getRecentBills } from '$lib/db/repository.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const CURRENT_CONGRESS = 119;

async function refreshBills() {
	console.log('🔄 Background: refreshing most recently updated bills...');
	try {
		await fetchAndStoreBills({ congress: CURRENT_CONGRESS, limit: 40 });
		console.log('✅ Background: bills refresh complete.');
	} catch (error) {
		console.error('❌ Background: bills refresh failed:', error);
	}
}

// On startup: seed if the DB is empty, then schedule periodic refresh.
// globalThis guard prevents duplicate intervals when Vite HMR re-executes this module.
async function initBillSync() {
	if (globalThis._billRefreshInterval) return;
	// Set a placeholder immediately so concurrent requests don't double-trigger.
	globalThis._billRefreshInterval = true;

	try {
		const existing = await getRecentBills(1);
		if (existing.length === 0) {
			console.log('📭 DB empty on startup — seeding bills...');
			await fetchAndStoreBills({ congress: CURRENT_CONGRESS, limit: 40 });
			console.log('✅ Initial seed complete.');
		}
	} catch (err) {
		console.error('❌ Startup seed failed:', err);
	}

	globalThis._billRefreshInterval = setInterval(refreshBills, POLL_INTERVAL_MS);
	console.log(`⏱️  Bill refresh scheduled every ${POLL_INTERVAL_MS / 60000} minutes.`);
}

// Export a handle function so SvelteKit loads this hooks file
export async function handle({ event, resolve }) {
	// Trigger bill sync on the first request (non-blocking).
	initBillSync().catch((err) => console.error('❌ initBillSync failed:', err));
	// Add CORS headers for cross-origin requests
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization'
			}
		});
	}

	const response = await resolve(event);

	// Add CORS headers to all responses
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

	return response;
}
