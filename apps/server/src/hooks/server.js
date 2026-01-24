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
fetchRecentBills();