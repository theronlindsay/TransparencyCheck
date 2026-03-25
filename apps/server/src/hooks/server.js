import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { getRecentBills } from '$lib/db/repository.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://localhost',
	'capacitor://localhost',
	'http://localhost'
];

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);

const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredCorsOrigins]);

function buildCorsHeaders(event) {
	const origin = event.request.headers.get('origin');
	if (!origin || !ALLOWED_ORIGINS.has(origin)) {
		return null;
	}

	const requestHeaders = event.request.headers.get('access-control-request-headers');

	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
		'Access-Control-Allow-Headers':
			requestHeaders || 'Content-Type, Authorization, X-Requested-With, Accept',
		Vary: 'Origin'
	};
}

async function refreshBills() {
	console.log('🔄 Background: refreshing bills from Congress.gov...');
	try {
		const dateFrom = new Date();
		dateFrom.setDate(dateFrom.getDate() - 3);
		await fetchAndStoreBills({ dateFrom: dateFrom.toISOString().split('T')[0] });
		console.log('✅ Background: bills refresh complete.');
	} catch (error) {
		console.error('❌ Background: bills refresh failed:', error);
	}
}

// On startup: seed if the DB is empty, then schedule periodic refresh.
// globalThis guard prevents duplicate intervals when Vite HMR re-executes this module.
async function initBillSync() {
	console.log('🧪 initBillSync called, guard =', globalThis._billRefreshInterval);
	if (globalThis._billRefreshInterval) return;
	// Set a placeholder immediately so concurrent requests don't double-trigger.
	globalThis._billRefreshInterval = true;

	try {
		const existing = await getRecentBills(1);
		if (existing.length === 0) {
			console.log('📭 DB empty on startup — seeding bills...');
			const dateFrom = `${new Date().getFullYear() - 1}-01-01`;
			await fetchAndStoreBills({ limit: 40, dateFrom });
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
	console.log('🪝 handle called:', event.request.method, event.url.pathname);
	// Trigger bill sync on the first request (non-blocking).
	initBillSync().catch((err) => console.error('❌ initBillSync failed:', err));
	const corsHeaders = buildCorsHeaders(event);

	// Handle preflight for allowed origins.
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders || {}
		});
	}

	const response = await resolve(event);

	if (corsHeaders) {
		for (const [header, value] of Object.entries(corsHeaders)) {
			response.headers.set(header, value);
		}
	}

	return response;
}
