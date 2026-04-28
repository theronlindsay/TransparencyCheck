import { createRouteHandler, createUploadthing, UTApi } from 'uploadthing/server';
import { env } from '$env/dynamic/private';

const f = createUploadthing();

/** @type {import('uploadthing/server').FileRouter} */
export const ourFileRouter = {
	bugAttachment: f({
		blob: {
			maxFileSize: '1MB',
			maxFileCount: 1
		}
	}).onUploadComplete(async ({ file }) => {
		return {
			fileKey: file.key,
			url: file.ufsUrl,
			name: file.name,
			size: file.size,
			type: file.type
		};
	})
};

export const uploadThingHandlers = createRouteHandler({
	router: ourFileRouter,
	config: {
		token: env.UPLOADTHING_TOKEN
	}
});

export const utapi = new UTApi({
	token: env.UPLOADTHING_TOKEN
});
