import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		{
			name: 'integratedWebsocketServer',
			configureServer(server) {
				// Dynamically import the WebSocket utilities to avoid ESM issues
				import('./src/lib/server/webSocketUtils.ts').then(({ createWSSGlobalInstance, onHttpServerUpgrade }) => {
					createWSSGlobalInstance();
					server.httpServer?.on('upgrade', onHttpServerUpgrade);
				});
			},
		}
	],
	ssr: {
		noExternal: ['svelte-sonner']
	}
});
