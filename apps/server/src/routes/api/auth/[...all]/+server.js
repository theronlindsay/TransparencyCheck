import { getAuth } from '$lib/auth.js';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

let handlerPromise;

async function getHandler() {
	if (!handlerPromise) {
		handlerPromise = getAuth().then((auth) => toSvelteKitHandler(auth));
	}

	return handlerPromise;
}

export const GET = async (event) => (await getHandler())(event);
export const POST = async (event) => (await getHandler())(event);
export const PUT = async (event) => (await getHandler())(event);
export const PATCH = async (event) => (await getHandler())(event);
export const DELETE = async (event) => (await getHandler())(event);
