import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		rollupOptions: {
			maxParallelFileOps: 4
		}
	},
	server: {
		host: true,
		port: 5173,
		allowedHosts: ['bt_macbook.datarealities.com', 'host.docker.internal', 'localhost']
	},
	resolve: {
		alias: {
			'@xterm/xterm': resolve(__dirname, 'node_modules/@xterm/xterm')
		}
	},
	define: {
		global: 'globalThis'
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
	},
	optimizeDeps: {
		include: [
			'mqtt',
			'@xterm/xterm',
			'@battlefieldduck/xterm-svelte',
			'@xterm/addon-fit',
			'@xterm/addon-web-links',
			'@xterm/addon-search',
			'@xterm/addon-attach',
			'@xterm/addon-canvas',
			'@xterm/addon-clipboard',
			'@xterm/addon-image',
			'@xterm/addon-ligatures',
			'@xterm/addon-serialize',
			'@xterm/addon-unicode11',
			'@xterm/addon-webgl'
		]
	}
});
