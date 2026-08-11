/** Silence browser / scanner favicon requests. */
export function GET() {
	return new Response(null, { status: 204 });
}
