/**
 * Minimal static file server for the SvelteKit client build.
 * API proxying is handled by Dokploy/Traefik — this only serves frontend assets.
 */
import { join, normalize, extname } from 'path';

const root = join(import.meta.dir, 'build');
const port = Number(process.env.PORT || 8080);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8',
	'.map': 'application/json'
};

function safePath(pathname) {
	const decoded = decodeURIComponent(pathname);
	const relative = decoded === '/' ? '/index.html' : decoded;
	const full = normalize(join(root, relative));
	if (!full.startsWith(root)) {
		return join(root, 'index.html');
	}
	return full;
}

function cacheHeaders(pathname) {
	if (pathname.startsWith('/_app/')) {
		return { 'Cache-Control': 'public, max-age=31536000, immutable' };
	}
	if (pathname === '/sw.js' || pathname === '/sw-custom.js') {
		return { 'Cache-Control': 'no-cache, no-store, must-revalidate' };
	}
	if (pathname === '/manifest.webmanifest') {
		return { 'Cache-Control': 'no-cache' };
	}
	return {};
}

Bun.serve({
	port,
	async fetch(req) {
		const { pathname } = new URL(req.url);
		const filePath = safePath(pathname);
		const file = Bun.file(filePath);

		if (await file.exists()) {
			const type = MIME[extname(filePath)] || file.type || 'application/octet-stream';
			return new Response(file, {
				headers: {
					'Content-Type': type,
					...cacheHeaders(pathname)
				}
			});
		}

		// SPA fallback for client-side routes
		const index = Bun.file(join(root, 'index.html'));
		return new Response(index, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache'
			}
		});
	}
});

console.log(`Client static server listening on :${port}`);
