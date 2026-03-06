/**
 * Main database module — re-exports from the repository for backward compatibility.
 * The repository handles MongoDB-first with automatic SQLite fallback.
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
} from './db/repository.js';
