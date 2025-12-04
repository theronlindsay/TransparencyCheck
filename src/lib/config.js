/**
 * API Configuration
 * 
 * When running in Tauri (static build), API calls go to the VPS server.
 * When running in browser on the VPS, API calls use relative paths.
 */

// Set this to your DigitalOcean VPS URL
const VPS_API_URL = 'https://transparencycheck.theronlindsay.dev';

/**
 * Check if we're running in a Tauri environment
 */
export function isTauri() {
	return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

/**
 * Get the base URL for API calls
 * Returns empty string for browser (relative paths), or VPS URL for Tauri
 */
export function getApiBaseUrl() {
	if (isTauri()) {
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
