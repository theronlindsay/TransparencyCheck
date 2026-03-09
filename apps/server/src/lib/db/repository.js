/**
 * Database repository — single entry point for all bill operations.
 *
 * Strategy: try MongoDB (via Prisma) first. If the operation throws or
 * returns no result, fall back to SQLite transparently. Callers never
 * need to know which database is active.
 *
 * Usage:
 *   import { getBillById, saveBill, ... } from '$lib/db/repository.js';
 */

import * as mongo from './adapters/mongo.js';
import * as sqlite from './adapters/sqlite.js';

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Run `mongoFn` first. If it throws, log the error and run `sqliteFn` instead.
 * @template T
 * @param {() => Promise<T>} mongoFn
 * @param {() => Promise<T>} sqliteFn
 * @param {string} label — used in log messages
 * @returns {Promise<T>}
 */
async function withFallback(mongoFn, sqliteFn, label) {
	try {
		return await mongoFn();
	} catch (err) {
		console.warn(`⚠️  MongoDB failed for "${label}", falling back to SQLite:`, err.message);
		return await sqliteFn();
	}
}

/**
 * Like withFallback, but also falls back when the result is null/empty.
 * Useful for reads where "not found in Mongo" should try SQLite.
 */
async function withFallbackOnEmpty(mongoFn, sqliteFn, label) {
	try {
		const result = await mongoFn();
		const isEmpty = result === null || result === undefined || (Array.isArray(result) && result.length === 0);
		if (!isEmpty) return result;
		console.log(`ℹ️  No results in MongoDB for "${label}", trying SQLite…`);
	} catch (err) {
		console.warn(`⚠️  MongoDB failed for "${label}", falling back to SQLite:`, err.message);
	}
	return await sqliteFn();
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Save (upsert) a bill. Writes to both MongoDB and SQLite so both stay in sync.
 * If Mongo fails, still writes to SQLite (and logs the error).
 */
export async function saveBill(billId, billStatus, bill) {
	let mongoOk = false;
	try {
		await mongo.saveBill(billId, billStatus, bill);
		mongoOk = true;
	} catch (err) {
		console.warn(`⚠️  MongoDB saveBill failed for ${billId}:`, err.message);
	}

	try {
		await sqlite.saveBill(billId, billStatus, bill);
	} catch (err) {
		if (!mongoOk) {
			// Both failed — surface the error
			throw new Error(`Both MongoDB and SQLite failed to save bill ${billId}: ${err.message}`);
		}
		console.warn(`⚠️  SQLite saveBill failed for ${billId} (Mongo succeeded):`, err.message);
	}
}

/**
 * Save bill actions. Writes to both databases; SQLite failure is non-fatal
 * if Mongo succeeded.
 */
export async function saveBillActions(billId, actions) {
	let mongoOk = false;
	try {
		await mongo.saveBillActions(billId, actions);
		mongoOk = true;
	} catch (err) {
		console.warn(`⚠️  MongoDB saveBillActions failed for ${billId}:`, err.message);
	}

	try {
		await sqlite.saveBillActions(billId, actions);
	} catch (err) {
		if (!mongoOk) throw err;
		console.warn(`⚠️  SQLite saveBillActions failed for ${billId} (Mongo succeeded):`, err.message);
	}
}

/**
 * Save a single text version. Writes to both databases.
 */
export async function saveTextVersion(billId, version, format, content, isFetched) {
	let mongoOk = false;
	try {
		await mongo.saveTextVersion(billId, version, format, content, isFetched);
		mongoOk = true;
	} catch (err) {
		console.warn(`⚠️  MongoDB saveTextVersion failed for ${billId}:`, err);
	}

	try {
		await sqlite.saveTextVersion(billId, version, format, content, isFetched);
	} catch (err) {
		if (!mongoOk) throw err;
		console.warn(`⚠️  SQLite saveTextVersion failed for ${billId} (Mongo succeeded):`, err);
	}
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Get a bill by ID. Tries Mongo first, falls back to SQLite. */
export async function getBillById(billId) {
	return await withFallbackOnEmpty(
		() => mongo.getBillById(billId),
		() => sqlite.getBillById(billId),
		`getBillById(${billId})`
	);
}

/** Get text versions for a bill. Tries Mongo first, falls back to SQLite. */
export async function getBillTextVersions(billId) {
	return await withFallbackOnEmpty(
		() => mongo.getBillTextVersions(billId),
		() => sqlite.getBillTextVersions(billId),
		`getBillTextVersions(${billId})`
	);
}

/** Get actions for a bill. Tries Mongo first, falls back to SQLite. */
export async function getBillActions(billId) {
	return await withFallbackOnEmpty(
		() => mongo.getBillActions(billId),
		() => sqlite.getBillActions(billId),
		`getBillActions(${billId})`
	);
}

/** Get the most recently updated bills. Tries Mongo first, falls back to SQLite. */
export async function getRecentBills(limit = 20) {
	return await withFallbackOnEmpty(
		() => mongo.getRecentBills(limit),
		() => sqlite.getRecentBills(limit),
		`getRecentBills(${limit})`
	);
}

// ─── Higher-level operations (unchanged interface) ────────────────────────────

/**
 * Fetch text versions from Congress.gov API and persist them via the repository.
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
		throw err; // Re-throw so callers know the operation failed
	}
}
