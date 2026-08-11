/** Simple root handler so Dokploy/Traefik health probes don't 404. */
export function GET() {
	return new Response('OK', {
		status: 200,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
}
