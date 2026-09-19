import test from 'node:test';
import assert from 'node:assert/strict';
import {
	billTextVersionsUrl,
	createTextVersionLoader,
	importTextVersionMetadata
} from './bill-text-versions.js';

// Matches the live HR144 record that failed to discover text versions.
const bill = {
	_id: 'HR144',
	type: 'HR',
	billNumber: '144',
	congress: 119,
	textVersionsCount: null,
	textVersionsUrl: null
};
const version = {
	type: 'Introduced in House',
	date: '2025-01-03',
	formats: [
		{ type: 'PDF', url: 'https://www.congress.gov/119/bills/hr144/BILLS-119hr144ih.pdf' },
		{ type: 'Formatted Text', url: 'https://www.congress.gov/119/bills/hr144/BILLS-119hr144ih.htm' }
	]
};

test('discovers text versions for a lightweight bill without count or URL metadata', async () => {
	const rows = [];
	const requests = [];
	const readVersions = async () => rows;
	const load = createTextVersionLoader({
		readVersions,
		getApiKey: () => ' test-key ',
		fetchVersions: (id, source, key) =>
			importTextVersionMetadata(id, source, key, {
				readVersions,
				fetcher: async (url) => {
					requests.push(new URL(url));
					return Response.json({ textVersions: [version] });
				},
				saveVersion: async (id, metadata, format, content) => {
					assert.equal(content, undefined);
					rows.push({ billId: id, type: metadata.type, formatType: format.type, url: format.url });
				}
			})
	});
	assert.equal((await load(bill)).length, 2);
	assert.equal(requests.length, 1, 'metadata discovery must not download HTML or PDF content');
	assert.equal(requests[0].pathname, '/v3/bill/119/hr/144/text');
	assert.equal(requests[0].searchParams.get('api_key'), 'test-key');
	assert.equal(requests[0].searchParams.get('format'), 'json');
	await load(bill);
	assert.equal(requests.length, 1, 'existing version links are served from the database');
});

test('constructs version endpoint from bill identity, with no hardcoded congress', () => {
	assert.equal(
		billTextVersionsUrl({ _id: 'S12', congress: 118 }),
		'https://api.congress.gov/v3/bill/118/s/12/text'
	);
	assert.equal(
		billTextVersionsUrl({ ...bill, billNumber: 'HR.144' }),
		'https://api.congress.gov/v3/bill/119/hr/144/text'
	);
	assert.throws(() => billTextVersionsUrl({ ...bill, congress: null }), { status: 422 });
});

test('adds API query parameters correctly to endpoints with and without existing queries', async () => {
	for (const suffix of ['', '?format=xml&api_key=old']) {
		await importTextVersionMetadata('HR144', billTextVersionsUrl(bill) + suffix, 'new-key', {
			fetcher: async (url) => {
				assert.equal(url.searchParams.get('api_key'), 'new-key');
				assert.equal(url.searchParams.getAll('api_key').length, 1);
				assert.equal(url.searchParams.get('format'), 'json');
				return Response.json({ textVersions: [] });
			},
			saveVersion: async () => assert.fail('No versions to save'),
			readVersions: async () => []
		});
	}
});

test('reports upstream errors instead of returning a successful empty list', async () => {
	await assert.rejects(
		importTextVersionMetadata('HR144', billTextVersionsUrl(bill), 'key', {
			fetcher: async () => new Response('', { status: 403 }),
			saveVersion: async () => {},
			readVersions: async () => []
		}),
		{ status: 502 }
	);
});

test('coalesces identical lookups and bounds simultaneous discovery for other bills', async () => {
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	let calls = 0;
	const load = createTextVersionLoader({
		readVersions: async () => [],
		getApiKey: () => 'key',
		fetchVersions: async () => {
			calls++;
			await gate;
			return [];
		}
	});
	const first = load(bill);
	const second = load(bill);
	const other = load({ ...bill, _id: 'HR145', billNumber: '145' });
	await assert.rejects(load({ ...bill, _id: 'HR146', billNumber: '146' }), { status: 503 });
	release();
	await Promise.all([first, second, other]);
	assert.equal(calls, 2);
});

test('temporarily caches genuine empty results but retries after expiry', async () => {
	let time = 1000;
	let calls = 0;
	const load = createTextVersionLoader({
		readVersions: async () => [],
		getApiKey: () => 'key',
		now: () => time,
		fetchVersions: async () => {
			calls++;
			return [];
		}
	});
	await load(bill);
	await load(bill);
	assert.equal(calls, 1);
	time += 60001;
	await load(bill);
	assert.equal(calls, 2);
});

test('serves cached versions without a key and reports missing configuration on a cache miss', async () => {
	const load = createTextVersionLoader({
		readVersions: async () => [],
		getApiKey: () => '',
		fetchVersions: async () => assert.fail('No key')
	});
	await assert.rejects(load(bill), { status: 503 });
	const cached = createTextVersionLoader({
		readVersions: async () => [version],
		getApiKey: () => '',
		fetchVersions: async () => assert.fail('Already cached')
	});
	assert.deepEqual(await cached(bill), [version]);
});

test('follows metadata pagination without trusting an arbitrary next-page URL', async () => {
	const offsets = [];
	await importTextVersionMetadata('HR144', billTextVersionsUrl(bill), 'key', {
		fetcher: async (url) => {
			offsets.push(url.searchParams.get('offset'));
			assert.equal(url.hostname, 'api.congress.gov');
			return Response.json({
				textVersions: [],
				pagination: offsets.length === 1 ? { next: 'https://untrusted.example/' } : {}
			});
		},
		saveVersion: async () => {},
		readVersions: async () => []
	});
	assert.deepEqual(offsets, ['0', '250']);
});
