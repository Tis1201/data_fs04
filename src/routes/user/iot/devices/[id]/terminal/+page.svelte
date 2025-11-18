<script lang="ts">
	import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal,
	} from "@battlefieldduck/xterm-svelte";
	import { page } from "$app/stores";
    
	import { deviceStore } from "$lib/stores/device-store";
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";
	import { ArrowLeft, Terminal as TerminalIcon } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { sseStore } from "$lib/stores/sse-store";
	import TerminalContainer from "$lib/components/ui_components_sveltekit/terminal/TerminalContainer.svelte";
	import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    
	/****************************************************************************
	 * 
	 * Variables 
	 * 
	 ****************************************************************************/
	// Get device ID from URL
	const deviceId = $page.params.id;

	// State variables
	let terminalInstance: Terminal | undefined;
	let connecting = false;
	let connected = false;
	
	// Track resources for cleanup
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
	let fitAddon: any;
	let unsubscribeTerminalOutput: (() => void) | undefined;
	let unsubscribeDevice: (() => void) | undefined;

	
	// Define breadcrumbs for this page
	const pageCrumbs: [string, string][] = [
		["Home", "/user"],
		["IoT", "/user/iot"],
		["Devices", "/user/iot/devices"],
		["Device", `/user/iot/devices/${deviceId}`],
		["Terminal", ""]
	];
	
	// Page title
	const title = "Device Terminal";

	// Terminal options
	let options: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontFamily: "'Menlo', 'Consolas', 'Monaco', monospace",
		fontSize: 14,
		lineHeight: 1.2,  // Slightly increased for better readability
		letterSpacing: 0,
		theme: {
			background: "#1e1e1e",
			foreground: "#f0f0f0",
			cursor: "#ffffff",
			cursorAccent: "#000000",
			// @ts-ignore - selection is a valid xterm.js theme property
			selection: "rgba(255, 255, 255, 0.3)",
			black: "#000000",
			red: "#cd3131",
			green: "#0dbc79",
			yellow: "#e5e510",
			blue: "#2472c8",
			magenta: "#bc3fbc",
			cyan: "#11a8cd",
			white: "#e5e5e5",
			brightBlack: "#666666",
			brightRed: "#f14c4c",
			brightGreen: "#23d18b",
			brightYellow: "#f5f543",
			brightBlue: "#3b8eea",
			brightMagenta: "#d670d6",
			brightCyan: "#29b8db",
			brightWhite: "#e5e5e5"
		},
		cursorBlink: true,
		cursorStyle: "block",
		rendererType: "canvas",
		allowTransparency: false,
		convertEol: true, // Convert '\n' to '\r\n'
		disableStdin: false, // Enable user input
		scrollback: 10000, // Increase scrollback buffer
		tabStopWidth: 8, // Standard tab width
		altClickMovesCursor: true, // Allow clicking to move cursor
		macOptionClickForcesSelection: true, // Better selection on Mac
		macOptionIsMeta: true // Make Option key work as Meta
	};

	/****************************************************************************
	 * 
	 * Init Device Connection (SSE-based)
	 * 
	 ****************************************************************************/
	function initDevice(terminal: Terminal) {
		terminal.write(`\r\nConnecting to device terminal...\r\n`);

		// Ensure SSE connection is established
		if (!$sseStore.isConnected) {
			console.log('[Terminal] SSE not connected, connecting...');
			sseStore.connect();
		}

		// Send terminal connect message
		sendTerminalConnect();

		// Send terminal dimensions when ready
		if (terminalInstance && fitAddon) {
			try {
				const dimensions = fitAddon.proposeDimensions();
				if (dimensions) {
					sendTerminalResize(dimensions.rows, dimensions.cols);
				}
			} catch (error) {
				console.error("Error sending terminal dimensions:", error);
			}
		}

		// Send a carriage return to bring the terminal prompt into view
		setTimeout(() => {
			sendTerminalInput('\r');
		}, 500);

		connecting = false;
		connected = true;
		terminal.write("\r\n\x1b[1;32mTerminal Ready\x1b[0m\r\n");
	}

	/****************************************************************************
	 * 
	 * Send Terminal Messages via SSE
	 * 
	 ****************************************************************************/
	function sendTerminalConnect() {
		sseStore.sendRequest({
			type: 'terminal',
			scope: 'user:self',
			payload: {
				type: 'terminal:connect',
				deviceId: deviceId
			}
		}).catch(error => {
			console.error('[Terminal] Failed to send connect message:', error);
			if (terminalInstance) {
				terminalInstance.write("\r\n\x1b[1;31mError: Failed to connect to terminal\x1b[0m\r\n");
			}
		});
	}

	function sendTerminalInput(input: string) {
		// Process input - handle line endings consistently
		let processedInput = input;
		if (processedInput === '\r\n' || processedInput === '\n') {
			processedInput = '\r';
		}

		sseStore.sendRequest({
			type: 'terminal',
			scope: 'user:self',
			payload: {
				type: 'terminal:input',
				deviceId: deviceId,
				input: processedInput
			}
		}).catch(error => {
			console.error('[Terminal] Failed to send input:', error);
		});
	}

	function sendTerminalResize(rows: number, cols: number) {
		sseStore.sendRequest({
			type: 'terminal',
			scope: 'user:self',
			payload: {
				type: 'terminal:resize',
				deviceId: deviceId,
				rows: rows,
				cols: cols
			}
		}).catch(error => {
			console.error('[Terminal] Failed to send resize:', error);
		});
	}

	/****************************************************************************
	 * 
	 * Handle Terminal Output from SSE
	 * 
	 ****************************************************************************/
	function handleTerminalOutput(message: any) {
		if (!terminalInstance || !message) {
			return;
		}

		// Extract data from message - handle both direct payload and nested payload structures
		const rawData = message.data || message.payload || message;
		const data = rawData.payload || rawData; // Support nested payload structure
		const deviceIdFromMessage = data.deviceId || rawData.deviceId || data.device_id || rawData.device_id;
		
		// Only process messages for this specific device
		if (deviceIdFromMessage && deviceIdFromMessage !== deviceId) {
			return;
		}

		// Handle terminal output
		if (data.type === 'terminal:output' || rawData.type === 'terminal:output' || message.event === 'terminal:output') {
			// Check multiple possible locations for output
			const output = data.output || rawData.output || data.data || rawData.data || '';
			if (output) {
				console.log('[Terminal] Writing output to terminal:', output.substring(0, 100));
				terminalInstance.write(output);
			} else {
				console.warn('[Terminal] Received terminal:output message but no output found:', { data, rawData, message });
			}
		} else if (data.type === 'terminal:error' || rawData.type === 'terminal:error' || message.event === 'terminal:error') {
			const error = data.error || rawData.error || data.message || rawData.message || 'Unknown error';
			terminalInstance.write(`\r\n\x1b[1;31mError: ${error}\x1b[0m\r\n`);
		}
	}
	
	
	/****************************************************************************
	 * 
	 * Lifecycle - OnMount 
	 * 
	 ****************************************************************************/
	onMount(() => {
		// Only run browser-specific code in the browser environment
		if (!browser) return;
		
		console.log('[Terminal] onMount - Initializing SSE-based terminal');
		
		// Ensure SSE connection is established
		if (!$sseStore.isConnected) {
			console.log('[Terminal] Connecting to SSE...');
			sseStore.connect();
		}

		// Subscribe to device updates so we can receive terminal output
		// This is required for terminal output messages to reach the UI
		let lastSubscribedConnectionId: string | null = null;
		const subscribeToDevice = () => {
			const connId = sseStore.connectionId;
			if (!connId || connId === lastSubscribedConnectionId) {
				return;
			}
			console.log('[Terminal] Subscribing to device channel for terminal output:', { deviceId, connId });
			fetch(`/api/sse/subscribe/device/${deviceId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ connectionId: connId })
			}).then(() => {
				lastSubscribedConnectionId = connId;
				console.log('[Terminal] Successfully subscribed to device channel');
			}).catch((err) => {
				console.warn('[Terminal] Failed to subscribe to device channel:', err);
			});
		};

		// Subscribe immediately if connectionId is available
		if (sseStore.connectionId) {
			subscribeToDevice();
		}

		// Also subscribe when connection is established
		sseStore.on('connected', (msg: any) => {
			const connId = msg?.data?.connectionId || sseStore.connectionId;
			if (connId && connId !== lastSubscribedConnectionId) {
				subscribeToDevice();
			}
		});

		// Subscribe to terminal output events via SSE
		unsubscribeTerminalOutput = sseStore.on('terminal:output', (message) => {
			console.log('[Terminal] Received terminal:output via SSE:', message);
			handleTerminalOutput(message);
		});

		// Also listen for device:statusUpdate to handle device offline
		unsubscribeDevice = deviceStore.subscribe(state => {
			if (terminalInstance && state.deviceId === deviceId) {
				if (state.status === 'offline') {
					terminalInstance.write(
						"\r\n\x1b[1;31mDevice disconnected. Terminal session ended.\x1b[0m\r\n"
					);
					connected = false;
				}
			}
		});
		
		// Set up window resize handler with debounce
		window.addEventListener("resize", handleResize);
	});

	/****************************************************************************
	 * 
	 * Lifecycle - OnDestroy 
	 * 
	 ****************************************************************************/
	// Clean up subscriptions on component destroy
	onDestroy(() => {
		// Skip cleanup in SSR
		if (!browser) return;
		
		// Send disconnect message
		if (connected) {
			sseStore.sendRequest({
				type: 'terminal',
				scope: 'user:self',
				payload: {
					type: 'terminal:disconnect',
					deviceId: deviceId
				}
			}).catch(error => {
				console.error('[Terminal] Failed to send disconnect message:', error);
			});
		}
		
		// Unsubscribe from stores
		if (unsubscribeTerminalOutput) {
			unsubscribeTerminalOutput();
		}
		
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		
		// Clean up timers
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
			resizeTimeout = null;
		}
		
		// Remove event listeners
		if (typeof window !== 'undefined') {
			window.removeEventListener("resize", handleResize);
		}
		
		// Clean up terminal
		if (terminalInstance) {
			terminalInstance.write("\r\n\x1b[1;33mClosing connection...\x1b[0m\r\n");
		}
		
		console.log('[Terminal] Component destroyed, resources cleaned up');
	});
	
	// Handle window resize events
	function handleResize() {
		// Skip if not in browser
		if (!browser) return;
		
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
		}
		resizeTimeout = setTimeout(() => {
			if (fitAddon && terminalInstance && connected) {
				try {
					fitAddon.fit();
					// Send terminal resize event via SSE
					const dimensions = fitAddon.proposeDimensions();
					if (dimensions) {
						sendTerminalResize(dimensions.rows, dimensions.cols);
						console.log(`[Terminal] Resized to ${dimensions.rows} rows x ${dimensions.cols} columns`);
					}
				} catch (error) {
					console.error("[Terminal] Error fitting terminal on resize:", error);
				}
			}
		}, 100); // Debounce resize events
	}

	/****************************************************************************
	 * 
	 * Terminal Component onLoad 
	 * 
	 ****************************************************************************/
	async function onLoad(event: CustomEvent<{ terminal: Terminal }>) {
		// Skip if not in browser
		if (!browser) return;
		
		const terminal = event.detail.terminal;
		terminalInstance = terminal;

		// Load addons for better terminal experience
		fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		const webLinksAddon = new (await XtermAddon.WebLinksAddon()).WebLinksAddon(
			(event, uri) => {
				if (typeof window !== 'undefined') {
					window.open(uri, '_blank');
				}
			}
		);
		const searchAddon = new (await XtermAddon.SearchAddon()).SearchAddon();
		
		// Load all addons
		terminal.loadAddon(fitAddon);
		terminal.loadAddon(webLinksAddon);
		terminal.loadAddon(searchAddon);
		
		// Fit terminal to container
		fitAddon.fit();

		// Welcome message
		terminal.write("\x1b[1;34m=== Device Terminal ===\x1b[0m\r\n");
		terminal.write(`Device ID: ${deviceId}\r\n`);

		// Initialize device connection
		initDevice(terminal);
	}

	/****************************************************************************
	 * 
	 * Handle User Input 
	 * 
	 ****************************************************************************/
	function onData(event: CustomEvent<string>) {
		const data = event.detail;
		
		// Send input to device via SSE
		if (terminalInstance && connected) {
			sendTerminalInput(data);
		}
	}

	/****************************************************************************
	 * 
	 * Handle onKey 
	 * 
	 ****************************************************************************/	
	function onKey(
		event: CustomEvent<{ key: string; domEvent: KeyboardEvent }>,
	) {
		const data = event.detail;
		
		// Special key handling
		if (data.domEvent.ctrlKey && data.domEvent.key === 'c') {
			// Handle Ctrl+C - send SIGINT
			if (connected) {
				sendTerminalInput('\x03'); // ASCII code for Ctrl+C
			}
		}
	}
</script>

<AdminPageLayout 
	title={title} 
	crumbs={pageCrumbs}
	actionLabel="Back to Device"
	actionIcon={ArrowLeft}
	actionHref={"/user/iot/devices/" + deviceId}
>
	<AdminCard
		title="Terminal Connection"
		description="Interact with the device through this terminal interface. Commands sent here will be executed on the device."
		icon={TerminalIcon}
	>
			<TerminalContainer>
				<Xterm
					options={options}
					on:load={onLoad}
					on:data={onData}
					on:key={onKey}
				/>
			</TerminalContainer>
	</AdminCard>

</AdminPageLayout>
