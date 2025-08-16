<script lang="ts">
	import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal,
	} from "@battlefieldduck/xterm-svelte";
	import { page } from "$app/stores";
    
	import { deviceStore } from "$lib/stores/device-store";
	import { socketStore } from "$lib/stores/websocket-store";
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";
	import { ArrowLeft, Terminal as TerminalIcon } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { WebRTCClient } from "./webrtc-client";
	import { webRTCStore } from "$lib/stores/webrtc-store";
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
	let webrtcClient: WebRTCClient | undefined;
	let connecting = false;
	let connected = false;

	// Initialize WebRTC client
	webrtcClient = new WebRTCClient(deviceId);
	
	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval>;
	let resizeTimeout: ReturnType<typeof setTimeout>;
	let unsubscribeWebRTC: () => void;
	let fitAddon: any;

	// Subscribe to the deviceStore for all device-related events
	let unsubscribeDevice: () => void;
	let previousTerminalMessage: any = null;
	let previousWebRTCMessage: any = null;
	
	// Define breadcrumbs for this page
	const pageCrumbs = [
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
	 * Init Device Connection 
	 * 
	 ****************************************************************************/
	function initDevice(terminal: Terminal) {
		terminal.write(
			`\r\nPlease wait...\r\n`,
		);

		// Set terminal callback for WebRTC client to handle terminal output
		webrtcClient.setTerminalCallback((message) => {
			if (terminalInstance) {
				terminalInstance.write(message);
			}
		});
		
		// Set up data channel open callback - this is triggered when the data channel is ready for use
		webrtcClient.setDataChannelOpenCallback((dataChannel) => {

			
			// Update WebRTC store to reflect the open data channel
			webRTCStore.update(state => ({
				...state,
				dataChannelStatus: 'open'
			}));
			
			// Send terminal dimensions when data channel is open
			if (terminalInstance && fitAddon) {
				try {
					const dimensions = fitAddon.proposeDimensions();
					if (dimensions) {
						webrtcClient.sendTerminalResize(dimensions.rows, dimensions.cols);
					}
				} catch (error) {
					console.error("Error sending terminal dimensions:", error);
				}
			}
			
			// Send a carriage return to bring the terminal prompt into view
			webrtcClient.sendTerminalInput('\r');
		});
		
		// Set up connection state callback - this is triggered when the WebRTC connection state changes
		webrtcClient.setConnectionStateCallback((state) => {

			
			// Update WebRTC store with the new connection state
			webRTCStore.update(currentState => ({
				...currentState,
				connectionState: state
			}));
			
			// Update terminal with connection state changes
			if (terminalInstance) {
				if (state === 'connected') {
					terminalInstance.write("\r\n\x1b[1;32mTerminal Ready\x1b[0m\r\n");
					connecting = false;
					connected = true;
				} else if (state === 'disconnected') {
					// Don't change UI immediately for disconnected state
					// as it might reconnect automatically
					console.log('Connection disconnected - may reconnect automatically');
				} else if (state === 'failed' || state === 'closed') {
					connecting = false;
					connected = false;
					
					// Show reconnection message
					terminalInstance.write("\r\n\x1b[1;33mConnection lost. Reconnecting...\x1b[0m");
					
					// Attempt to reconnect after a brief delay
					setTimeout(() => {
						console.log('Attempting to reconnect...');
						connecting = true;
						webrtcClient.connect();
					}, 2000);
				}
			}
		});

		// Initialize WebRTC connection
		webrtcClient.connect();
	}

	/****************************************************************************
	 * 
	 * Handle Terminal Messages 
	 * 
	 ****************************************************************************/
	function handleTerminalMessage(message) {
		if (!terminalInstance || !message) return;
		
		// Only process messages for this specific device
		if (message.deviceId !== deviceId) {
			return;
		}
		
		console.log("Processing terminal message:", message);
		
		// Handle different terminal message types
		switch (message.type) {
			case "terminal-response":
				if (message.output) {
					terminalInstance.write(`${message.output}\r\n`);
				}
				break;
				
			case "terminal-connected":
				terminalInstance.write(
					"\r\n\x1b[1;32mConnected to device terminal!\x1b[0m\r\n"
				);
				break;
				
			case "terminal-error":
				terminalInstance.write(
					`\r\n\x1b[1;31mError: ${message.error || 'Unknown error'}\x1b[0m\r\n`
				);
				break;
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
		
		// Subscribe to device store
		unsubscribeDevice = deviceStore.subscribe(state => {
			// Handle device status changes
			if (terminalInstance && state.deviceId === deviceId) {
				// Show disconnection message if device goes offline
				if (state.status === 'offline') {
					terminalInstance.write(
						"\r\n\x1b[1;31mDevice disconnected. Terminal session ended.\x1b[0m\r\n"
					);
				}
			}
			
			// Process new terminal messages
			if (state.latestTerminalMessage && 
			    state.latestTerminalMessage !== previousTerminalMessage) {
				previousTerminalMessage = state.latestTerminalMessage;
				handleTerminalMessage(state.latestTerminalMessage);
			}
			
			// Process new WebRTC messages
			if (state.latestWebRTCMessage && 
			    state.latestWebRTCMessage !== previousWebRTCMessage) {
				previousWebRTCMessage = state.latestWebRTCMessage;
				webrtcClient.handleWebRTCMessage(state.latestWebRTCMessage);
			}
		});
		
		// Start ping interval
		// pingInterval = setInterval(() => {
		// 	if ($webRTCStore.dataChannelStatus === 'open') {
		// 		webrtcClient.sendPing();
		// 	}
		// }, 10000); // Send ping every 10 seconds
		
		// Set up window resize handler with debounce
		window.addEventListener("resize", handleResize);
		
		// We no longer need to subscribe to WebRTC store for connection status
		// as we're now using callbacks directly in the initDevice function
	});

	/****************************************************************************
	 * 
	 * Lifecycle - OnDestroy 
	 * 
	 ****************************************************************************/
	// Clean up subscription and WebRTC connection on component destroy
	onDestroy(() => {
		// Skip cleanup in SSR
		if (!browser) return;
		
		// Unsubscribe from stores
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		
		// We don't need to unsubscribe from WebRTC store anymore since we're using callbacks
		// but we'll keep the variable check for backward compatibility
		if (unsubscribeWebRTC) {
			unsubscribeWebRTC();
		}
		
		// Clean up timers
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}
		
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
			resizeTimeout = null;
		}
		
		// Remove event listeners
		if (typeof window !== 'undefined') {
			window.removeEventListener("resize", handleResize);
		}
		
		// Clean up WebRTC resources
		if (terminalInstance) {
			terminalInstance.write("\r\n\x1b[1;33mClosing connection...\x1b[0m\r\n");
		}
		
		// Properly clean up WebRTC client
		webrtcClient.cleanup();
		
		// Reset WebRTC store state
		webRTCStore.update(state => ({
			...state,
			connectionState: 'closed',
			dataChannelStatus: 'closed'
		}));
		
		console.log('Terminal component destroyed, WebRTC resources cleaned up');
	});
	
	// Handle window resize events
	function handleResize() {
		// Skip if not in browser
		if (!browser) return;
		
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			if (fitAddon && terminalInstance) {
				try {
					fitAddon.fit();
					// Send terminal resize event when WebRTC is connected
					if ($webRTCStore.dataChannelStatus === 'open') {
						const dimensions = fitAddon.proposeDimensions();
						if (dimensions) {
							webrtcClient.sendTerminalResize(dimensions.rows, dimensions.cols);
							console.log(`Terminal resized to ${dimensions.rows} rows x ${dimensions.cols} columns`);
						}
					}
				} catch (error) {
					console.error("Error fitting terminal on resize:", error);
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
		
		// Handle line endings consistently
		// The terminal component often sends \r when Enter is pressed
		// We need to ensure we don't get double line breaks
		let processedData = data;
		
		// Send command to device
		if (terminalInstance) {
			// Check if WebRTC data channel is open
			if ($webRTCStore.dataChannelStatus === 'open') {
				// Send via WebRTC only; do NOT echo locally
				webrtcClient.sendTerminalInput(processedData);
			} else {
				// Fall back to WebSocket
				sendCommand(terminalInstance, processedData);
			}
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
			if ($webRTCStore.dataChannelStatus === 'open') {
				webrtcClient.sendTerminalInput('\x03'); // ASCII code for Ctrl+C
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

