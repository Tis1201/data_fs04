<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { socketStore } from '$lib/stores/websocket-store';
	import { webRTCStore } from '$lib/stores/webrtc-store';
	import { deviceStore } from "$lib/stores/device-store";
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Loader2, Monitor } from 'lucide-svelte';
	import { WebRTCClient } from '../terminal/webrtc-client';
	import { browser } from "$app/environment";
	import type { WebRTCMessage } from "$lib/stores/webrtc-store";

	// Get device ID from route params
	const deviceId = $page.params.id;
	
	// WebRTC client
	let webrtcClient: WebRTCClient;
	
	// Video elements
	let videoContainer: HTMLDivElement;
	let videoElement: HTMLVideoElement;
	
	// Connection state
	let connecting = false;
	let connected = false;
	
	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval>;
	let unsubscribeWebRTC: () => void;
	let unsubscribeDevice: () => void;
	let previousWebRTCMessage: WebRTCMessage | null = null;
	
	// Initialize WebRTC client
	function initWebRTC() {
		console.log("Initializing WebRTC client...");
		if (!browser) return; // Skip during SSR
		
		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId);
		
		// Set up track handler
		webrtcClient.onTrackHandler = (track) => {
			if (!videoElement) return;
			
			console.log('Received track:', track.kind);
			
			// Create a MediaStream and add the track
			const stream = new MediaStream();
			stream.addTrack(track);
			
			// Set the stream as the source for the video element
			videoElement.srcObject = stream;
			videoElement.play().catch(err => {
				console.error('Error playing video:', err);
			});
		};
		
		// Subscribe to device store
		unsubscribeDevice = deviceStore.subscribe(state => {
			// Process new WebRTC messages
			if (state.latestWebRTCMessage && 
			    state.latestWebRTCMessage !== previousWebRTCMessage) {
				previousWebRTCMessage = state.latestWebRTCMessage;
				webrtcClient.handleWebRTCMessage(state.latestWebRTCMessage);
			}
		});
		
		// Start ping interval
		pingInterval = setInterval(() => {
			if ($webRTCStore.dataChannelStatus === 'open') {
				webrtcClient.sendPing();
			}
		}, 10000); // Send ping every 10 seconds
		
		// Subscribe to WebRTC store for connection status changes
		unsubscribeWebRTC = webRTCStore.subscribe(state => {
			if (state.dataChannelStatus === 'open' && !connected) {
				// Request video stream after data channel is open
				setTimeout(() => {
					requestRDP();
				}, 1000); // Wait a bit for connection to stabilize
			}
		});
	}
	
	// Connect to device
	async function connectToDevice() {
		console.log("Connecting to device...");
		if (!webrtcClient) return;
		
		connecting = true;
		
		try {
			// Connect to device
			webrtcClient.connect();
		} catch (error) {
			console.error('Error connecting to device:', error);
			connecting = false;
		}
	}
	
	// Request RDP stream
	function requestRDP() {
		if (!webrtcClient) return;
		
		// Send request to device to start video stream
		const message = {
			type: 'device',
			payload: {
				action: 'message',
				type: 'webrtc:video-request',
				deviceId: deviceId
			},
			scope: `subscription:device:${deviceId}`
		};
		
		socketStore.send(message);
		console.log('Sent RDP request');
	}
	
	// Disconnect from device
	function disconnectFromDevice() {
		if (!webrtcClient) return;
		
		// Clean up WebRTC client
		webrtcClient.cleanup();
		connected = false;
	}
	
	// Handle WebRTC connection state changes
	$: {
		if ($webRTCStore.connectionState === 'connected') {
			connecting = false;
			connected = true;
		} else if ($webRTCStore.connectionState === 'disconnected' || 
				  $webRTCStore.connectionState === 'failed' || 
				  $webRTCStore.connectionState === 'closed') {
			connecting = false;
			connected = false;
		}
	}
	
	// Initialize on mount
	onMount(() => {
		if (browser) {
			initWebRTC();
			// Automatically connect to device when page loads
			setTimeout(() => {
				connectToDevice();
			}, 500); // Small delay to ensure WebRTC client is fully initialized
		}
	});
	
	// Clean up on destroy
	onDestroy(() => {
		// Skip cleanup in SSR
		if (!browser) return;
		
		// Clear intervals
		if (pingInterval) {
			clearInterval(pingInterval);
		}
		
		// Unsubscribe from stores
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		if (unsubscribeWebRTC) {
			unsubscribeWebRTC();
		}
		
		// Clean up WebRTC client
		if (webrtcClient) {
			disconnectFromDevice();
		}
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
	<div class="flex justify-between items-center">
		<h1 class="text-3xl font-bold">Device Remote Desktop</h1>
		
		<div class="flex items-center space-x-2">
			<Badge variant={connected ? "success" : "destructive"}>
				{connected ? "Connected" : "Disconnected"}
			</Badge>
			
			{#if !connected}
				<Button on:click={connectToDevice} disabled={connecting}>
					{#if connecting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<Monitor class="mr-2 h-4 w-4" />
					{/if}
					Connect
				</Button>
			{:else}
				<Button on:click={disconnectFromDevice} variant="destructive">
					Disconnect
				</Button>
				<Button on:click={requestRDP} variant="outline">
					Request Screen
				</Button>
			{/if}
		</div>
	</div>
	
	<div class="border rounded-lg p-4 bg-card">
		<div class="flex flex-col items-center">
			<div 
				class="w-full max-w-3xl aspect-video bg-muted rounded-lg overflow-hidden" 
				bind:this={videoContainer}
			>
				{#if !connected}
					<div class="h-full flex items-center justify-center">
						<p class="text-muted-foreground">
							{connecting ? "Connecting to device..." : "Not connected to device"}
						</p>
					</div>
				{:else}
					<video 
						bind:this={videoElement} 
						class="w-full h-full object-contain bg-black"
						autoplay
						playsinline
						muted
					></video>
				{/if}
			</div>
			
			<div class="mt-4 w-full max-w-3xl">
				<p class="text-sm text-muted-foreground">
					Device ID: {deviceId}
				</p>
				<p class="text-sm text-muted-foreground mt-1">
					Connection State: {$webRTCStore.connectionState}
				</p>
			</div>
		</div>
	</div>
</div>
