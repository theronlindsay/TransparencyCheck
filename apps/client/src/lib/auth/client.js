import { createAuthClient } from 'better-auth/client';
import { getApiBaseUrl, PRODUCTION_API_ORIGIN } from '$lib/config.js';

// In dev, Vite proxies /api → local server. In prod, talk to api.transparencycheck.app.
const baseURL = getApiBaseUrl() || (import.meta.env.DEV ? '' : PRODUCTION_API_ORIGIN);

export const authClient = createAuthClient({
	baseURL: baseURL || undefined
});
