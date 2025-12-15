/**
 * API Configuration
 * 
 * When running in Static Client (Capacitor), API calls go to the VPS server.
 * When running in browser on the VPS, API calls use relative paths.
 */

// Set this to your DigitalOcean VPS URL
const VPS_API_URL = 'https://transparencycheck.theronlindsay.dev';
/**
 * Get the base URL for API calls
 * Returns empty string for browser (relative paths), or VPS URL for Static Client
 */
export function getApiBaseUrl() {
	return VPS_API_URL;
}

/**
 * Build a full API URL
 * @param {string} path - API path starting with /
 * @returns {string} Full URL for the API endpoint
 */
export function apiUrl(path) {
	return `${getApiBaseUrl()}${path}`;
}
