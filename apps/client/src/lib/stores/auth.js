import { writable, derived, get } from 'svelte/store';
import { authClient } from '$lib/auth/client.js';

const sessionStore = writable(null);
const authErrorStore = writable('');
const authReadyStore = writable(false);

function mapSessionPayload(payload) {
	if (!payload) {
		return null;
	}

	if (payload.data?.session || payload.data?.user) {
		return {
			session: payload.data.session,
			user: payload.data.user
		};
	}

	if (payload.session || payload.user) {
		return {
			session: payload.session,
			user: payload.user
		};
	}

	return null;
}

export async function refreshSession() {
	authErrorStore.set('');

	try {
		const result = await authClient.getSession();
		sessionStore.set(mapSessionPayload(result));
	} catch (error) {
		authErrorStore.set(error?.message || 'Unable to load session.');
		sessionStore.set(null);
	} finally {
		authReadyStore.set(true);
	}
}

export async function signInEmail(email, password) {
	authErrorStore.set('');

	try {
		const result = await authClient.signIn.email({
			email,
			password
		});
		sessionStore.set(mapSessionPayload(result));
		return { ok: true };
	} catch (error) {
		authErrorStore.set(error?.message || 'Sign in failed.');
		return { ok: false, message: error?.message || 'Sign in failed.' };
	}
}

export async function signUpEmail(name, email, password) {
	authErrorStore.set('');

	try {
		const result = await authClient.signUp.email({
			name,
			email,
			password
		});
		sessionStore.set(mapSessionPayload(result));
		return { ok: true };
	} catch (error) {
		authErrorStore.set(error?.message || 'Create account failed.');
		return { ok: false, message: error?.message || 'Create account failed.' };
	}
}

export async function signOutUser() {
	authErrorStore.set('');

	try {
		await authClient.signOut();
		sessionStore.set(null);
		return { ok: true };
	} catch (error) {
		authErrorStore.set(error?.message || 'Logout failed.');
		return { ok: false, message: error?.message || 'Logout failed.' };
	}
}

export const authSession = {
	subscribe: sessionStore.subscribe
};

export const authError = {
	subscribe: authErrorStore.subscribe
};

export const authReady = {
	subscribe: authReadyStore.subscribe
};

export const isAuthenticated = derived(sessionStore, (session) => Boolean(session?.user));
export const currentUser = derived(sessionStore, (session) => session?.user || null);

if (typeof window !== 'undefined') {
	refreshSession();

	window.addEventListener('focus', () => {
		const isReady = get(authReadyStore);
		if (isReady) {
			refreshSession();
		}
	});
}
