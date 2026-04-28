import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import mongo from '$lib/db/mongo.js';

export const FEC_BULK_METADATA_DATASETS = ['linkage', 'committees', 'candidates'];
export const FEC_BULK_FINANCE_DATASETS = [
	'committee-summaries',
	'individual-contributions',
	'committee-transactions'
];
export const FEC_BULK_ALL_DATASETS = [...FEC_BULK_METADATA_DATASETS, ...FEC_BULK_FINANCE_DATASETS];

const BULK_STATUS_COLLECTION = 'fec_bulk_import_status';

const DATASET_CONFIG = {
	linkage: {
		remotePath(cycle) {
			return `${cycle}/ccl${String(cycle).slice(-2)}.zip`;
		},
		collection: 'fec_candidate_committee_links',
		format: 'pipe',
		buildDocument(fields) {
			const [
				candidateId,
				candidateElectionYear,
				fecElectionYear,
				committeeId,
				committeeType,
				committeeDesignation,
				linkageId
			] = fields;

			if (!candidateId || !committeeId || !linkageId) {
				return null;
			}

			return {
				_id: String(linkageId).trim(),
				candidateId: String(candidateId).trim(),
				candidateElectionYear: normalizeNumber(candidateElectionYear),
				fecElectionYear: normalizeNumber(fecElectionYear),
				committeeId: String(committeeId).trim(),
				committeeType: normalizeString(committeeType),
				committeeDesignation: normalizeString(committeeDesignation),
				linkageId: String(linkageId).trim()
			};
		},
		indexes: [{ key: { candidateId: 1, fecElectionYear: -1 } }, { key: { committeeId: 1 } }]
	},
	candidates: {
		remotePath(cycle) {
			return `${cycle}/cn${String(cycle).slice(-2)}.zip`;
		},
		collection: 'fec_candidates',
		format: 'pipe',
		buildDocument(fields) {
			const [
				candidateId,
				candidateName,
				partyCode,
				electionYear,
				officeState,
				office,
				district,
				incumbentStatus,
				candidateStatus,
				principalCommitteeId,
				street1,
				street2,
				city,
				state,
				zip
			] = fields;

			if (!candidateId) {
				return null;
			}

			return {
				_id: String(candidateId).trim(),
				candidateId: String(candidateId).trim(),
				candidateName: normalizeString(candidateName),
				partyCode: normalizeString(partyCode),
				electionYear: normalizeNumber(electionYear),
				officeState: normalizeString(officeState),
				office: normalizeString(office),
				district: normalizeString(district),
				incumbentStatus: normalizeString(incumbentStatus),
				candidateStatus: normalizeString(candidateStatus),
				principalCommitteeId: normalizeString(principalCommitteeId),
				address: {
					street1: normalizeString(street1),
					street2: normalizeString(street2),
					city: normalizeString(city),
					state: normalizeString(state),
					zip: normalizeString(zip)
				}
			};
		},
		indexes: [{ key: { candidateName: 1 } }, { key: { principalCommitteeId: 1 } }]
	},
	committees: {
		remotePath(cycle) {
			return `${cycle}/cm${String(cycle).slice(-2)}.zip`;
		},
		collection: 'fec_committees',
		format: 'pipe',
		buildDocument(fields) {
			const [
				committeeId,
				name,
				treasurer,
				street1,
				street2,
				city,
				state,
				zip,
				designation,
				type,
				party,
				filingFrequency,
				organizationType,
				connectedOrgName,
				candidateId
			] = fields;

			if (!committeeId) {
				return null;
			}

			return {
				_id: String(committeeId).trim(),
				committeeId: String(committeeId).trim(),
				name: normalizeString(name),
				treasurer: normalizeString(treasurer),
				address: {
					street1: normalizeString(street1),
					street2: normalizeString(street2),
					city: normalizeString(city),
					state: normalizeString(state),
					zip: normalizeString(zip)
				},
				designation: normalizeString(designation),
				type: normalizeString(type),
				party: normalizeString(party),
				filingFrequency: normalizeString(filingFrequency),
				organizationType: normalizeString(organizationType),
				connectedOrgName: normalizeString(connectedOrgName),
				candidateId: normalizeString(candidateId)
			};
		},
		indexes: [{ key: { candidateId: 1 } }, { key: { name: 1 } }]
	},
	'committee-summaries': {
		remotePath(cycle) {
			return `${cycle}/committee_summary_${cycle}.csv`;
		},
		collection: 'fec_committee_summaries',
		format: 'csv',
		buildDocument(record, { cycle }) {
			const committeeId = normalizeString(record.CMTE_ID);
			if (!committeeId) {
				return null;
			}

			const fecElectionYear = normalizeNumber(record.FEC_ELECTION_YR) ?? cycle;
			return {
				_id: `${committeeId}:${fecElectionYear}`,
				committeeId,
				committeeName: normalizeString(record.CMTE_NM),
				committeeType: normalizeString(record.CMTE_TP),
				committeeDesignation: normalizeString(record.CMTE_DSGN),
				filingFrequency: normalizeString(record.CMTE_FILING_FREQ),
				candidateId: normalizeString(record.CAND_ID),
				fecElectionYear,
				individualContributions: normalizeCurrency(record.INDV_CONTB),
				partyCommitteeContributions: normalizeCurrency(record.PTY_CMTE_CONTB),
				otherCommitteeContributions: normalizeCurrency(record.OTH_CMTE_CONTB),
				totalContributions: normalizeCurrency(record.TTL_CONTB),
				totalReceipts: normalizeCurrency(record.TTL_RECEIPTS),
				totalDisbursements: normalizeCurrency(record.TTL_DISB),
				cashOnHandBeginning: normalizeCurrency(record.COH_BOP),
				cashOnHandClosing: normalizeCurrency(record.COH_COP),
				coverageStartDate: normalizeSlashDate(record.CVG_START_DT),
				coverageEndDate: normalizeSlashDate(record.CVG_END_DT),
				sourceCycle: cycle
			};
		},
		indexes: [{ key: { committeeId: 1, fecElectionYear: -1 } }, { key: { candidateId: 1 } }]
	},
	'individual-contributions': {
		remotePath(cycle) {
			return `${cycle}/indiv${String(cycle).slice(-2)}.zip`;
		},
		collection: 'fec_individual_contributions',
		format: 'pipe',
		buildDocument(fields, { cycle }) {
			const [
				committeeId,
				amendmentIndicator,
				reportType,
				transactionPgi,
				imageNumber,
				transactionType,
				entityType,
				name,
				city,
				state,
				zipCode,
				employer,
				occupation,
				transactionDate,
				transactionAmount,
				otherId,
				transactionId,
				fileNumber,
				memoCode,
				memoText,
				subId
			] = fields;

			if (!committeeId || !subId) {
				return null;
			}

			return {
				_id: String(subId).trim(),
				subId: String(subId).trim(),
				committeeId: String(committeeId).trim(),
				amendmentIndicator: normalizeString(amendmentIndicator),
				reportType: normalizeString(reportType),
				transactionPgi: normalizeString(transactionPgi),
				imageNumber: normalizeString(imageNumber),
				transactionType: normalizeString(transactionType),
				entityType: normalizeString(entityType),
				donorName: normalizeString(name),
				city: normalizeString(city),
				state: normalizeString(state),
				zipCode: normalizeString(zipCode),
				employer: normalizeString(employer),
				occupation: normalizeString(occupation),
				transactionDate: normalizeCompactDate(transactionDate),
				transactionAmount: normalizeCurrency(transactionAmount),
				otherId: normalizeString(otherId),
				transactionId: normalizeString(transactionId),
				fileNumber: normalizeString(fileNumber),
				memoCode: normalizeString(memoCode),
				memoText: normalizeString(memoText),
				sourceCycle: cycle
			};
		},
		indexes: [
			{ key: { committeeId: 1, transactionDate: -1 } },
			{ key: { committeeId: 1, donorName: 1 } }
		]
	},
	'committee-transactions': {
		remotePath(cycle) {
			return `${cycle}/oth${String(cycle).slice(-2)}.zip`;
		},
		collection: 'fec_committee_transactions',
		format: 'pipe',
		buildDocument(fields, { cycle }) {
			const [
				committeeId,
				amendmentIndicator,
				reportType,
				transactionPgi,
				imageNumber,
				transactionType,
				entityType,
				donorName,
				city,
				state,
				zipCode,
				employer,
				occupation,
				transactionDate,
				transactionAmount,
				otherId,
				transactionId,
				fileNumber,
				memoCode,
				memoText,
				subId
			] = fields;

			if (!committeeId || !subId) {
				return null;
			}

			return {
				_id: String(subId).trim(),
				subId: String(subId).trim(),
				committeeId: String(committeeId).trim(),
				amendmentIndicator: normalizeString(amendmentIndicator),
				reportType: normalizeString(reportType),
				transactionPgi: normalizeString(transactionPgi),
				imageNumber: normalizeString(imageNumber),
				transactionType: normalizeString(transactionType),
				entityType: normalizeString(entityType),
				otherCommitteeName: normalizeString(donorName),
				city: normalizeString(city),
				state: normalizeString(state),
				zipCode: normalizeString(zipCode),
				employer: normalizeString(employer),
				occupation: normalizeString(occupation),
				transactionDate: normalizeCompactDate(transactionDate),
				transactionAmount: normalizeCurrency(transactionAmount),
				otherId: normalizeString(otherId),
				transactionId: normalizeString(transactionId),
				fileNumber: normalizeString(fileNumber),
				memoCode: normalizeString(memoCode),
				memoText: normalizeString(memoText),
				sourceCycle: cycle
			};
		},
		indexes: [{ key: { committeeId: 1, transactionDate: -1 } }, { key: { otherId: 1 } }]
	}
};

