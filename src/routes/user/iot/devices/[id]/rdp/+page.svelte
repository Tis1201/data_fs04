<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { socketStore } from '$lib/stores/websocket-store';
	import { webRTCStore } from '$lib/stores/webrtc-store';
	import { deviceStore } from "$lib/stores/device-store";
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Loader2, Monitor, ArrowLeft } from 'lucide-svelte';
	import { WebRTCClient } from '$lib/webrtc/WebRTCClient';
	import { browser } from "$app/environment";
	import type { WebRTCMessage } from "$lib/stores/webrtc-store";
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import RDPVideo from "$lib/webrtc/RDPVideo.svelte";

	// Get device ID from route params
	const deviceId = $page.params.id;

	// Page breadcrumbs
	const pageCrumbs: [string, string][] = [
		["Home", "/user"],
		["Devices", "/user/iot/devices"],
		["Device", `/user/iot/devices/${deviceId}`],
		["RDP", ""]
	];
	
	// WebRTC client
	let webrtcClient: WebRTCClient;
	
    // Video rendered by shared component
	
	// Connection state
	let isConnecting = false;
	let connecting = false;
	let connected = false;
	let isVideoPaused = true;
	let currentVideoStreamId: string | null = null;
	
	// Track resources for cleanup
    let pingInterval: ReturnType<typeof setInterval> | null = null;
	let unsubscribeDevice: () => void;
	let previousWebRTCMessage: WebRTCMessage | null = null;
	
	// Video stream handling - get from WebRTC store
	let videoStream: MediaStream | null = $webRTCStore.videoStream;
	let playAttemptInProgress = false;
	
	// Reactive statement to update videoStream when WebRTC store changes
	$: videoStream = $webRTCStore.videoStream;
	
	// Reactive statement to update connection state from WebRTC store
	$: connected = $webRTCStore.connectionStatus === 'connected';
	$: connecting = $webRTCStore.connectionStatus !== 'connected' && isConnecting;
	
	// Note: We rely on autoplay now - no manual play() calls needed for remote desktop
	// This mimics TeamViewer/RDP behavior where video just starts automatically
	
	// Initialize WebRTC client
	function initWebRTC() {
		console.log("Initializing WebRTC client...");
		if (!browser) return; // Skip during SSR
		
		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId as string);
		
		// Note: Video track handling is now done automatically by WebRTCClient
		// which updates the WebRTC store, and our reactive statement will pick it up
		
		// Set up data channel open callback
		webrtcClient.setDataChannelOpenCallback((dataChannel) => {
			// Data channel is ready for RDP
			
			// Update WebRTC store to reflect the open data channel
			webRTCStore.update(state => ({
				...state,
				dataChannelStatus: 'open'
			}));
			
			// Request video stream after data channel is open
			setTimeout(() => {
				requestRDP();
			}, 1000); // Wait a bit for connection to stabilize
		});
		
		// Set up connection state callback
		// Note: Connection state is now handled by reactive statement above
		
		// Subscribe to device store for WebRTC signaling messages
		unsubscribeDevice = deviceStore.subscribe(async (state) => {
			// Process new WebRTC messages
			if (state.latestWebRTCMessage && 
			    state.latestWebRTCMessage !== previousWebRTCMessage) {
				previousWebRTCMessage = state.latestWebRTCMessage;
				await webrtcClient.handleWebRTCMessage(state.latestWebRTCMessage);
			}
		});
		
		// Start ping interval to keep connection alive
		// pingInterval = setInterval(() => {
		// 	if ($webRTCStore.dataChannelStatus === 'open') {
		// 		webrtcClient.sendPing();
		// 	}
		// }, 10000); // Send ping every 10 seconds
	}
	
	// Connect to device
	async function connectToDevice() {
		console.log("Connecting to device...");
		if (!webrtcClient) return;
		
		isConnecting = true;
		
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

		// Check if data channel is open
		if ($webRTCStore.dataChannelStatus !== 'open') {
			console.warn('Data channel not open, cannot request video stream');
			return;
		}

		// Request device to start RDP video over the data channel
		webrtcClient.sendRDPStart({
			frameRate: 60,
			quality: 80,
			captureMode: 'screen'
		});
		// RDP start request sent

        // If no video appears after a timeout, try requesting again
        setTimeout(() => {
            if (!connected && !videoStream) {
                console.log('No video received, requesting again...');
                webrtcClient.sendRDPStart({ frameRate: 60, quality: 80, captureMode: 'screen' });
            }
        }, 5000);
	}
	
	// Disconnect from device
	function disconnectFromDevice() {
		if (!webrtcClient) return;
		
		// Clean up video stream
		if (videoStream) {
			videoStream.getTracks().forEach(track => {
				track.stop();
			});
			videoStream = null;
		}
		
        // Video element cleanup handled by shared component
		
		// Reset video state
		currentVideoStreamId = null;
		isVideoPaused = true;
		
		// Clean up WebRTC client
		webrtcClient.cleanup();
		
		// Update state
		isConnecting = false;
		
		// Update WebRTC store
		webRTCStore.update(state => ({
			...state,
			connectionStatus: 'disconnected',
			dataChannelStatus: 'closed'
		}));
	}
	
	// Handle WebRTC connection state changes
    $: {
        if ($webRTCStore.connectionStatus === 'connected') {
            isConnecting = false;
        } else if ($webRTCStore.connectionStatus === 'error') {
            isConnecting = false;
        }
        // For 'disconnected' state, keep isConnecting as-is to show the connecting indicator
    }
	
	// Note: Connection state is now handled by reactive statement above
	
    // Monitor video play/pause state handled by component
    function updateVideoState() {}
	
    // Stream assignment handled by shared component
	
	// Remote Desktop Input Handling Functions
	let lastMouseMoveTime = 0;

    function getVideoCoordinates(event: MouseEvent) {
        const target = event.currentTarget as HTMLVideoElement;
        if (!target) return { x: 0, y: 0 };
        const rect = target.getBoundingClientRect();
        const scaleX = target.videoWidth / rect.width;
        const scaleY = target.videoHeight / rect.height;
		
		const x = Math.round((event.clientX - rect.left) * scaleX);
		const y = Math.round((event.clientY - rect.top) * scaleY);
		
		// Mouse coordinates calculated
		return { x, y };
	}

	function handleMouseClick(event: MouseEvent) {
		if (!webrtcClient || !connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		// Mouse click sent
		
		// Send mouse click to device
		webrtcClient.sendMouseClick('left', x, y);
		
		// Focus the video element to capture keyboard events
        (event.currentTarget as HTMLVideoElement)?.focus();
	}

	function handleRightClick(event: MouseEvent) {
		if (!webrtcClient || !connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		// Right click sent
		
		// Send right click to device
		webrtcClient.sendMouseClick('right', x, y);
	}

	function handleMouseMove(event: MouseEvent) {
		if (!webrtcClient || !connected) return;
		
		// Throttle mouse move events to avoid flooding
		if (Date.now() - lastMouseMoveTime < 50) return; // 20 FPS max
		lastMouseMoveTime = Date.now();
		
		const { x, y } = getVideoCoordinates(event);
		
		// Send mouse move to device
		webrtcClient.sendMouseMove(x, y);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!webrtcClient || !connected) return;
		
		// Key down sent
		
		// Prevent default browser behavior for most keys
		if (!['F12', 'F5'].includes(event.key)) {
			event.preventDefault();
		}
		
		// Build modifiers array
		const modifiers: string[] = [];
		if (event.ctrlKey) modifiers.push('ctrl');
		if (event.altKey) modifiers.push('alt');
		if (event.shiftKey) modifiers.push('shift');
		if (event.metaKey) modifiers.push('meta');
		
		// Send key press to device
		webrtcClient.sendKeyPress(event.key, modifiers);
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (!webrtcClient || !connected) return;
		
		// Key up sent
		
		// For key up, we typically don't need special handling in most RDP implementations
		// The key press already handles the full key interaction
	}

	function handleMouseWheel(event: WheelEvent) {
		if (!webrtcClient || !connected) return;
		
		event.preventDefault();
		
		const direction = event.deltaY > 0 ? 'down' : 'up';
		const amount = Math.abs(Math.round(event.deltaY / 10)); // Normalize scroll amount
		
		// Mouse wheel sent
		
		// Send scroll to device
		webrtcClient.sendMouseScroll(direction, amount);
	}

	// Set up interval and initialize on mount
	let videoStateInterval: ReturnType<typeof setInterval> | null = null;
	onMount(() => {
		if (browser) {
			// Initialize WebRTC client first
			initWebRTC();
			
			// Set up video state monitoring
			videoStateInterval = setInterval(updateVideoState, 1000);
			
			// Automatically connect to device when page loads
			setTimeout(() => {
				connectToDevice();
			}, 1000); // Longer delay to ensure everything is initialized
		}
	});
	
	// Clean up on destroy
	onDestroy(() => {
		// Skip cleanup in SSR
		if (!browser) return;
		
		// Clear intervals
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}
		
		if (videoStateInterval) {
			clearInterval(videoStateInterval);
			videoStateInterval = null;
		}
		
		// Unsubscribe from stores
		if (unsubscribeDevice) {
			unsubscribeDevice();
		}
		
        // No WebRTC store unsubscribe needed (callbacks used)
		
		// Clean up video stream
		if (videoStream) {
			videoStream.getTracks().forEach(track => {
				track.stop();
			});
			videoStream = null;
		}
		

		// Video element cleanup handled by shared component
		
		// Reset video state
		currentVideoStreamId = null;
		isVideoPaused = true;
		
		// Clean up WebRTC client
		if (webrtcClient) {
			webrtcClient.cleanup();
		}
		
		// Reset WebRTC store state
		webRTCStore.update(state => ({
			...state,
			connectionStatus: 'disconnected',
			dataChannelStatus: 'closed',
			videoStream: null  // Clear the video stream to prevent reuse
		}));
		
		// RDP component destroyed, WebRTC resources cleaned up
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<AdminPageLayout 
	title="Device Remote Desktop" 
	crumbs={pageCrumbs}
	actionLabel="Back to Device"
	actionIcon={ArrowLeft}
	actionHref={"/user/iot/devices/" + deviceId}
>
	<svelte:fragment slot="header">
		<div class="flex gap-2 items-center">
			<!-- Connection status indicator -->
			{#if connecting}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
					Connecting to device...
				</div>
			{:else if connected}
				<div class="flex items-center gap-2 text-sm text-green-600">
					<div class="h-3 w-3 bg-green-500 rounded-full"></div>
					Connected
				</div>
				<!-- Only show disconnect as an option -->
				<Button on:click={disconnectFromDevice} variant="outline" size="sm">
					Disconnect
				</Button>
			{:else}
				<div class="flex items-center gap-2 text-sm text-red-600">
					<div class="h-3 w-3 bg-red-500 rounded-full"></div>
					Disconnected
				</div>
			{/if}
		</div>
	</svelte:fragment>
	
	<AdminCard
		title="Remote Desktop Connection"
		description="View and interact with the device's screen through this remote desktop interface."
		icon={Monitor}
	>
                <div class="flex flex-col items-center">
                    <RDPVideo
                        videoStream={videoStream}
                        connected={connected}
                        connecting={connecting}
                        onMouseClick={handleMouseClick}
                        onMouseMove={handleMouseMove}
                        onRightClick={handleRightClick}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        onMouseWheel={handleMouseWheel}
                    />
					
					<div class="mt-4 w-full">
						<p class="text-sm text-muted-foreground">
							Device ID: {deviceId}
						</p>
						<p class="text-sm text-muted-foreground mt-1">
                            Connection State: {$webRTCStore.connectionStatus}
						</p>
					</div>
				</div>
	</AdminCard>
</AdminPageLayout>
