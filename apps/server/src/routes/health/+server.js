/** Dedicated health endpoint for Dokploy / load balancer probes. */
export function GET() {
	return Response.json(
		{ ok: true, service: 'transparencycheck-server' },
		{
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
}
