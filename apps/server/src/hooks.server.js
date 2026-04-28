import {
	hasValidAdminSession,
	isAdminPasswordConfigured,
	isAllowedAdminHost
} from '$lib/server/admin-auth.js';
import { installServerLogging } from '$lib/server/logging.js';
import { redirect } from '@sveltejs/kit';

const DEFAULT_ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://localhost',
	'capacitor://localhost',
	'http://localhost'
];

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);

const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredCorsOrigins]);

installServerLogging();

function buildCorsHeaders(event) {
	const origin = event.request.headers.get('origin');
	if (!origin || !ALLOWED_ORIGINS.has(origin)) {
		return null;
	}

	const requestHeaders = event.request.headers.get('access-control-request-headers');

	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
		'Access-Control-Allow-Headers':
			requestHeaders || 'Content-Type, Authorization, X-Requested-With, Accept',
		Vary: 'Origin'
	};
}

// Export a handle function so SvelteKit loads this hooks file
export async function handle({ event, resolve }) {
	const startedAt = Date.now();
	const { pathname, hostname } = event.url;

	const corsHeaders = buildCorsHeaders(event);
	const isAdminHost = isAllowedAdminHost(hostname);
	const isAdminPath = pathname.startsWith('/admin');
	const isAdminLoginPath = pathname === '/admin/login';

	event.locals.isAdminHost = isAdminHost;
	event.locals.isAdminAuthenticated = hasValidAdminSession(event.cookies);

	console.info(`[HTTP] ${event.request.method} ${hostname}${pathname} started`);

	if (isAdminPath && !isAdminHost) {
		console.warn(`[Admin] Rejected admin route on unexpected host ${hostname}`);
		return new Response('Not found', { status: 404 });
	}

	if (isAdminPath && !isAdminPasswordConfigured()) {
		console.error('[Admin] ADMIN_PANEL_PASSWORD is not configured');
		return new Response('Admin panel password is not configured', { status: 500 });
	}

	if (pathname === '/' && isAdminHost && event.request.method === 'GET') {
		throw redirect(303, event.locals.isAdminAuthenticated ? '/admin/cron' : '/admin/login');
	}

	if (isAdminPath && !isAdminLoginPath && !event.locals.isAdminAuthenticated) {
		throw redirect(303, '/admin/login');
	}

	if (isAdminLoginPath && event.locals.isAdminAuthenticated) {
		throw redirect(303, '/admin/cron');
	}

	// Handle preflight for allowed origins.
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders || {}
		});
	}

	const response = await resolve(event);

	if (corsHeaders) {
		for (const [header, value] of Object.entries(corsHeaders)) {
			response.headers.set(header, value);
		}
	}

	console.info(
		`[HTTP] ${event.request.method} ${hostname}${pathname} completed ${response.status} in ${Date.now() - startedAt}ms`
	);

	return response;
}
