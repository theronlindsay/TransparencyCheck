import { json } from '@sveltejs/kit';
import { createBillTextFetcher } from '$lib/server/bill-text.js';

const getText = createBillTextFetcher();

export async function GET({ url }) {
	const billUrl = url.searchParams.get('url');
	if (!billUrl) return json({ error: 'URL parameter is required' }, { status: 400 });
	try {
		return json({ content: await getText(billUrl) });
	} catch (error) {
		const status = error.status || 502;
		return json(
			{ error: error.status ? error.message : 'Unable to download bill text' },
			{
				status,
				headers: status === 503 ? { 'Retry-After': '5' } : {}
			}
		);
	}
}
