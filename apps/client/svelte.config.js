import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapterStatic({
			fallback: 'index.html',
			strict: false
		}),
		// Required for PostHog session replay to work correctly with SSR
		paths: {
			relative: false
		}
	}
};

export default config;
