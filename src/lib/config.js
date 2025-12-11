/**
 * API Configuration
 * 
 * When running in Static Client (Capacitor), API calls go to the VPS server.
 * When running in browser on the VPS, API calls use relative paths.
 */

// Set this to your DigitalOcean VPS URL
const VPS_API_URL = 'https://transparencycheck.theronlindsay.dev';

/**
 * Check if we're running in a Static Client environment (Capacitor/Mobile)
 */
export function isStaticClient() {
	// If in development mode, always use local server (relative paths)
	// even if running in Capacitor (live reload)
	if (import.meta.env.DEV) {
		return false;
	}

	// Check for static build flag (Vite)
	if (import.meta.env.VITE_STATIC_BUILD === 'true') {
		return true;
	}

	if (typeof window === 'undefined') return false;

	// Check for Capacitor
	if (window.Capacitor !== undefined) {
		return true;
	}

	return false;
}

/**
 * Get the base URL for API calls
 * Returns empty string for browser (relative paths), or VPS URL for Static Client
 */
export function getApiBaseUrl() {
	if (isStaticClient()) {
		return VPS_API_URL;
	}
	return '';
}

/**
 * Build a full API URL
 * @param {string} path - API path starting with /
 * @returns {string} Full URL for the API endpoint
 */
export function apiUrl(path) {
	return `${getApiBaseUrl()}${path}`;
}
