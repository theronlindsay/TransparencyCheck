/**
 * API Configuration
 * 
 * When running in Static Client (Capacitor), API calls go to the VPS server.
 * When running in browser on the VPS, API calls use relative paths.
 */

// Set this via environment (e.g. VITE_API_BASE_URL=http://server:3000)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://transparencycheck.app';

// Log API configuration on startup for debugging (visible in browser console and Android Logcat)
console.log('🌐 API Configuration Loaded');
console.log('   VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('   API_BASE_URL:', API_BASE_URL);
console.log('   Empty base URL means relative paths (same origin)');

/**
 * Get the base URL for API calls
 * Returns empty string for browser (relative paths), or VPS URL for Static Client
 */
export function getApiBaseUrl() {
	return API_BASE_URL;
}

/**
 * Build a full API URL
 * @param {string} path - API path starting with /
 * @returns {string} Full URL for the API endpoint
 */
export function apiUrl(path) {
	const fullUrl = `${getApiBaseUrl()}${path}`;
	console.log(`🔗 API Request: ${fullUrl}`);
	return fullUrl;
}
