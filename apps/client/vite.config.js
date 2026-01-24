import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				runtimeCaching: [
					{
						urlPattern: /\/__data\.json/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'sveltekit-data',
							networkTimeoutSeconds: 1,
							plugins: [
								{
									handlerDidError: async () => {
										return new Response(
											JSON.stringify({ type: 'data', nodes: [null, null] }),
											{ headers: { 'Content-Type': 'application/json' } }
										);
									}
								}
							]
						}
					}
				]
			},
			manifest: {
				name: 'Transparency Check',
				short_name: 'Transparency',
				description: 'Track Congressional legislation with AI summaries',
				theme_color: '#ffffff',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			}
		})
	]
});
