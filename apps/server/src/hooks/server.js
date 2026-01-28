import { initDatabase } from '$lib/db';
import { fetchAndStoreBills } from '$lib/bill-fetcher.js';

/**
 * Fetches bills updated in the last 3 days to keep the database fresh.
 * This runs in the background on server startup and does not block.
 */
async function fetchRecentBills() {
    console.log('Server startup: Kicking off background job to fetch recent bills...');
    try {
        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateTo.getDate() - 3);

        const fromString = dateFrom.toISOString().split('T')[0];
        const toString = dateTo.toISOString().split('T')[0];

        await fetchAndStoreBills({ dateFrom: fromString, dateTo: toString });
        console.log('Background job: Finished fetching recent bills.');
    } catch (error) {
        console.error('Background job: Error fetching recent bills:', error);
    }
}

// Initialize the database first.
await initDatabase();

// After DB is ready, fetch recent bills in the background.
// We don't await this so it doesn't block server startup.
fetchRecentBills().catch(err => {
    console.error('Background bill fetch failed:', err);
});

// Export a handle function so SvelteKit loads this hooks file
export async function handle({ event, resolve }) {
    // Add CORS headers for cross-origin requests
    if (event.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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