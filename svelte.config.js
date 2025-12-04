import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter for Tauri builds, node adapter for server deployment
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: isTauri
      ? adapterStatic({ fallback: 'index.html' })
      : adapterNode(),
  },
};

export default config;