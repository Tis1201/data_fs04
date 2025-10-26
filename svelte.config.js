import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Include ZenStack generated files
			precompress: false,
			envPrefix: '',
			polyfill: true
		}),
		alias: {
			$lib: './src/lib'
		},
		// CSRF protection configuration
		// Disabled for production deployment to avoid issues with WebSockets and API calls
		// For production environments, consider implementing CSRF protection at the application level
		// or using a reverse proxy with security headers
		csrf: { checkOrigin: false }
	},
	preprocess: vitePreprocess()
};

export default config;
