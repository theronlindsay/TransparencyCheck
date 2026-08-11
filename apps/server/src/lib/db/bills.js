/**
 * Bill-related database operations — re-exported from the repository.
 * The repository handles Mongo-first with SQLite fallback automatically.
 */

export {
	saveBill,
	saveBillActions,
	saveTextVersion,
	getBillById,
	getBillTextVersions,
	getBillActions,
	getRecentBills,
	fetchAndStoreTextVersions
} from '$lib/db/repository.js';

// ─── Higher-level helpers ────────────────────────────────────────────────────

import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { getRecentBills } from '$lib/db/repository.js';

export async function syncAndFetchBills() {
	try {
		await fetchAndStoreBills({ congress: 119, limit: 40 });
		return await getRecentBills(100);
	} catch (err) {
		console.error('Error syncing bills:', err);
		return await getRecentBills(100);
	}
}
