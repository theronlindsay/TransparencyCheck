import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPdfCache, validatePdfUrl } from './pdf-cache.js';
import { downloadFile } from './download-file.js';
import { createJobGuard } from './job-guard.js';
import { createRefreshCache } from './refresh-cache.js';
import { escapeRegex } from '../db/adapters/search-utils.js';

const pdfUrl = 'https://www.congress.gov/119/bills/hr1/BILLS-119hr1ih.pdf';
const otherPdf = 'https://www.congress.gov/119/bills/hr2/BILLS-119hr2ih.pdf';
const deferred = () => {
	let resolve;
	const promise = new Promise((r) => {
		resolve = r;
	});
	return { promise, resolve };
};
async function temp(t) {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'tc-resource-test-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}
const consume = async (result) => new Response(result.body).text();

test('PDF allowlist rejects local hosts, credentials, ports and non-PDF URLs', () => {
	for (const value of [
		'http://www.congress.gov/a.pdf',
		'https://127.0.0.1/a.pdf',
		'https://www.congress.gov.evil.test/a.pdf',
		'https://user@www.congress.gov/a.pdf',
		'https://www.congress.gov:8080/a.pdf',
		'https://www.congress.gov/a.txt'
	]) {
		assert.throws(() => validatePdfUrl(value), { status: 400 });
	}
	assert.equal(validatePdfUrl(pdfUrl + '#page=2'), pdfUrl);
});

test('PDF download streams to cache and cache hits do not fetch again', async (t) => {
	let requests = 0;
	const get = createPdfCache({
		directory: await temp(t),
		fetcher: async () => {
			requests++;
			return new Response('%PDF-test');
		}
	});
	assert.equal(await consume(await get(pdfUrl)), '%PDF-test');
	assert.equal(await consume(await get(pdfUrl)), '%PDF-test');
	assert.equal(requests, 1);
});

test('PDF misses deduplicate identical requests and reject other downloads while busy', async (t) => {
	const started = deferred();
	const release = deferred();
	let requests = 0;
	const get = createPdfCache({
		directory: await temp(t),
		fetcher: async () => {
			requests++;
			started.resolve();
			await release.promise;
			return new Response('pdf');
		}
	});
	const first = get(pdfUrl);
	await started.promise;
	const second = get(pdfUrl);
	await assert.rejects(get(otherPdf), { status: 503 });
	release.resolve();
	assert.deepEqual(await Promise.all([first.then(consume), second.then(consume)]), ['pdf', 'pdf']);
	assert.equal(requests, 1);
});

test('PDF byte cap catches chunked responses and removes partial files', async (t) => {
	const directory = await temp(t);
	const get = createPdfCache({
		directory,
		maxBytes: 4,
		fetcher: async () => new Response('too large')
	});
	await assert.rejects(get(pdfUrl), { status: 413 });
	assert.deepEqual(await readdir(directory), []);
});

test('PDF redirect targets are validated before a second fetch', async (t) => {
	let calls = 0;
	const get = createPdfCache({
		directory: await temp(t),
		fetcher: async () => {
			calls++;
			return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/a.pdf' } });
		}
	});
	await assert.rejects(get(pdfUrl), { status: 400 });
	assert.equal(calls, 1);
});

test('PDF cache evicts to reserve room for the next bounded download', async (t) => {
	const directory = await temp(t);
	const get = createPdfCache({
		directory,
		maxBytes: 8,
		cacheBytes: 12,
		fetcher: async () => new Response('12345678')
	});
	await consume(await get(pdfUrl));
	await consume(await get(otherPdf));
	const files = await readdir(directory);
	assert.equal(files.length, 1);
	assert.equal((await stat(path.join(directory, files[0]))).size, 8);
});

test('PDF deadline aborts a stalled body and clears the downloader slot', async (t) => {
	let calls = 0;
	const directory = await temp(t);
	const get = createPdfCache({
		directory,
		timeoutMs: 30,
		fetcher: async () =>
			++calls === 1 ? new Response(new ReadableStream({ start() {} })) : new Response('pdf')
	});
	await assert.rejects(get(pdfUrl), { name: 'AbortError' });
	assert.deepEqual(await readdir(directory), []);
	assert.equal(await consume(await get(pdfUrl)), 'pdf');
});

test('bulk helper removes temp directory when fetch fails before headers', async (t) => {
	const tempRoot = await temp(t);
	await assert.rejects(
		downloadFile('https://example.test/a.zip', 'a.zip', {
			tempRoot,
			fetcher: async () => {
				throw new Error('offline');
			}
		}),
		/offline/
	);
	assert.deepEqual(await readdir(tempRoot), []);
});

test('bulk helper cleans partial downloads on size overflow', async (t) => {
	const tempRoot = await temp(t);
	await assert.rejects(
		downloadFile('https://example.test/a.zip', 'a.zip', {
			tempRoot,
			maxBytes: 2,
			fetcher: async () => new Response('large')
		}),
		/byte limit/
	);
	assert.deepEqual(await readdir(tempRoot), []);
});

test('bulk helper returns completed file for caller cleanup', async (t) => {
	const result = await downloadFile('https://example.test/a.zip', 'a.zip', {
		tempRoot: await temp(t),
		fetcher: async () => new Response('zip')
	});
	assert.equal(await readFile(result.filePath, 'utf8'), 'zip');
});

test('job guard permits nested jobs but rejects overlapping owners and releases after failure', async () => {
	const run = createJobGuard();
	const release = deferred();
	const started = deferred();
	const first = run('finance', async () => {
		assert.equal(await run('bulk', async () => 42), 42);
		started.resolve();
		await release.promise;
	});
	await started.promise;
	await assert.rejects(
		run('stocks', async () => {}),
		{ status: 409 }
	);
	release.resolve();
	await first;
	await assert.rejects(
		run('failed', async () => {
			throw new Error('failure');
		}),
		/failure/
	);
	assert.equal(await run('next', async () => 1), 1);
});

test('search refresh shares work, bounds concurrency and retries after TTL', async () => {
	let time = 0;
	let calls = 0;
	const release = deferred();
	const refresh = createRefreshCache({ now: () => time, ttlMs: 10 });
	const work = () => {
		calls++;
		return release.promise;
	};
	const first = refresh('same', work);
	assert.equal(refresh('same', work), first);
	assert.equal(await refresh('other', work), false);
	release.resolve();
	assert.equal(await first, true);
	assert.equal(await refresh('same', work), false);
	time = 11;
	assert.equal(await refresh('same', work), true);
	assert.equal(calls, 2);
});

test('search refresh backs off failures and evicts old query keys', async () => {
	let time = 0;
	const refresh = createRefreshCache({ now: () => time, ttlMs: 10, maxKeys: 1 });
	await assert.rejects(
		refresh('bad', async () => {
			throw new Error('offline');
		}),
		/offline/
	);
	assert.equal(await refresh('bad', async () => {}), false);
	assert.equal(await refresh('other', async () => {}), true);
	assert.equal(await refresh('bad', async () => {}), true);
	time = 20;
	assert.equal(await refresh('bad', async () => {}), true);
});

test('search input is matched literally, including regex metacharacters', () => {
	for (const value of ['(a+)+$', 'a.b', '[x]', 'a\\b', '^foo|bar?', '*']) {
		const regex = new RegExp(`^${escapeRegex(value)}$`);
		assert.equal(regex.test(value), true, value);
		assert.equal(regex.test('unrelated'), false, value);
	}
});

test('bill text decoding shares a bounded download and rejects other concurrent sources', async () => {
	const { createBillTextFetcher } = await import('./bill-text.js');
	const gate = deferred();
	const get = createBillTextFetcher({
		fetcher: async () => {
			await gate.promise;
			return new Response('bill text');
		}
	});
	const first = get('https://www.congress.gov/bill.htm');
	assert.equal(first, get('https://www.congress.gov/bill.htm'));
	assert.throws(() => get('https://www.congress.gov/other.htm'), { status: 503 });
	gate.resolve();
	assert.equal(await first, 'bill text');
});

test('bill text caps chunked responses and releases the slot on error', async () => {
	const { createBillTextFetcher } = await import('./bill-text.js');
	let calls = 0;
	const get = createBillTextFetcher({
		maxBytes: 4,
		fetcher: async () => new Response(++calls === 1 ? 'too large' : 'okay')
	});
	await assert.rejects(get('https://www.congress.gov/bill.htm'), { status: 413 });
	assert.equal(await get('https://www.congress.gov/bill.htm'), 'okay');
});

test('bill text deadline aborts stalled bodies and rejects redirect escapes', async () => {
	const { createBillTextFetcher } = await import('./bill-text.js');
	const stalled = createBillTextFetcher({
		timeoutMs: 30,
		fetcher: async () => new Response(new ReadableStream({ start() {} }))
	});
	await assert.rejects(stalled('https://www.congress.gov/bill.htm'), { name: 'AbortError' });
	const redirect = createBillTextFetcher({
		fetcher: async () =>
			new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })
	});
	await assert.rejects(redirect('https://www.congress.gov/bill.htm'), { status: 400 });
});
