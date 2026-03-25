import { createAuthClient } from 'better-auth/client';
import { getApiBaseUrl } from '$lib/config.js';

const baseURL = getApiBaseUrl();

export const authClient = createAuthClient({
	baseURL
});
