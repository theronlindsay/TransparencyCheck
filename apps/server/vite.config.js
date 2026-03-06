import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3000
	},
	ssr: {
		noExternal: ['@prisma/adapter-better-sqlite3', '@prisma/driver-adapter-utils'],
		external: ['better-sqlite3']
	}
});
