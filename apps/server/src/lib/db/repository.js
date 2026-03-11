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

/**
 * Fetch text versions from Congress.gov API and persist them.
 */
export async function fetchAndStoreTextVersions(billId, textVersionsUrl, apiKey) {
	const url = `${textVersionsUrl}&api_key=${apiKey}`;
	console.log(`\n🔄 Fetching text versions for ${billId}`);
	console.log(`   URL: ${url}`);

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch text versions: ${response.status}`);

		const data = await response.json();
		const textVersions = data.textVersions || [];

		console.log(`📦 Found ${textVersions.length} text versions in API response`);
		if (textVersions.length === 0) return [];

		for (const version of textVersions) {
			if (!version.formats || !Array.isArray(version.formats)) continue;

			for (const format of version.formats) {
				const formatType = format.type?.toUpperCase();
				let content = null;
				let isFetched = 0;

				if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
					try {
						const contentResponse = await fetch(format.url);
						content = await contentResponse.text();
						isFetched = 1;
						console.log(`  ✅ Content downloaded for ${version.type} (${format.type})`);
					} catch (err) {
						console.error(`  ❌ Error downloading content:`, err.message);
					}
				}

				await saveTextVersion(billId, version, format, content, isFetched);
			}
		}

		return await getBillTextVersions(billId);
	} catch (err) {
		console.error(`Error fetching text versions for ${billId}:`, err);
		throw err;
	}
}
