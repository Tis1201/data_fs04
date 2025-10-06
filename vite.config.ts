import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: true,
		port: 5173,
		allowedHosts: ['bt_macbook.datarealities.com', 'host.docker.internal', 'localhost']
	},
	plugins: [
		sveltekit(),
		{
			name: 'integratedWebsocketServer',
			configureServer(server) {
				// Dynamically import the WebSocket utilities to avoid ESM issues
				import('./src/lib/server/websocket/WebSocketUtils.js').then(({ createWSSGlobalInstance, onHttpServerUpgrade }) => {
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
