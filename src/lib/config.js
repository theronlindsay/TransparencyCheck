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
 * Uses multiple detection methods for reliability
 */
export function isTauri() {
	if (typeof window === 'undefined') return false;
	
	// Check for Tauri API
	if (window.__TAURI__) return true;
	
	// Check for Tauri internals (IPC)
	if (window.__TAURI_IPC__) return true;
	
	// Check for tauri protocol in URL (Android uses this)
	if (window.location.protocol === 'tauri:' || 
	    window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost') {
		return true;
	}
	
	return false;
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
