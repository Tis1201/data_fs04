<script lang="ts">
	import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal,
	} from "@battlefieldduck/xterm-svelte";
	import { page } from "$app/stores";
    
	import { deviceStore } from "$lib/stores/device-store";
	import { toast } from "$lib/stores/alertToast";
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";
	import { ArrowLeft, Terminal as TerminalIcon } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { TerminalMqttClient } from "$lib/client/mqtt/terminalFlow";
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
	let terminalClient: TerminalMqttClient | null = null;
	let unsubscribeDevice: (() => void) | undefined;
	let terminalElement: HTMLElement | undefined;
	let terminalViewport: HTMLElement | null = null;

	/**
	 * Forces the terminal to scroll all the way to the bottom.
	 * xterm.js scrollToBottom() can be off by sub-pixels on Windows 125% DPI
	 * scaling (xterm.js #4959). We force the raw DOM scrollTop and use rAF to
	 * run after layout, so the last line and cursor stay fully visible.
	 */
	function forceScrollToBottom() {
		if (terminalInstance?.scrollToBottom) {
			terminalInstance.scrollToBottom();
		}
		if (terminalViewport) {
			// Immediate scroll
			terminalViewport.scrollTop = terminalViewport.scrollHeight;
			// Deferred scroll for Windows 125% DPI - DOM may not have reflowed yet
			requestAnimationFrame(() => {
				if (terminalViewport) {
					terminalViewport.scrollTop = terminalViewport.scrollHeight;
				}
			});
		}
	}

	
	// Define breadcrumbs for this page
	const pageCrumbs: [string, string][] = [
		["Home", "/user"],
        ["IOT", ""],
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
	 * Init Device Connection (MQTT-based)
	 * 
	 ****************************************************************************/
	async function initDevice(terminal: Terminal) {
		terminal.write(`\r\nConnecting to device terminal via MQTT...\r\n`);

		try {
			// Create MQTT terminal client
			terminalClient = new TerminalMqttClient(deviceId);

			// Set up output handler - success = when we actually see terminal output
			let hasReceivedOutput = false;
			terminalClient.onOutput((output) => {
				if (terminalInstance) {
					terminalInstance.write(output);
					// Defer scroll - write() renders async; need layout before scroll (Windows 125%)
					requestAnimationFrame(() => {
						requestAnimationFrame(() => forceScrollToBottom());
					});
				}
				if (!hasReceivedOutput) {
					hasReceivedOutput = true;
					connected = true;
					toast.success('Terminal connected – output received');
				}
			});

			// Set up error handler
			terminalClient.onError((error) => {
				console.error('[Terminal] Error:', error);
				if (terminalInstance) {
					terminalInstance.write(`\r\n\x1b[1;31mError: ${error}\x1b[0m\r\n`);
				}
			});

			// Set up connected handler - session established
			terminalClient.onConnected(() => {
				console.log('[Terminal] Terminal connected');
				connected = true;
				// Only show "Terminal Ready" if we haven't received output yet (output is the real indicator)
				if (!hasReceivedOutput && terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;32mTerminal Ready\x1b[0m\r\n");
				}
			});

			// Set up disconnected handler
			terminalClient.onDisconnected(() => {
				console.log('[Terminal] Terminal disconnected');
				if (terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;31mTerminal disconnected\x1b[0m\r\n");
				}
				connected = false;
			});

			// Connect with terminal dimensions
			const dimensions = fitAddon?.proposeDimensions();
			await terminalClient.connect(
				dimensions?.rows || 24,
				dimensions?.cols || 80
			);

			// Send a carriage return to bring the terminal prompt into view
			setTimeout(() => {
				if (terminalClient) {
					terminalClient.sendInput('\r');
				}
			}, 500);

			connecting = false;
		} catch (error) {
			console.error('[Terminal] Connection failed:', error);
			terminal.write(`\r\n\x1b[1;31mConnection failed: ${error}\x1b[0m\r\n`);
			connecting = false;
			connected = false;
		}
	}

	/****************************************************************************
	 * 
	 * Send Terminal Messages via MQTT
	 * 
	 ****************************************************************************/
	function sendTerminalInput(input: string) {
		if (!terminalClient) {
			console.error('[Terminal] Terminal client not initialized');
			return;
		}

		// Process input - handle line endings consistently
		let processedInput = input;
		if (processedInput === '\r\n' || processedInput === '\n') {
			processedInput = '\r';
		}

		terminalClient.sendInput(processedInput);
	}

	function sendTerminalResize(rows: number, cols: number) {
		if (!terminalClient) {
			console.error('[Terminal] Terminal client not initialized');
			return;
		}

		terminalClient.resize(rows, cols);
	}

	
	
	/****************************************************************************
	 * 
	 * Lifecycle - OnMount 
	 * 
	 ****************************************************************************/
	onMount(() => {
		// Only run browser-specific code in the browser environment
		if (!browser) return;
		
		console.log('[Terminal] onMount - Initializing MQTT-based terminal');

		// Listen for device status updates to handle device offline
		unsubscribeDevice = deviceStore.subscribe(state => {
			if (terminalInstance && state.deviceId === deviceId) {
				if (state.status === 'offline') {
					terminalInstance.write(
						"\r\n\x1b[1;31mDevice disconnected. Terminal session ended.\x1b[0m\r\n"
					);
					connected = false;
					
					// Disconnect terminal client if device goes offline
					if (terminalClient) {
						terminalClient.disconnect();
					}
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
		
		// Disconnect MQTT terminal client
		if (terminalClient) {
			console.log('[Terminal] Disconnecting terminal client');
			terminalClient.disconnect();
			terminalClient = null;
		}
		
		// Unsubscribe from device store
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

		// Remove focus listener
		if (terminalElement) {
			terminalElement.removeEventListener('focusin', forceScrollToBottom);
			terminalElement = undefined;
		}
		terminalViewport = null;

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

		// Cache the viewport element for direct DOM scroll correction (Windows 125% DPI fix)
		terminalElement = terminal.element;
		terminalViewport = terminalElement?.querySelector('.xterm-viewport') as HTMLElement | null;
		if (terminalElement) {
			terminalElement.addEventListener('focusin', forceScrollToBottom);
		}

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

		// Keep input line visible on Windows/scaled displays (xterm.js #4959)
		forceScrollToBottom();

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