function normalizeString(value) {
	const normalized = String(value || '').trim();
	return normalized || null;
}

function normalizeNumber(value) {
	const normalized = Number.parseInt(String(value || '').trim(), 10);
	return Number.isFinite(normalized) ? normalized : null;
}

function normalizeCurrency(value) {
	const normalized = Number.parseFloat(
		String(value || '')
			.replace(/[$,]/g, '')
			.trim()
	);
	return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeCompactDate(value) {
	const digits = String(value || '').replace(/\D/g, '');
	if (digits.length !== 8) {
		return '';
	}

	const month = digits.slice(0, 2);
	const day = digits.slice(2, 4);
	const year = digits.slice(4, 8);
	return `${year}-${month}-${day}`;
}

function normalizeSlashDate(value) {
	const match = String(value || '')
		.trim()
		.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) {
		return '';
	}

	const [, month, day, year] = match;
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function currentCycleYear() {
	const year = new Date().getFullYear();
	return year % 2 === 0 ? year : year + 1;
}

export function parseFecBulkArgs(argv) {
	const args = {
		cycle: currentCycleYear(),
		datasets: [...FEC_BULK_METADATA_DATASETS],
		file: null,
		onlyIfChanged: false
	};

	for (let index = 0; index < argv.length; index++) {
		const part = argv[index];
		if (part === '--cycle') {
			args.cycle = Number.parseInt(argv[++index], 10);
		} else if (part === '--datasets') {
			args.datasets = String(argv[++index] || '')
				.split(',')
				.map((entry) => entry.trim())
				.filter(Boolean);
		} else if (part === '--file') {
			args.file = argv[++index] || null;
		} else if (part === '--only-if-changed') {
			args.onlyIfChanged = true;
		}
	}

	return args;
}

export function buildRemoteZipUrl(dataset, cycle) {
	return `https://www.fec.gov/files/bulk-downloads/${dataset.remotePath(cycle)}`;
}

function formatBytes(bytes) {
	const value = Number(bytes) || 0;
	if (value < 1024) {
		return `${value} B`;
	}
	if (value < 1024 * 1024) {
		return `${(value / 1024).toFixed(1)} KB`;
	}
	if (value < 1024 * 1024 * 1024) {
		return `${(value / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function renderProgressBar(progress) {
	const width = 24;
	const normalized = Math.max(0, Math.min(1, progress || 0));
	const filled = Math.round(normalized * width);
	return `${'='.repeat(filled)}${'.'.repeat(width - filled)}`;
}

async function downloadToTempFile(url, filename) {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'tc-fec-'));
	const filePath = path.join(tmpDir, filename);
	const timeoutMs = Number.parseInt(process.env.FEC_BULK_DOWNLOAD_TIMEOUT_MS ?? '120000', 10);
	const controller = new AbortController();
	let timeout = setTimeout(() => controller.abort(), timeoutMs);
	const response = await fetch(url, {
		signal: controller.signal,
		redirect: 'follow'
	});
	if (!response.ok) {
		clearTimeout(timeout);
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}

	if (!response.body) {
		clearTimeout(timeout);
		throw new Error(`No response body when downloading ${url}`);
	}

	const totalBytes = Number.parseInt(response.headers.get('content-length') || '0', 10) || 0;
	const writer = createWriteStream(filePath);
	const reader = response.body.getReader();
	const startedAt = Date.now();
	let downloadedBytes = 0;
	let nextLogAt = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			clearTimeout(timeout);
			timeout = setTimeout(() => controller.abort(), timeoutMs);

			downloadedBytes += value.byteLength;
			if (!writer.write(Buffer.from(value))) {
				await new Promise((resolve, reject) => {
					const onDrain = () => {
						writer.off('error', onError);
						resolve();
					};
					const onError = (error) => {
						writer.off('drain', onDrain);
						reject(error);
					};

					writer.once('drain', onDrain);
					writer.once('error', onError);
				});
			}

			const percent = totalBytes > 0 ? downloadedBytes / totalBytes : 0;
			if (
				totalBytes > 0 &&
				(percent >= nextLogAt || downloadedBytes === totalBytes || nextLogAt === 0)
			) {
				const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
				const rate = downloadedBytes / elapsedSeconds;
				const percentageLabel = `${(percent * 100).toFixed(1)}%`;
				console.log(
					`[FEC bulk] Download ${filename} [${renderProgressBar(percent)}] ${percentageLabel} (${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} at ${formatBytes(rate)}/s)`
				);
				nextLogAt += 0.05;
			} else if (totalBytes === 0 && downloadedBytes >= nextLogAt) {
				console.log(
					`[FEC bulk] Download ${filename} ${formatBytes(downloadedBytes)} received (content-length unavailable)`
				);
				nextLogAt = downloadedBytes + 5 * 1024 * 1024;
			}
		}

		await new Promise((resolve, reject) => {
			writer.end((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	} finally {
		clearTimeout(timeout);
		reader.releaseLock();
	}

	console.log(
		`[FEC bulk] Download complete for ${filename} (${formatBytes(downloadedBytes)}${totalBytes > 0 ? ` / ${formatBytes(totalBytes)}` : ''})`
	);

	return {
		filePath,
		tmpDir
	};
}

async function execFile(command, args) {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
				return;
			}

			reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout}`));
		});
	});
}

