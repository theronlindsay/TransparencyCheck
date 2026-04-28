import { uploadThingHandlers } from '$lib/server/uploadthing.js';

export async function GET({ request }) {
	return await uploadThingHandlers(request);
}

export async function POST({ request }) {
	return await uploadThingHandlers(request);
}
