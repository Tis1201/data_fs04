<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { onDestroy, onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { ArrowLeft } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { WebRTCClient } from '$lib/webrtc/WebRTCClient';
	import { webRTCStore } from "$lib/stores/webrtc-store";
	import { deviceStore } from "$lib/stores/device-store";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import RDPVideo from "$lib/webrtc/RDPVideo.svelte";

	/****************************************************************************
	 * 
	 * Variables 
	 * 
	 ****************************************************************************/
	// Get device ID from URL
	const deviceId = $page.params.id;

	// State variables
	let isConnecting = false;
	let connecting = false;
	let connected = false;
	let currentVideoStreamId: string | null = null;
	let isVideoPaused = true;

	// WebRTC client
	let webrtcClient: WebRTCClient | undefined;
	
    // Video rendered by shared component

	// Define breadcrumbs for this page
	const pageCrumbs: [string, string][] = [
		["Devices", "/admin/iot/devices"],
		["Device", `/admin/iot/devices/${deviceId}`],
		["RDP", ""]
	];

	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval> | null = null;
	let unsubscribeWebRTC: () => void;
	let unsubscribeDevice: () => void;
	let previousWebRTCMessage: any = null;

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
		console.log('[RDP] Initializing WebRTC client...');
		if (!browser) return; // Skip during SSR
		
		// Clean up existing client if any
		if (webrtcClient) {
			console.log('[RDP] Cleaning up existing WebRTC client');
			webrtcClient.cleanup();
		}
		
		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId as string);
		console.log('[RDP] New WebRTC client created');
		
		// Video track handling is now done automatically by WebRTC client
		// The WebRTC store will be updated with the video stream
		
		// Track handler is no longer needed - WebRTC client handles video streams automatically
		// The video stream will be available in $webRTCStore.videoStream
		
		// Set up data channel open callback
		webrtcClient.setDataChannelOpenCallback((dataChannel) => {
			// Data channel is ready for RDP
			
			// Update WebRTC store to reflect the open data channel
			webRTCStore.update(state => ({
				...state,
				dataChannelStatus: 'open'
			}));
			
			// Auto-request RDP when data channel opens
			setTimeout(() => {
				requestRDP();
			}, 1000);
		});
	}

	// Connection Management Functions
	function connectToDevice() {
		if (!webrtcClient) {
			console.error('WebRTC client not initialized');
			return;
		}
		
		console.log('Connecting to device:', deviceId);
		isConnecting = true;
		
		// Start the WebRTC connection
		webrtcClient?.connect();
		
		// Set up ping interval
		pingInterval = setInterval(() => {
			if (webrtcClient && $webRTCStore.connectionStatus === 'connected') {
				webrtcClient.sendPing();
			}
		}, 30000); // Ping every 30 seconds
		
		// Subscribe to WebRTC store updates
		unsubscribeWebRTC = webRTCStore.subscribe((store) => {
			console.log('WebRTC store update:', store);
		});

		// Subscribe to device store for WebRTC signaling messages
		unsubscribeDevice = deviceStore.subscribe(async (state) => {
			// Process new WebRTC messages
			if (state.latestWebRTCMessage && 
			    state.latestWebRTCMessage !== previousWebRTCMessage) {
				previousWebRTCMessage = state.latestWebRTCMessage;
				console.log('Processing WebRTC message from device store:', state.latestWebRTCMessage);
				await webrtcClient?.handleWebRTCMessage(state.latestWebRTCMessage);
			}
		});
	}

	// Request RDP stream
	function requestRDP() {
		if (!webrtcClient) {
			console.error('WebRTC client not initialized');
			return;
		}
		
		// Requesting RDP stream from device
		
		// Request device to start RDP video over the data channel
		webrtcClient.sendRDPStart({
			frameRate: 60,
			quality: 80,
			captureMode: 'screen'
		});
		// RDP start request sent
		
		// Also set up a fallback retry in case the first request fails
		setTimeout(() => {
			if (webrtcClient && connected && !$webRTCStore.videoStream) {
				// Retrying RDP start
				webrtcClient.sendRDPStart({ frameRate: 60, quality: 80, captureMode: 'test' });
			}
		}, 3000);
	}

    // Monitor for video stream availability
    $: {
        // WebRTC store updated
        
        setTimeout(() => {
            if ($webRTCStore.connectionStatus !== 'connected' && !$webRTCStore.videoStream) {
                console.log('No video received, requesting again...');
                webrtcClient?.sendRDPStart({ frameRate: 60, quality: 80, captureMode: 'test' });
            }
        }, 5000);
    }
	
	// Disconnect from device
	function disconnectFromDevice() {
		if (!webrtcClient) return;
		
		// Video stream cleanup is handled by WebRTC store
		
        // Video element cleanup handled by shared component
		
		// Reset video state
		currentVideoStreamId = null;
		isVideoPaused = true;
		
		// Close WebRTC connection
		webrtcClient.cleanup();
		
		// Reset connection state
		isConnecting = false;
		
		console.log('Disconnected from device');
	}

	// Reset connection state
	function resetConnection() {
		// Update WebRTC store
		webRTCStore.update(state => ({
			...state,
			connectionStatus: 'disconnected',
			dataChannelStatus: 'closed',
			peerConnection: null,
			dataChannel: null,
			videoStream: null,  // Clear the video stream to prevent reuse
			latestMessage: null,
			error: null
		}));
	}

	// Note: Connection state is now handled by reactive statement above
	
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
	onMount(() => {
		if (browser) {
			// Initialize WebRTC client first
			initWebRTC();
			
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
		
		// Clean up WebRTC resources
		if (webrtcClient) {
			// Send RDP stop command
			try {
				webrtcClient.sendRDPStop();
			} catch (error) {
				// RDP stop command failed (expected if connection already closed)
			}
			
			// Video stream cleanup is handled by WebRTC store
			
            // Video element cleanup handled by shared component
			
			// Close WebRTC connection
			try {
				webrtcClient.cleanup();
			} catch (error) {
				console.log('WebRTC cleanup error:', error);
			}
		}
		
		// Unsubscribe from stores
		if (unsubscribeWebRTC) {
			try {
				unsubscribeWebRTC();
			} catch (error) {
				console.log('Error unsubscribing from WebRTC store:', error);
			}
		}

		if (unsubscribeDevice) {
			try {
				unsubscribeDevice();
			} catch (error) {
				console.log('Error unsubscribing from device store:', error);
			}
		}
		
		// Reset connection state
		try {
			resetConnection();
		} catch (error) {
			console.log('Error resetting connection:', error);
		}
		
		// RDP component destroyed, WebRTC resources cleaned up
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<AdminPageLayout 
	title="Device Remote Desktop" 
	crumbs={pageCrumbs}
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
	>
                <div class="flex flex-col items-center space-y-4 w-full">
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