async function getZipFirstEntry(zipPath) {
	console.log(`[FEC bulk] Inspecting zip entries for ${zipPath}`);
	const output = await execFile('unzip', ['-Z1', zipPath]);
	const firstEntry = output
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)[0];

	if (!firstEntry) {
		throw new Error(`No entries found inside ${zipPath}`);
	}

	console.log(`[FEC bulk] Using zip entry ${firstEntry}`);
	return firstEntry;
}

async function* iterateSourceLines(filePath) {
	const isZip = filePath.toLowerCase().endsWith('.zip');
	let child = null;
	let rl = null;

	try {
		if (isZip) {
			const firstEntry = await getZipFirstEntry(filePath);
			console.log(`[FEC bulk] Starting streamed unzip for ${firstEntry}`);
			child = spawn('unzip', ['-p', filePath, firstEntry], {
				stdio: ['ignore', 'pipe', 'pipe']
			});

			let stderr = '';
			child.stderr.on('data', (chunk) => {
				stderr += chunk.toString();
			});

			rl = readline.createInterface({
				input: child.stdout,
				crlfDelay: Infinity
			});

			let lineCount = 0;
			for await (const line of rl) {
				lineCount++;
				if (lineCount === 1) {
					console.log(`[FEC bulk] First line received from ${firstEntry}`);
				}
				if (lineCount === 1000) {
					console.log(`[FEC bulk] First 1,000 lines received from ${firstEntry}`);
				}
				yield line;
			}

			const exitCode = await new Promise((resolve, reject) => {
				child.on('error', reject);
				child.on('close', resolve);
			});

			if (exitCode !== 0) {
				throw new Error(`unzip -p ${filePath} failed: ${stderr}`);
			}

			console.log(
				`[FEC bulk] Finished streamed unzip for ${firstEntry} (${lineCount.toLocaleString()} lines)`
			);
			return;
		}

		console.log(`[FEC bulk] Reading plain text file ${filePath}`);
		rl = readline.createInterface({
			input: createReadStream(filePath),
			crlfDelay: Infinity
		});

		let lineCount = 0;
		for await (const line of rl) {
			lineCount++;
			if (lineCount === 1) {
				console.log(`[FEC bulk] First line received from ${filePath}`);
			}
			yield line;
		}
		console.log(
			`[FEC bulk] Finished reading plain text file ${filePath} (${lineCount.toLocaleString()} lines)`
		);
	} finally {
		rl?.close();
		if (child && !child.killed) {
			child.kill();
		}
	}
}

