import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function downloadFile(
	url,
	filename,
	{
		fetcher = fetch,
		tempRoot = os.tmpdir(),
		timeoutMs = 120000,
		maxBytes = 2 * 1024 * 1024 * 1024,
		onProgress = () => {}
	} = {}
) {
	const tmpDir = await mkdtemp(path.join(tempRoot, 'tc-fec-'));
	const filePath = path.join(tmpDir, path.basename(filename));
	const controller = new AbortController();
	let timeout;
	let response;
	const resetTimeout = () => {
		clearTimeout(timeout);
		timeout = setTimeout(() => controller.abort(), timeoutMs);
	};
	resetTimeout();
	try {
		response = await fetcher(url, { signal: controller.signal, redirect: 'follow' });
		if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
		const total = Number(response.headers.get('content-length')) || 0;
		if (total > maxBytes) throw new Error('Bulk download exceeds configured byte limit');
		let bytes = 0;
		const progress = new Transform({
			transform(chunk, encoding, callback) {
				resetTimeout();
				bytes += chunk.length;
				if (bytes > maxBytes)
					return callback(new Error('Bulk download exceeds configured byte limit'));
				onProgress(bytes, total);
				callback(null, chunk);
			}
		});
		await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(filePath), {
			signal: controller.signal
		});
		return { filePath, tmpDir };
	} catch (error) {
		await rm(tmpDir, { recursive: true, force: true });
		throw error;
	} finally {
		clearTimeout(timeout);
		controller.abort();
		if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
	}
}
