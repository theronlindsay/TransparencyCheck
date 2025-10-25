import { json } from '@sveltejs/kit';

export async function GET({ url }) {
	const billUrl = url.searchParams.get('url');
	
	if (!billUrl) {
		return json({ error: 'URL parameter is required' }, { status: 400 });
	}

	try {
		const response = await fetch(billUrl);
		
		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.status}`);
		}
		
		const text = await response.text();
		
		return json({ content: text });
	} catch (error) {
		console.error('Error fetching bill text:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