function parseCsvLine(line) {
	const values = [];
	let current = '';
	let inQuotes = false;

	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		const next = line[index + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"';
				index++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === ',' && !inQuotes) {
			values.push(current);
			current = '';
			continue;
		}

		current += char;
	}

	values.push(current);
	return values;
}

function toRecord(headers, row) {
	const record = {};
	for (let index = 0; index < headers.length; index++) {
		record[headers[index]] = row[index] ?? '';
	}
	return record;
}

async function importDataset(db, datasetKey, lineIterator, options) {
	const dataset = DATASET_CONFIG[datasetKey];
	if (!dataset) {
		throw new Error(`Unknown dataset: ${datasetKey}`);
	}

	const collection = db.collection(dataset.collection);
	const operations = [];
	let rows = 0;
	let imported = 0;
	let headers = null;
	let nextProgressLogAt = 1000;
	const startedAt = Date.now();

	console.log(`[FEC bulk] Starting dataset import for ${datasetKey} into ${dataset.collection}`);

	function logImportProgress(extra = '') {
		const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
		const rowsPerSecond = Math.round(rows / elapsedSeconds);
		console.log(
			`[FEC bulk] Importing ${datasetKey}: ${rows.toLocaleString()} rows scanned, ${imported.toLocaleString()} writes applied${extra ? `, ${extra}` : ''} (${rowsPerSecond.toLocaleString()} rows/s)`
		);
	}

	for await (const rawLine of lineIterator) {
		const line = String(rawLine || '').replace(/\r$/, '');
		if (!line.trim()) {
			continue;
		}

		if (dataset.format === 'csv' && !headers) {
			headers = parseCsvLine(line).map((value) => value.trim());
			console.log(`[FEC bulk] Parsed header row for ${datasetKey} (${headers.length} columns)`);
			continue;
		}

		rows++;
		const document =
			dataset.format === 'csv'
				? dataset.buildDocument(toRecord(headers, parseCsvLine(line)), options)
				: dataset.buildDocument(line.split('|'), options);

		if (!document) {
			continue;
		}

		operations.push({
			replaceOne: {
				filter: { _id: document._id },
				replacement: document,
				upsert: true
			}
		});

		if (operations.length >= 1000) {
			const result = await collection.bulkWrite(operations, { ordered: false });
			imported += result.upsertedCount + result.modifiedCount + result.matchedCount;
			operations.length = 0;
		}

		if (rows >= nextProgressLogAt) {
			logImportProgress(`batch queue ${operations.length.toLocaleString()}`);
			nextProgressLogAt =
				nextProgressLogAt < 10000 ? nextProgressLogAt + 1000 : nextProgressLogAt + 50000;
		}
	}

	if (operations.length > 0) {
		const result = await collection.bulkWrite(operations, { ordered: false });
		imported += result.upsertedCount + result.modifiedCount + result.matchedCount;
	}

	logImportProgress('finalizing indexes');

	for (const index of dataset.indexes) {
		await collection.createIndex(index.key);
	}

	return {
		collection: dataset.collection,
		rows,
		imported
	};
}

