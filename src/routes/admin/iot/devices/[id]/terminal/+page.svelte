<script lang="ts">
	import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal,
	} from "@battlefieldduck/xterm-svelte";
	import { page } from "$app/stores";
	import { socketStore } from "$lib/stores/websocket-store";
	import { onDestroy } from "svelte";
	import { ArrowLeft, Terminal as TerminalIcon } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
	import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";

	// Get device ID from URL
	const deviceId = $page.params.id;

	// Track terminal instance
	let terminalInstance: Terminal;
	
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
		lineHeight: 1.0,  // Reduced line height for tighter spacing
		letterSpacing: 0,
		theme: {
			background: "#1e1e1e",
			foreground: "#f0f0f0",
			cursor: "#ffffff",
			cursorAccent: "#000000",
			selection: "rgba(255, 255, 255, 0.3)"
		},
		cursorBlink: true,
		cursorStyle: "block",
		rendererType: "canvas",
		allowTransparency: false
	};

	// Function to initialize device connection
	function initDevice(terminal: Terminal) {
		terminal.write(
			"\r\n\x1b[1;33mInitializing connection to device...\x1b[0m\r\n",
		);

		// Create message to initialize terminal connection

		// Send the message via WebSocket
		try {
			const message = {
				type: "device",
				scope: `subscription:device:${deviceId}`,
				payload: {
					action: "message",
					type: "webrtc:connect",
					deviceId: deviceId,
					timestamp: new Date().toISOString(),
				},
			};

			// Send the complete message object
			socketStore.send(message);
			terminal.write("\r\n\x1b[1;32mConnection request sent!\x1b[0m\r\n");
			terminal.write("\r\nWaiting for device response...\r\n");
		} catch (error) {
			console.error("Error sending connection request:", error);
			terminal.write(
				`\r\n\x1b[1;31mError sending connection request: ${error.message}\x1b[0m\r\n`,
			);
		}
	}

	// Function to send command to device
	function sendCommand(terminal: Terminal, command: string) {
		// Create message to send command to device
		const message = createClientMessage("device", `device:${deviceId}`, {
			action: "terminal-command",
			deviceId,
			command,
		});

		// Send the message via WebSocket
		try {
			socketStore.send("device", message);
			terminal.write(`\r\n> ${command}\r\n`);
		} catch (error) {
			console.error("Error sending command:", error);
			terminal.write(
				`\r\n\x1b[1;31mError sending command: ${error.message}\x1b[0m\r\n`,
			);
		}
	}

	// Set up WebSocket message handler
	const unsubscribe = socketStore.on("device", (message) => {
		if (!terminalInstance) return;

		console.log("Received device message:", message);

		// Handle different message types
		if (message.type === "terminal-response") {
			terminalInstance.write(`${message.payload.output}\r\n`);
		} else if (message.type === "terminal-connected") {
			terminalInstance.write(
				"\r\n\x1b[1;32mConnected to device terminal!\x1b[0m\r\n",
			);
		} else if (message.type === "terminal-error") {
			terminalInstance.write(
				`\r\n\x1b[1;31mError: ${message.payload.error}\x1b[0m\r\n`,
			);
		}
	});

	// Clean up subscription on component destroy
	onDestroy(() => {
		unsubscribe();
	});

	// Terminal load event handler
	async function onLoad(event: CustomEvent<{ terminal: Terminal }>) {
		console.log("Terminal component loaded");
		const terminal = event.detail.terminal;
		terminalInstance = terminal;

		// FitAddon Usage
		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		fitAddon.fit();

		// Welcome message
		terminal.write("\x1b[1;34m=== Device Terminal ===\x1b[0m\r\n");
		terminal.write(`Device ID: ${deviceId}\r\n`);

		// Initialize device connection
		initDevice(terminal);

		// Set up window resize handler
		window.addEventListener("resize", () => {
			try {
				fitAddon.fit();
			} catch (error) {
				console.error("Error fitting terminal on resize:", error);
			}
		});
	}

	// Terminal data event handler (user input)
	function onData(event: CustomEvent<string>) {
		const data = event.detail;
		console.log("User input:", data);

		// Send command to device
		if (terminalInstance) {
			sendCommand(terminalInstance, data);
		}
	}

	// Terminal key event handler
	function onKey(
		event: CustomEvent<{ key: string; domEvent: KeyboardEvent }>,
	) {
		const data = event.detail;
		console.log("Key pressed:", data.key);
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
