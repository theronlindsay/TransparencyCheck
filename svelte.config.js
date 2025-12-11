import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter for Capacitor builds, node adapter for server deployment
const isStatic = process.env.STATIC_BUILD === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: isStatic
      ? adapterStatic({ fallback: 'index.html' })
      : adapterNode(),
  },
};


export default config;