async function fetchRemoteDatasetMetadata(url) {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		if (!response.ok) {
			return null;
		}

		return {
			etag: normalizeString(response.headers.get('etag')),
			lastModified: normalizeString(response.headers.get('last-modified')),
			contentLength: normalizeString(response.headers.get('content-length'))
		};
	} catch (error) {
		console.warn(`[FEC bulk] HEAD request failed for ${url}: ${error.message}`);
		return null;
	}
}

function metadataChanged(previous, next) {
	if (!next) {
		return true;
	}

	if (!previous) {
		return true;
	}

	return ['etag', 'lastModified', 'contentLength'].some((key) => {
		if (!next[key]) {
			return false;
		}

		return previous[key] !== next[key];
	});
}

async function loadImportStatus(db, datasetKey, cycle) {
	return await db.collection(BULK_STATUS_COLLECTION).findOne({
		_id: `${datasetKey}:${cycle}`
	});
}

async function writeImportStatus(db, datasetKey, cycle, payload) {
	await db.collection(BULK_STATUS_COLLECTION).updateOne(
		{ _id: `${datasetKey}:${cycle}` },
		{
			$set: {
				dataset: datasetKey,
				cycle,
				...payload
			}
		},
		{ upsert: true }
	);
}

export async function getFecBulkImportStatus(db, datasetKey, cycle) {
	return await loadImportStatus(db, datasetKey, cycle);
}

