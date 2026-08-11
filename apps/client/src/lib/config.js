/**
 * API Configuration
 *
 * Production: client is transparencycheck.app, API is api.transparencycheck.app.
 * Local dev: empty base URL so Vite proxies /api → localhost:1776.
 */

export const PRODUCTION_APP_ORIGIN = 'https://transparencycheck.app';
export const PRODUCTION_API_ORIGIN = 'https://api.transparencycheck.app';

const envBase = import.meta.env.VITE_API_BASE_URL;
const isDev = import.meta.env.DEV;

const API_BASE_URL = isDev
	? ''
	: typeof envBase === 'string' && envBase.length > 0
		? envBase.replace(/\/$/, '')
		: PRODUCTION_API_ORIGIN;

console.log('🌐 API Configuration Loaded');
console.log('   Mode:', isDev ? 'Development' : 'Production');
console.log('   VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('   API_BASE_URL:', API_BASE_URL || '(relative / Vite proxy)');

/**
 * Origin for API calls (no trailing slash). Empty in local dev (Vite proxy).
 */
export function getApiBaseUrl() {
	return API_BASE_URL;
}

/**
 * Build a full API URL.
 * @param {string} path - API path starting with /
 * @returns {string}
 */
export function apiUrl(path) {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	const fullUrl = `${getApiBaseUrl()}${normalized}`;
	console.log(`🔗 API Request: ${fullUrl}`);
	return fullUrl;
}
