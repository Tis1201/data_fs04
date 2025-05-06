<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ArrowLeft, Terminal as TerminalIcon } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { webRTCStore } from '$lib/stores/webrtc-store';
	import { socketStore } from '$lib/stores/websocket-store';

	export let data;
	
	let terminal: Terminal;
	let terminalReady = false;
	let mounted = false;
	let deviceId = $page.params.id;
	let connectionStatus = 'disconnected';
	let peerConnection: RTCPeerConnection | null = null;
	let dataChannel: RTCDataChannel | null = null;
	let webrtcInitialized = false;
	
	// Terminal options following documentation
	let options: ITerminalOptions & ITerminalInitOnlyOptions = {
		cursorBlink: true,
		fontFamily: 'monospace',
		fontSize: 14,
		lineHeight: 1.2,
		theme: {
			background: '#1e1e1e',
			foreground: '#f8f8f8',
			cursor: '#ffffff'
		}
	};

	async function onLoad() {
		if (!browser) return;
		
		console.log('Terminal component loaded');
		
		// Load FitAddon to make terminal responsive
		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		
		// Initial fit
		setTimeout(() => {
			fitAddon.fit();
		}, 100);
		
		terminalReady = true;
		
		// Initial welcome message
		terminal.write('\r\n\x1b[1;34m=== Device Terminal ===\x1b[0m\r\n');
		terminal.write(`\r\nConnecting to device: ${deviceId}...\r\n`);
		
		// Set up WebRTC store subscription - we'll handle this at the component level instead
		// to avoid lifecycle issues
		
		// Setup connection to device after terminal is ready
		setupDeviceConnection();
		
		// Set up window resize handler
		if (browser) {
			window.addEventListener('resize', () => {
				fitAddon.fit();
			});
		}
	}

	function onData(data: string) {
		// Send data to device
		if (connectionStatus === 'connected') {
			sendCommandToDevice(data);
		}
	}
	
	function onKey(data: { key: string; domEvent: KeyboardEvent }) {
		// Optional: Handle special key combinations
		console.log('Key pressed:', data.key);
	}

	// Handler for data channel messages
	function handleDataChannelMessage(event: CustomEvent) {
		const message = event.detail.message;
		terminal.write(`\r\n${message}\r\n`);
	}

	function setupDeviceConnection() {
		console.log(`[Terminal:${deviceId}] Setting up device connection`);
		if (webrtcInitialized) {
			console.log(`[Terminal:${deviceId}] WebRTC already initialized, skipping`);
			return;
		}
		webrtcInitialized = true;
		
		terminal.write('\r\n\x1b[1;34mInitializing WebRTC connection...\x1b[0m\r\n');
		console.log(`[Terminal:${deviceId}] Adding datachannel-message event listener`);
		
		// Initialize WebRTC connection directly with the device ID
		console.log(`[Terminal:${deviceId}] Calling initializeWebRTC with deviceId: ${deviceId}`);
		initializeWebRTC(deviceId);
		
		// Handle data channel messages for terminal
		window.addEventListener('datachannel-message', handleDataChannelMessage);
		console.log(`[Terminal:${deviceId}] Device connection setup complete`);
	}

	function sendCommandToDevice(command: string) {
		console.log(`[Terminal:${deviceId}] Sending command: ${command}`);
		
		// Handle local commands
		if (command.trim() === 'clear') {
			console.log(`[Terminal:${deviceId}] Handling local command: clear`);
			terminal.clear();
			return;
		} else if (command.trim() === 'exit') {
			console.log(`[Terminal:${deviceId}] Handling local command: exit`);
			disconnectWebRTC();
			connectionStatus = 'disconnected';
			terminal.write('\r\n\x1b[1;31mDisconnected from device.\x1b[0m\r\n');
			return;
		}
		
		// Send command through WebRTC data channel if available
		if (dataChannel && dataChannel.readyState === 'open') {
			console.log(`[Terminal:${deviceId}] Sending command via WebRTC data channel`);
			terminal.write(`\r\n> ${command}`);
			
			const message = JSON.stringify({
				type: 'terminal',
				command: command.trim(),
				timestamp: new Date().toISOString()
			});
			console.log(`[Terminal:${deviceId}] WebRTC message:`, message);
			
			try {
				dataChannel.send(message);
				console.log(`[Terminal:${deviceId}] Command sent successfully via WebRTC`);
			} catch (error) {
				console.error(`[Terminal:${deviceId}] Error sending command via WebRTC:`, error);
				terminal.write(`\r\n\x1b[1;31mError sending command: ${error.message}\x1b[0m\r\n`);
			}
		} else {
			// Fallback to messaging framework if WebRTC is not available
			console.log(`[Terminal:${deviceId}] WebRTC data channel not available, using messaging framework`);
			console.log(`[Terminal:${deviceId}] Data channel state:`, dataChannel ? dataChannel.readyState : 'null');
			
			const message = {
				type: 'terminal',
				scope: `device:${deviceId}`,
				payload: {
					command: command.trim(),
					deviceId
				}
			};
			console.log(`[Terminal:${deviceId}] Sending via socketStore:`, message);
			
			try {
				socketStore.send('device', message);
				console.log(`[Terminal:${deviceId}] Command sent successfully via messaging`);
				terminal.write(`\r\n> ${command} (sent via messaging)`);
			} catch (error) {
				console.error(`[Terminal:${deviceId}] Error sending command via messaging:`, error);
				terminal.write(`\r\n\x1b[1;31mError sending command: ${error.message}\x1b[0m\r\n`);
			}
		}
	}

	// Resize handling is now done in the onLoad function

	function initializeWebRTC(deviceId: string) {
		console.log(`[Terminal:${deviceId}] Initializing WebRTC connection`);
		
		// Create a new RTCPeerConnection
		try {
			console.log(`[Terminal:${deviceId}] Creating RTCPeerConnection with STUN server`);
			peerConnection = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
			});
			console.log(`[Terminal:${deviceId}] RTCPeerConnection created successfully`);
		} catch (error) {
			console.error(`[Terminal:${deviceId}] Error creating RTCPeerConnection:`, error);
			terminal.write(`\r\n\x1b[1;31mError creating WebRTC connection: ${error.message}\x1b[0m\r\n`);
			return;
		}
		
		// Create a data channel
		try {
			console.log(`[Terminal:${deviceId}] Creating data channel 'terminal'`);
			dataChannel = peerConnection.createDataChannel('terminal');
			console.log(`[Terminal:${deviceId}] Data channel created successfully:`, dataChannel.label);
		} catch (error) {
			console.error(`[Terminal:${deviceId}] Error creating data channel:`, error);
			terminal.write(`\r\n\x1b[1;31mError creating data channel: ${error.message}\x1b[0m\r\n`);
			return;
		}
		
		// Set up data channel event handlers
		console.log(`[Terminal:${deviceId}] Setting up data channel event handlers`);
		dataChannel.onopen = () => {
			console.log(`[Terminal:${deviceId}] Data channel opened!`);
			terminal.write('\r\n\x1b[1;32mWebRTC data channel opened!\x1b[0m\r\n');
			connectionStatus = 'connected';
			
			// Send initial connection message
			const initialMessage = JSON.stringify({
				type: 'terminal',
				command: 'connect',
				timestamp: new Date().toISOString()
			});
			console.log(`[Terminal:${deviceId}] Sending initial message:`, initialMessage);
			dataChannel.send(initialMessage);
		};
		
		dataChannel.onclose = () => {
			console.log(`[Terminal:${deviceId}] Data channel closed`);
			terminal.write('\r\n\x1b[1;31mWebRTC data channel closed.\x1b[0m\r\n');
			connectionStatus = 'disconnected';
		};
		
		dataChannel.onerror = (event) => {
			console.error(`[Terminal:${deviceId}] Data channel error:`, event);
			terminal.write(`\r\n\x1b[1;31mWebRTC data channel error.\x1b[0m\r\n`);
		};
		
		dataChannel.onmessage = (event) => {
			console.log(`[Terminal:${deviceId}] Received data channel message:`, event.data);
			try {
				const message = JSON.parse(event.data);
				console.log(`[Terminal:${deviceId}] Parsed message:`, message);
				terminal.write(`\r\n${message.content || message.message || event.data}\r\n`);
			} catch (error) {
				console.warn(`[Terminal:${deviceId}] Error parsing message:`, error);
				// If not JSON, just write the raw data
				terminal.write(`\r\n${event.data}\r\n`);
			}
		};
		
		// Set up peer connection event handlers
		console.log(`[Terminal:${deviceId}] Setting up peer connection event handlers`);
		peerConnection.onconnectionstatechange = () => {
			console.log(`[Terminal:${deviceId}] Connection state changed:`, peerConnection.connectionState);
			terminal.write(`\r\n\x1b[1;34mConnection state: ${peerConnection.connectionState}\x1b[0m\r\n`);
		};
		
		peerConnection.onsignalingstatechange = () => {
			console.log(`[Terminal:${deviceId}] Signaling state changed:`, peerConnection.signalingState);
		};
		
		// Set up ICE candidate handling
		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log(`[Terminal:${deviceId}] ICE candidate generated:`, event.candidate);
				// Send the ICE candidate to the signaling server
				const message = {
					type: 'ice-candidate',
					scope: `device:${deviceId}`,
					payload: {
						candidate: event.candidate,
						deviceId
					}
				};
				console.log(`[Terminal:${deviceId}] Sending ICE candidate:`, message);
				socketStore.send('webrtc', message);
			} else {
				console.log(`[Terminal:${deviceId}] ICE candidate gathering complete`);
			}
		};
		
		peerConnection.onicecandidateerror = (event) => {
			console.error(`[Terminal:${deviceId}] ICE candidate error:`, event);
		};
		
		peerConnection.oniceconnectionstatechange = () => {
			console.log(`[Terminal:${deviceId}] ICE connection state changed:`, peerConnection.iceConnectionState);
			if (peerConnection.iceConnectionState === 'failed' || 
				peerConnection.iceConnectionState === 'disconnected') {
				console.warn(`[Terminal:${deviceId}] ICE connection failed or disconnected`);
				terminal.write(`\r\n\x1b[1;31mICE connection state: ${peerConnection.iceConnectionState}\x1b[0m\r\n`);
			}
		};
		
		// Create an offer to start the connection
		console.log(`[Terminal:${deviceId}] Creating offer`);
		peerConnection.createOffer()
			.then(offer => {
				console.log(`[Terminal:${deviceId}] Offer created, setting local description`);
				return peerConnection.setLocalDescription(offer);
			})
			.then(() => {
				// Send the offer to the signaling server
				const message = {
					type: 'offer',
					scope: `device:${deviceId}`,
					payload: {
						sdp: peerConnection.localDescription,
						deviceId
					}
				};
				console.log(`[Terminal:${deviceId}] Sending offer:`, message);
				socketStore.send('webrtc', message);
				terminal.write('\r\n\x1b[1;34mSent WebRTC offer to device...\x1b[0m\r\n');
			})
			.catch(error => {
				console.error(`[Terminal:${deviceId}] Error creating/sending offer:`, error);
				terminal.write(`\r\n\x1b[1;31mWebRTC error: ${error.message}\x1b[0m\r\n`);
			});
		
		// Update the store with the connection
		console.log(`[Terminal:${deviceId}] Updating WebRTC store with new connection`);
		webRTCStore.update(state => ({
			...state,
			peerConnection,
			dataChannel,
			connectionStatus: 'connecting'
		}));
		console.log(`[Terminal:${deviceId}] WebRTC initialization complete`);
	}
	
	function disconnectWebRTC() {
		console.log(`[Terminal:${deviceId}] Disconnecting WebRTC connection`);
		
		// Close the data channel if it exists
		if (dataChannel) {
			console.log(`[Terminal:${deviceId}] Closing data channel:`, dataChannel.label);
			try {
				dataChannel.close();
				console.log(`[Terminal:${deviceId}] Data channel closed successfully`);
			} catch (error) {
				console.error(`[Terminal:${deviceId}] Error closing data channel:`, error);
			}
			dataChannel = null;
		} else {
			console.log(`[Terminal:${deviceId}] No data channel to close`);
		}
		
		// Close the peer connection if it exists
		if (peerConnection) {
			console.log(`[Terminal:${deviceId}] Closing peer connection, current state:`, peerConnection.connectionState);
			try {
				peerConnection.close();
				console.log(`[Terminal:${deviceId}] Peer connection closed successfully`);
			} catch (error) {
				console.error(`[Terminal:${deviceId}] Error closing peer connection:`, error);
			}
			peerConnection = null;
		} else {
			console.log(`[Terminal:${deviceId}] No peer connection to close`);
		}
		
		// Update the store
		console.log(`[Terminal:${deviceId}] Updating WebRTC store to disconnected state`);
		webRTCStore.update(state => ({
			...state,
			peerConnection: null,
			dataChannel: null,
			connectionStatus: 'disconnected'
		}));
		
		// Notify the device that we're disconnecting
		const message = {
			type: 'terminal',
			scope: `device:${deviceId}`,
			payload: {
				command: 'disconnect',
				deviceId
			}
		};
		console.log(`[Terminal:${deviceId}] Sending disconnect notification:`, message);
		
		try {
			socketStore.send('device', message);
			console.log(`[Terminal:${deviceId}] Disconnect notification sent successfully`);
		} catch (error) {
			console.error(`[Terminal:${deviceId}] Error sending disconnect notification:`, error);
		}
		
		console.log(`[Terminal:${deviceId}] WebRTC disconnection complete`);
	}

	function goBack() {
		goto(`/admin/iot/devices/${deviceId}`);
	}

	// Set up WebRTC store subscription at the component level
	let unsubscribe: () => void;

	// Function to send initial connection request to device
	function sendInitialConnectionRequest() {
		console.log(`[Terminal:${deviceId}] Sending initial connection request to device`);
		
		// Send a message to the device to initiate the connection
		const message = {
			type: 'terminal',
			scope: `device:${deviceId}`,
			payload: {
				command: 'connect',
				deviceId,
				timestamp: new Date().toISOString()
			}
		};
		
		console.log(`[Terminal:${deviceId}] Initial connection message:`, message);
		try {
			socketStore.send('device', message);
			console.log(`[Terminal:${deviceId}] Initial connection request sent successfully`);
			terminal.write('\r\n\x1b[1;34mSent connection request to device...\x1b[0m\r\n');
		} catch (error) {
			console.error(`[Terminal:${deviceId}] Error sending initial connection request:`, error);
			terminal.write(`\r\n\x1b[1;31mError sending connection request: ${error.message}\x1b[0m\r\n`);
		}
	}

	onMount(() => {
		if (browser) {
			mounted = true;
			console.log(`[Terminal:${deviceId}] Component mounted`);
			
			// Set up WebRTC subscription
			unsubscribe = webRTCStore.subscribe(state => {
				console.log(`[Terminal:${deviceId}] WebRTC state update:`, {
					connectionStatus: state.connectionStatus,
					hasDataChannel: !!state.dataChannel,
					hasPeerConnection: !!state.peerConnection
				});
				
				if (state.connectionStatus === 'connected') {
					connectionStatus = 'connected';
					peerConnection = state.peerConnection;
					dataChannel = state.dataChannel;
					console.log(`[Terminal:${deviceId}] WebRTC connection established`);
				}
			});
		}
	});

	onDestroy(() => {
		// Clean up any connections if needed
		if (connectionStatus === 'connected') {
			// Disconnect WebRTC
			disconnectWebRTC();
			
			// Change connection status to disconnected
			connectionStatus = 'disconnected';
		}
		
		// Clean up any event listeners
		if (browser) {
			// We need to use the same handler reference to properly remove the event listener
			window.removeEventListener('datachannel-message', handleDataChannelMessage);
			// For resize, we'll need to handle it differently since we don't have a reference to the original handler
		}
		
		// Clean up store subscription
		if (unsubscribe) {
			unsubscribe();
		}
	});
