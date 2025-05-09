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
	import { ArrowLeft, Terminal as TerminalIcon } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
	import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
	import { WebRTCClient } from "./webrtc-client";
	import { webRTCStore } from "$lib/stores/webrtc-store";

	/****************************************************************************
	 * 
	 * Variables 
	 * 
	 ****************************************************************************/
	// Get device ID from URL
	const deviceId = $page.params.id;

	// Track terminal instance
	let terminalInstance: Terminal;
	
	// Initialize WebRTC client
	let webrtcClient = new WebRTCClient(deviceId);

	// Subscribe to the deviceStore for all device-related events
	let unsubscribeDevice: () => void;
	let previousTerminalMessage: any = null;
	let previousWebRTCMessage: any = null;
	
	// Define breadcrumbs for this page
	const pageCrumbs = [
		["Admin", "/admin"],
		["IoT", "/admin/iot"],
		["Devices", "/admin/iot/devices"],
		["Device", `/admin/iot/devices/${deviceId}`],
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
			"\r\n\x1b[1;33mInitializing connection to device...\x1b[0m\r\n",
		);

		// Set terminal callback for WebRTC client
		webrtcClient.setTerminalCallback((message) => {
			if (terminalInstance) {
				// Log the received message for debugging
				console.log(`Terminal received message: ${message.length} bytes`);
				
				// Write the message to the terminal
				terminalInstance.write(message);
				
				// For debugging, log a sample of the message
				if (message.length > 0) {
					const sample = message.length > 20 ? 
						message.substring(0, 20) + '...' : 
						message;
					console.log(`Terminal message sample: ${JSON.stringify(sample)}`);
				}
			}
		});

		// Initialize WebRTC connection
		webrtcClient.connect();

		// Start ping interval
		const pingInterval = setInterval(() => {
			if ($webRTCStore.dataChannelStatus === 'open') {
				webrtcClient.sendPing();
			}
		}, 10000); // Send ping every 10 seconds

		// Clean up ping interval on component destroy
		onDestroy(() => {
			clearInterval(pingInterval);
		});
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
	});

	/****************************************************************************
	 * 
	 * Lifecycle - OnDestroy 
	 * 
	 ****************************************************************************/
	// Clean up subscription and WebRTC connection on component destroy
	onDestroy(() => {
		// Unsubscribe from device store
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		
		// Clean up WebRTC resources
		webrtcClient.cleanup();
	});

	/****************************************************************************
	 * 
	 * Terminal Component onLoad 
	 * 
	 ****************************************************************************/
	async function onLoad(event: CustomEvent<{ terminal: Terminal }>) {
		console.log("Terminal component loaded");
		const terminal = event.detail.terminal;
		terminalInstance = terminal;

		// Load addons for better terminal experience
		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		const webLinksAddon = new (await XtermAddon.WebLinksAddon()).WebLinksAddon(
			(event, uri) => {
				window.open(uri, '_blank');
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

		// Set up window resize handler with debounce
		let resizeTimeout: ReturnType<typeof setTimeout>;
		window.addEventListener("resize", () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
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
			}, 100); // Debounce resize events
		});

		// Send initial terminal dimensions when WebRTC connects
		const unsubscribeWebRTC = webRTCStore.subscribe(state => {
			if (state.dataChannelStatus === 'open') {
				try {
					const dimensions = fitAddon.proposeDimensions();
					if (dimensions) {
						webrtcClient.sendTerminalResize(dimensions.rows, dimensions.cols);
						terminal.write("\r\n\x1b[1;32mWebRTC connection established!\x1b[0m\r\n");
						console.log(`Initial terminal size: ${dimensions.rows} rows x ${dimensions.cols} columns`);
					}
				} catch (error) {
					console.error("Error sending terminal dimensions:", error);
				}
			}
		});
		
		// Clean up on destroy
		onDestroy(() => {
			unsubscribeWebRTC();
			clearTimeout(resizeTimeout);
		});
	}

	/****************************************************************************
	 * 
	 * Handle User Input 
	 * 
	 ****************************************************************************/
	function onData(event: CustomEvent<string>) {
		const data = event.detail;
		console.log("User input:", data);

		// Send command to device
		if (terminalInstance) {
			// Check if WebRTC data channel is open
			if ($webRTCStore.dataChannelStatus === 'open') {
				// Send via WebRTC
				webrtcClient.sendTerminalInput(data);
				
				// For better UX, we could echo the character locally if needed
				// This is usually not necessary as the terminal will echo back from the server
				// terminalInstance.write(data);
			} else {
				// Fall back to WebSocket
				sendCommand(terminalInstance, data);
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

<PageContainer crumbs={pageCrumbs}>
	<div class="flex justify-between items-center mb-6">
		<div class="flex items-center gap-3">
			<h1 class="text-2xl font-bold tracking-tight">{title}</h1>
		</div>
		
		<!-- Actions -->
		<div class="flex items-center space-x-2">
			<Button variant="outline" href="/admin/iot/devices/{deviceId}">
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Device
			</Button>
		</div>
	</div>

	<PageContent>
		<div class="space-y-6">
			<FormCard
				title="Terminal Connection"
				description="Interact with the device through this terminal interface. Commands sent here will be executed on the device."
			>
				<div class="terminal-container h-[500px] w-full border rounded-md overflow-hidden">
					<Xterm {options} on:load={onLoad} on:data={onData} on:key={onKey} />
				</div>
			</FormCard>
		</div>
	</PageContent>
</PageContainer>

<style>
	.terminal-container {
		background-color: #1e1e1e;
		position: relative;
	}
	:global(.terminal-container .xterm) {
		height: 100%;
		width: 100%;
		padding: 0.75rem;
	}
	:global(.terminal-container .xterm-viewport) {
		overflow-y: auto !important;
	}
	:global(.terminal-container .xterm-screen) {
		padding: 0.25rem;
	}
	:global(.terminal-container canvas) {
		padding: 0;
	}
</style>
