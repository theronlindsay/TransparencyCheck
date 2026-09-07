import { json } from '@sveltejs/kit';
import { createPdfCache } from '$lib/server/pdf-cache.js';

const getPdf = createPdfCache();

export async function GET({ url }) {
	const value = url.searchParams.get('url');
	if (!value) return json({ error: 'URL parameter is required' }, { status: 400 });
	try {
		const { body, size } = await getPdf(value);
		return new Response(body, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Length': String(size),
				'Content-Disposition': 'inline; filename="bill.pdf"',
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} catch (error) {
		const status = error.status || 502;
		return json(
			{ error: error.status ? error.message : 'Unable to download PDF' },
			{
				status,
				headers: status === 503 ? { 'Retry-After': '5' } : {}
			}
		);
	}
}