</script>

<svelte:head>
	<title>Device Terminal - {deviceId}</title>
</svelte:head>

<div class="container mx-auto py-4 space-y-4">
	<!-- Breadcrumb Navigation -->
	<div class="flex items-center gap-2 mb-2">
		<a href="/admin" class="text-muted-foreground hover:text-foreground">Admin</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot" class="text-muted-foreground hover:text-foreground">IoT</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot/devices" class="text-muted-foreground hover:text-foreground">Devices</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot/devices/{deviceId}" class="text-muted-foreground hover:text-foreground">{data?.device?.name || deviceId}</a>
	</div>

	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="outline" size="icon" on:click={goBack}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<TerminalIcon class="h-5 w-5" />
				Device Terminal
			</h1>
		</div>
		
		<div class="flex items-center gap-2">
			<Badge variant="outline" class="{connectionStatus === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
				{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
			</Badge>
		</div>
	</div>

	<!-- Terminal Card -->
	<div class="border rounded-lg p-4">
		<div class="mb-4">
			<h2 class="text-lg font-semibold mb-1">Terminal Session</h2>
			<p class="text-sm text-muted-foreground">Connected to device: {data?.device?.name || deviceId}</p>
		</div>
		
		{#if !terminalReady}
			<div class="space-y-4">
				<Skeleton class="h-8 w-full" />
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-4 w-1/2" />
			</div>
		{:else}
			<div class="terminal-container h-[500px] w-full border rounded-md overflow-hidden">
				{#if browser && mounted}
					<Xterm 
						bind:terminal={terminal} 
						options={options} 
						onLoad={onLoad} 
						onData={onData}
						onKey={onKey} 
					/>
				{:else}
					<div class="flex items-center justify-center h-full bg-muted">
						<p class="text-muted-foreground">Terminal loading...</p>
					</div>
				{/if}
			</div>
		{/if}
		
		<div class="flex justify-between mt-4 text-sm text-muted-foreground">
			<div>
				Type "help" for available commands
			</div>
			<div>
				Device ID: {deviceId}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.terminal-container .xterm) {
		height: 100%;
		width: 100%;
		padding: 0.5rem;
	}
</style>
