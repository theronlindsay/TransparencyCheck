import { Readable } from 'node:stream';
import { fetchDocument, validateDocumentUrl } from './document-source.js';

export function createBillTextFetcher({
	fetcher = fetch,
	maxBytes = 2 * 1024 * 1024,
	timeoutMs = 15000
} = {}) {
	let active;
	async function download(url) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		let response;
		try {
			response = await fetchDocument(url, { fetcher, signal: controller.signal });
			if (!response.ok || !response.body) throw new Error('Bill text source unavailable');
			const tooLarge = () =>
				Object.assign(new Error('Bill text exceeds the download limit'), { status: 413 });
			if (Number(response.headers.get('content-length')) > maxBytes) throw tooLarge();
			let bytes = 0;
			let text = '';
			const decoder = new TextDecoder();
			for await (const chunk of Readable.fromWeb(response.body, { signal: controller.signal })) {
				bytes += chunk.byteLength;
				if (bytes > maxBytes) throw tooLarge();
				text += decoder.decode(chunk, { stream: true });
			}
			return text + decoder.decode();
		} finally {
			clearTimeout(timeout);
			controller.abort();
			if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
		}
	}
	return function getText(value) {
		const url = validateDocumentUrl(value);
		if (active?.url === url) return active.promise;
		if (active)
			throw Object.assign(new Error('Bill text downloader is busy; retry shortly'), {
				status: 503
			});
		const promise = download(url).finally(() => {
			active = undefined;
		});
		active = { url, promise };
		return promise;
	};
}
