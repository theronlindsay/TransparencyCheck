const BILL_TYPES = new Set(['hr', 's', 'hres', 'sres', 'hjres', 'sjres', 'hconres', 'sconres']);

export function billTextVersionsUrl(bill) {
	const id = String(bill._id || bill.id || '').match(/^([a-z]+)(\d+)$/i);
	const type = String(bill.type || id?.[1] || '').toLowerCase();
	const number = String(bill.billNumber ?? bill.number ?? id?.[2] ?? '').match(
		/^(?:[a-z]+[.\s-]?)?(\d+)$/i
	)?.[1];
	const congress = Number(bill.congress);
	if (!BILL_TYPES.has(type) || !number || !Number.isSafeInteger(congress) || congress < 1) {
		throw Object.assign(
			new Error('Bill identifiers are incomplete; text versions cannot be located.'),
			{ status: 422 }
		);
	}
	return `https://api.congress.gov/v3/bill/${congress}/${type}/${number}/text`;
}

// Store only links and metadata. The bounded document proxies load selected content on demand.
export async function importTextVersionMetadata(
	billId,
	source,
	apiKey,
	{ fetcher = fetch, saveVersion, readVersions }
) {
	const url = new URL(source);
	if (
		url.origin !== 'https://api.congress.gov' ||
		!/^\/v3\/bill\/\d+\/[a-z]+\/\d+\/text$/.test(url.pathname)
	) {
		throw new Error('Invalid Congress text versions endpoint');
	}
	url.searchParams.set('api_key', apiKey.trim());
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', '250');
	const signal = AbortSignal.timeout(20000);
	for (let page = 0; page < 4; page++) {
		url.searchParams.set('offset', String(page * 250));
		const response = await fetcher(url, { signal, redirect: 'error' });
		if (!response.ok)
			throw Object.assign(
				new Error(`Congress text versions request failed (HTTP ${response.status})`),
				{ status: 502 }
			);
		const data = await response.json();
		if (!Array.isArray(data.textVersions))
			throw new Error('Invalid Congress text versions response');
		for (const version of data.textVersions) {
			for (const format of version.formats || []) {
				if (format.type && format.url) await saveVersion(billId, version, format);
			}
		}
		if (!data.pagination?.next) return await readVersions(billId);
	}
	throw new Error('Congress text versions pagination limit exceeded');
}

export function createTextVersionLoader({
	readVersions,
	fetchVersions,
	getApiKey,
	now = Date.now
}) {
	const active = new Map();
	const emptyUntil = new Map();
	return async function load(bill) {
		const billId = bill._id;
		if (active.has(billId)) return await active.get(billId);
		const cached = await readVersions(billId);
		if (cached.length > 0) return cached;
		if (active.has(billId)) return await active.get(billId);
		if ((emptyUntil.get(billId) || 0) > now()) return [];
		const apiKey = getApiKey()?.trim();
		if (!apiKey)
			throw Object.assign(new Error('Bill text service is not configured.'), { status: 503 });
		if (active.size >= 2)
			throw Object.assign(new Error('Bill text lookup is busy. Please retry shortly.'), {
				status: 503
			});
		const source = billTextVersionsUrl(bill);
		const pending = Promise.resolve()
			.then(() => fetchVersions(billId, source, apiKey))
			.then((versions) => {
				if (versions.length === 0) {
					if (emptyUntil.size >= 100) emptyUntil.delete(emptyUntil.keys().next().value);
					emptyUntil.set(billId, now() + 60000);
				}
				return versions;
			})
			.finally(() => active.delete(billId));
		active.set(billId, pending);
		return await pending;
	};
}