export async function importFecBulkData(options = {}) {
	const args = {
		cycle: options.cycle ?? currentCycleYear(),
		datasets: options.datasets ?? [...FEC_BULK_METADATA_DATASETS],
		file: options.file ?? null,
		onlyIfChanged: Boolean(options.onlyIfChanged)
	};
	const db = await mongo();
	const summaries = [];
	console.log('Importing FEC bulk data for cycle', args.cycle);

	for (const datasetKey of args.datasets) {
		const dataset = DATASET_CONFIG[datasetKey];
		if (!dataset) {
			throw new Error(
				`Unsupported dataset "${datasetKey}". Use one or more of: ${Object.keys(DATASET_CONFIG).join(', ')}`
			);
		}

		let filePath = args.file;
		let tmpDir = null;
		const url = args.file ? null : buildRemoteZipUrl(dataset, args.cycle);

		try {
			const remoteMetadata = url ? await fetchRemoteDatasetMetadata(url) : null;
			if (args.onlyIfChanged && url) {
				const previousStatus = await loadImportStatus(db, datasetKey, args.cycle);
				if (!metadataChanged(previousStatus, remoteMetadata)) {
					const skippedSummary = {
						dataset: datasetKey,
						cycle: args.cycle,
						collection: dataset.collection,
						skipped: true,
						reason: 'unchanged',
						url
					};
					summaries.push(skippedSummary);
					console.log(`[FEC bulk] Skipping unchanged dataset ${datasetKey}`);
					continue;
				}
			}

			if (!filePath) {
				console.log(`[FEC bulk] Downloading ${datasetKey} from ${url}`);
				const filename = path.basename(new URL(url).pathname);
				const download = await downloadToTempFile(url, filename);
				filePath = download.filePath;
				tmpDir = download.tmpDir;
			} else {
				console.log(`[FEC bulk] Using local file for ${datasetKey}: ${filePath}`);
			}

			const summary = await importDataset(db, datasetKey, iterateSourceLines(filePath), {
				cycle: args.cycle
			});
			const completedAt = new Date().toISOString();
			summaries.push({
				dataset: datasetKey,
				cycle: args.cycle,
				...summary,
				skipped: false,
				url
			});

			await writeImportStatus(db, datasetKey, args.cycle, {
				collection: dataset.collection,
				url,
				etag: remoteMetadata?.etag || null,
				lastModified: remoteMetadata?.lastModified || null,
				contentLength: remoteMetadata?.contentLength || null,
				rows: summary.rows,
				imported: summary.imported,
				lastImportedAt: completedAt
			});

			console.log(`[FEC bulk] Imported ${datasetKey}`, summary);
		} finally {
			if (tmpDir) {
				await rm(tmpDir, { recursive: true, force: true });
			}
		}
	}

	return summaries;
}
