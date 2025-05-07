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

	// Handle terminal messages from the deviceStore
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
	
	// WebRTC peer connection and data channel
	let peerConnection: RTCPeerConnection | null = null;
	let dataChannel: RTCDataChannel | null = null;
	
	// Initialize WebRTC peer connection
	function initializePeerConnection() {
		if (peerConnection) {
			// Close existing connection if it exists
			peerConnection.close();
		}
		
		console.log("Initializing WebRTC peer connection");
		peerConnection = new RTCPeerConnection({
			iceServers: [
				{ urls: 'stun:stun.l.google.com:19302' }
			]
		});
		
		// Set up ICE candidate handling
		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log(`[Terminal WebRTC] Local ICE candidate: ${event.candidate.candidate}`);
				
				// Send ICE candidate to the device
				const iceCandidateMessage = {
					type: "device",
					scope: `subscription:device:${deviceId}`,
					payload: {
						action: "message",
						type: "webrtc:ice-candidate",
						deviceId: deviceId,
						candidate: {
							candidate: event.candidate.candidate,
							sdpMid: event.candidate.sdpMid,
							sdpMLineIndex: event.candidate.sdpMLineIndex
						},
						_clientMessageId: `ice-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 10)}`
					}
				};
				
				socketStore.send(iceCandidateMessage);
			} else {
				console.log('[Terminal WebRTC] ICE candidate gathering complete');
			}
		};
		
		// Monitor connection state changes
		peerConnection.oniceconnectionstatechange = () => {
			const iceState = peerConnection?.iceConnectionState;
			console.log(`[Terminal WebRTC] ICE connection state changed to: ${iceState}`);
			
			if (iceState === 'connected' || iceState === 'completed') {
				console.log('[Terminal WebRTC] Connection established');
				if (terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;32mWebRTC connection established!\x1b[0m\r\n");
				}
			} else if (iceState === 'failed' || iceState === 'disconnected' || iceState === 'closed') {
				console.error('[Terminal WebRTC] Connection failed or closed');
				if (terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;31mWebRTC connection failed or closed.\x1b[0m\r\n");
				}
			}
		};
		
		// Handle incoming data channels
		peerConnection.ondatachannel = (event) => {
			console.log('[Terminal WebRTC] Data channel received:', event.channel.label);
			dataChannel = event.channel;
			
			// Set up data channel event handlers
			dataChannel.onmessage = (msgEvent) => {
				console.log('[Terminal WebRTC] Data channel message received:', msgEvent.data);
				if (terminalInstance) {
					terminalInstance.write(`\r\n[WebRTC] ${msgEvent.data}\r\n`);
				}
			};
			
			dataChannel.onopen = () => {
				console.log('[Terminal WebRTC] Data channel opened');
				if (terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;32mWebRTC data channel opened!\x1b[0m\r\n");
				}
			};
			
			dataChannel.onclose = () => {
				console.log('[Terminal WebRTC] Data channel closed');
				if (terminalInstance) {
					terminalInstance.write("\r\n\x1b[1;31mWebRTC data channel closed.\x1b[0m\r\n");
				}
			};
		};
		
		return peerConnection;
	}

	// Handle WebRTC messages from the deviceStore
	function handleWebRTCMessage(message) {
		if (!message) return;
		
		// Only process messages for this specific device
		if (message.deviceId && message.deviceId !== deviceId) {
			return;
		}
		
		console.log("Processing WebRTC message:", message);
		
		// Handle different WebRTC message types
		switch (message.type) {
			case "webrtc:offer":
				console.log("Received WebRTC offer:", message);
				
				// Initialize peer connection if it doesn't exist
				if (!peerConnection) {
					peerConnection = initializePeerConnection();
				}
				
				// Ensure we have a valid SDP
				if (!message.sdp) {
					console.error("Missing SDP in offer message");
					return;
				}
				
				// Create a proper RTCSessionDescription object
				const offerDesc = new RTCSessionDescription({
					type: 'offer',
					sdp: message.sdp
				});
				
				console.log('[Terminal WebRTC] Setting remote description for offer');
				peerConnection.setRemoteDescription(offerDesc)
					.then(() => {
						console.log('[Terminal WebRTC] Creating answer...');
						return peerConnection.createAnswer();
					})
					.then(answer => {
						console.log('[Terminal WebRTC] Setting local description for answer');
						return peerConnection.setLocalDescription(answer);
					})
					.then(() => {
						console.log('[Terminal WebRTC] Sending answer to device');
						
						// Create a proper WebRTC answer message
						const answerMessage = {
							type: "device",
							scope: `subscription:device:${deviceId}`,
							payload: {
								action: "message",
								type: "webrtc:answer",
								deviceId: deviceId,
								sdp: peerConnection.localDescription.sdp,
								_clientMessageId: `answer-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 10)}`
							}
						};
						
						// Send the answer message via socketStore
						console.log("Sending WebRTC answer:", answerMessage);
						socketStore.send(answerMessage);
					})
					.catch(error => {
						console.error('[Terminal WebRTC] Error handling offer:', error);
					});
				break;
				
			case "webrtc:answer":
				console.log("Received WebRTC answer:", message);
				
				// Ensure we have a peer connection and valid SDP
				if (!peerConnection) {
					console.error("No peer connection available for answer");
					return;
				}
				
				if (!message.sdp) {
					console.error("Missing SDP in answer message");
					return;
				}
				
				// Create a proper RTCSessionDescription object
				const answerDesc = new RTCSessionDescription({
					type: 'answer',
					sdp: message.sdp
				});
				
				console.log('[Terminal WebRTC] Setting remote description for answer');
				peerConnection.setRemoteDescription(answerDesc)
					.then(() => {
						console.log('[Terminal WebRTC] Remote description set successfully');
					})
					.catch(error => {
						console.error('[Terminal WebRTC] Error setting remote description:', error);
					});
				break;
				
			case "webrtc:ice-candidate":
				console.log("Received WebRTC ICE candidate:", message);
				
				// Ensure we have a peer connection and valid candidate
				if (!peerConnection) {
					console.error("No peer connection available for ICE candidate");
					return;
				}
				
				if (!message.candidate) {
					console.error("Missing candidate data in ICE candidate message");
					return;
				}
				
				// Create a proper RTCIceCandidate object
				const iceCandidate = new RTCIceCandidate({
					candidate: message.candidate.candidate,
					sdpMid: message.candidate.sdpMid,
					sdpMLineIndex: message.candidate.sdpMLineIndex
				});
				
				console.log('[Terminal WebRTC] Adding ICE candidate');
				peerConnection.addIceCandidate(iceCandidate)
					.then(() => {
						console.log('[Terminal WebRTC] ICE candidate added successfully');
					})
					.catch(error => {
						console.error('[Terminal WebRTC] Error adding ICE candidate:', error);
					});
				break;
		}
	}

	// Subscribe to the deviceStore for all device-related events
	let unsubscribeDevice: () => void;
	let previousTerminalMessage: any = null;
	let previousWebRTCMessage: any = null;
	
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
				handleWebRTCMessage(state.latestWebRTCMessage);
			}
		});
	});

	// Clean up subscription and WebRTC connection on component destroy
	onDestroy(() => {
		// Unsubscribe from device store
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		
		// Close data channel if it exists
		if (dataChannel) {
			dataChannel.close();
			dataChannel = null;
		}
		
		// Close peer connection if it exists
		if (peerConnection) {
			peerConnection.close();
			peerConnection = null;
		}
		
		console.log('[Terminal WebRTC] Cleaned up WebRTC resources');
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
