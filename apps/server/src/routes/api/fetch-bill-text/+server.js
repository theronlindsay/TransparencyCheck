import { json } from '@sveltejs/kit';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
	return new Response(null, { headers: corsHeaders });
}

export async function GET({ url }) {
	const billUrl = url.searchParams.get('url');
	
	if (!billUrl) {
		return json({ error: 'URL parameter is required' }, { status: 400, headers: corsHeaders });
	}

	try {
		const response = await fetch(billUrl);
		
		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.status}`);
		}
		
		const text = await response.text();
		
		return json({ content: text }, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching bill text:', error);
		return json({ error: error.message }, { status: 500, headers: corsHeaders });
	}
}
