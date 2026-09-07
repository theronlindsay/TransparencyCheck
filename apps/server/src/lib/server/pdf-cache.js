import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { fetchDocument, validateDocumentUrl } from './document-source.js';

export function validatePdfUrl(value) {
	return validateDocumentUrl(value, { pdfOnly: true });
}

// A single downloader bounds memory, disk reservations and eviction races. Cache hits remain concurrent.
export function createPdfCache({
	directory = path.join(process.cwd(), '.cache', 'pdfs'),
	fetcher = fetch,
	maxBytes = 20 * 1024 * 1024,
	cacheBytes = 256 * 1024 * 1024,
	maxFiles = 128,
	ttlMs = 7 * 86400000,
	timeoutMs = 30000
} = {}) {
	let active = null;

	async function prune() {
		const entries = [];
		for (const name of await readdir(directory)) {
			if (!/^[a-f0-9]{64}\.pdf(?:\.part)?$/.test(name)) continue;
			const file = path.join(directory, name);
			const info = await stat(file);
			if (name.endsWith('.part') || Date.now() - info.mtimeMs > ttlMs) {
				await rm(file, { force: true });
			} else entries.push({ file, ...info });
		}
		entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
		let bytes = entries.reduce((sum, entry) => sum + entry.size, 0);
		while (entries.length && (bytes + maxBytes > cacheBytes || entries.length >= maxFiles)) {
			const entry = entries.shift();
			await rm(entry.file, { force: true });
			bytes -= entry.size;
		}
	}

	async function download(url, file) {
		await mkdir(directory, { recursive: true });
		await prune();
		const partial = `${file}.part`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		let response;
		try {
			response = await fetchDocument(url, { fetcher, signal: controller.signal, pdfOnly: true });
			if (!response.ok || !response.body) throw new Error('PDF source unavailable');
			if (Number(response.headers.get('content-length')) > maxBytes) {
				throw Object.assign(new Error('PDF exceeds the 20 MiB download limit'), { status: 413 });
			}
			let bytes = 0;
			const limiter = new Transform({
				transform(chunk, encoding, callback) {
					bytes += chunk.length;
					callback(
						bytes > maxBytes
							? Object.assign(new Error('PDF exceeds download limit'), { status: 413 })
							: null,
						chunk
					);
				}
			});
			await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(partial), {
				signal: controller.signal
			});
			await rename(partial, file);
		} finally {
			clearTimeout(timeout);
			controller.abort();
			if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
			await rm(partial, { force: true });
		}
	}

	async function openCached(file) {
		let handle;
		try {
			handle = await open(file, 'r');
			const info = await handle.stat();
			if (Date.now() - info.mtimeMs > ttlMs || info.size > maxBytes) {
				await handle.close();
				return null;
			}
			return {
				body: Readable.toWeb(handle.createReadStream(), {
					strategy: { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength }
				}),
				size: info.size
			};
		} catch (error) {
			await handle?.close();
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	}

	return async function getPdf(value) {
		const url = validatePdfUrl(value);
		const file = path.join(directory, `${createHash('sha256').update(url).digest('hex')}.pdf`);
		const cached = await openCached(file);
		if (cached) return cached;
		if (active && active.url !== url) {
			throw Object.assign(new Error('PDF downloader is busy; retry shortly'), { status: 503 });
		}
		if (!active) {
			const promise = download(url, file).finally(() => {
				active = null;
			});
			active = { url, promise };
		}
		await active.promise;
		const downloaded = await openCached(file);
		if (!downloaded) throw new Error('Cached PDF unavailable');
		return downloaded;
	};
}
