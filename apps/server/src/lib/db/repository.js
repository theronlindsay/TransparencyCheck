/**
 * Database repository — single entry point for all DB operations.
 *
 * Usage:
 *   import { getBillById, saveBill, ... } from '$lib/db/repository.js';
 */

export {
	saveBill,
	saveBillActions,
	saveTextVersion,
	getBillById,
	getBillTextVersions,
	getBillActions,
	getRecentBills,
	searchBills
} from './adapters/mongo.js';

// ─── Higher-level operations ──────────────────────────────────────────────────

import { getBillTextVersions, saveTextVersion } from './adapters/mongo.js';

import { importTextVersionMetadata } from '../server/bill-text-versions.js';

/** Discover document links without downloading every text version into RAM. */
export async function fetchAndStoreTextVersions(billId, textVersionsUrl, apiKey) {
	return await importTextVersionMetadata(billId, textVersionsUrl, apiKey, {
		saveVersion: saveTextVersion,
		readVersions: getBillTextVersions
	});
}
