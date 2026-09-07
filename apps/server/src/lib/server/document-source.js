const ALLOWED_HOSTS = new Set([
	'www.congress.gov',
	'congress.gov',
	'www.govinfo.gov',
	'govinfo.gov'
]);

export function validateDocumentUrl(value, { pdfOnly = false } = {}) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw Object.assign(new Error('Invalid document URL'), { status: 400 });
	}
	if (
		url.protocol !== 'https:' ||
		!ALLOWED_HOSTS.has(url.hostname) ||
		url.username ||
		url.password ||
		(url.port && url.port !== '443') ||
		(pdfOnly && !url.pathname.toLowerCase().endsWith('.pdf'))
	) {
		throw Object.assign(new Error('Only Congress.gov and GovInfo HTTPS documents are supported'), {
			status: 400
		});
	}
	url.hash = '';
	return url.href;
}

export async function fetchDocument(value, { fetcher = fetch, signal, pdfOnly = false } = {}) {
	let target = validateDocumentUrl(value, { pdfOnly });
	for (let redirects = 0; redirects <= 3; redirects++) {
		const response = await fetcher(target, { signal, redirect: 'manual' });
		if (![301, 302, 303, 307, 308].includes(response.status)) return response;
		await response.body?.cancel();
		const location = response.headers.get('location');
		if (!location || redirects === 3) throw new Error('Invalid document redirect');
		target = validateDocumentUrl(new URL(location, target).href, { pdfOnly });
	}
}
