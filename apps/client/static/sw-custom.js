// Custom service worker additions for SvelteKit __data.json handling

// Intercept __data.json requests and return empty data
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	
	// Handle __data.json requests that SvelteKit makes
	if (url.pathname === '/__data.json' || url.pathname.endsWith('/__data.json')) {
		event.respondWith(
			new Response(
				JSON.stringify({ type: 'data', nodes: [null, null] }),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);
		return;
	}
});
