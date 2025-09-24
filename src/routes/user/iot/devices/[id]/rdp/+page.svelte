<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { socketStore } from '$lib/stores/websocket-store';
	import { webRTCStore } from '$lib/stores/webrtc-store';
	import { deviceStore } from "$lib/stores/device-store";
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Loader2, Monitor, ArrowLeft } from 'lucide-svelte';
	import { WebRTCClient } from '../terminal/webrtc-client';
	import { browser } from "$app/environment";
	import type { WebRTCMessage } from "$lib/stores/webrtc-store";
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
	import { AdminPageLayout, AdminCard } from "$lib/components/admin";

	// Get device ID from route params
	const deviceId = $page.params.id;

	// Page breadcrumbs
	const pageCrumbs: [string, string][] = [
		["Home", "/user"],
		["IoT", "/user/iot"],
		["Devices", "/user/iot/devices"],
		["Device", `/user/iot/devices/${deviceId}`],
		["RDP", ""]
	];
	
	// WebRTC client
	let webrtcClient: WebRTCClient;
	
	// Video elements
	let videoContainer: HTMLDivElement;
	let videoElement: HTMLVideoElement;
	
	// Connection state
	let isConnecting = false;
	let isVideoPaused = true;
	let currentVideoStreamId: string | null = null;
	
	// Track resources for cleanup
    let pingInterval: ReturnType<typeof setInterval> | null = null;
	let unsubscribeDevice: () => void;
	let previousWebRTCMessage: WebRTCMessage | null = null;
	
	// Video stream handling
	let videoStream: MediaStream | null = null;
	let playAttemptInProgress = false;
	
	// Note: We rely on autoplay now - no manual play() calls needed for remote desktop
	// This mimics TeamViewer/RDP behavior where video just starts automatically
	
	// Initialize WebRTC client
	function initWebRTC() {
		console.log("Initializing WebRTC client...");
		if (!browser) return; // Skip during SSR
		
		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId as string);
		
		// Function to handle a video track
		const handleVideoTrack = (track: MediaStreamTrack) => {
			console.log('Processing video track:', track.id, 'readyState:', track.readyState);
			console.log('Track details:', {
				kind: track.kind,
				id: track.id,
				label: track.label,
				enabled: track.enabled,
				muted: track.muted,
				readyState: track.readyState,
				settings: track.getSettings(),
				constraints: track.getConstraints()
			});
			
			// Create a MediaStream and add the track
			const stream = new MediaStream();
			stream.addTrack(track);
			console.log('Created MediaStream with video track, stream ID:', stream.id);
			console.log('MediaStream details:', {
				id: stream.id,
				active: stream.active,
				tracks: stream.getTracks().length
			});
			
			// Store the stream for reactive binding
			videoStream = stream;
			
			// Track events
			track.onended = () => {
				console.log('Video track ended');
			};
			
			track.onmute = () => {
				console.log('Video track muted');
			};
			
			track.onunmute = () => {
				console.log('Video track unmuted - autoplay will handle playback');
			};
		};
		
		// Set up track handler for video streams
		webrtcClient.onTrackHandler = (track) => {
			console.log('Received track:', track.kind, track, 'Track ID:', track.id, 'Track readyState:', track.readyState);
			
			if (track.kind === 'video') {
				console.log('Video track received! Track settings:', track.getSettings());
				
				// Call our handler function to process the video track
				handleVideoTrack(track);
			} else {
				console.log('Non-video track received, kind:', track.kind);
			}
			
			// Update UI to show connected state
			connecting = false;
			connected = true;
		};
		
		// Set up data channel open callback
		webrtcClient.setDataChannelOpenCallback((dataChannel) => {
			console.log('Data channel is open and ready for RDP');
			
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
		webrtcClient.setConnectionStateCallback((state) => {
			console.log(`WebRTC connection state changed to: ${state}`);
			
			// Update WebRTC store with the new connection state
			// Map raw RTCPeerConnectionState to our limited store states
			const mapped: 'connected' | 'disconnected' | 'error' =
				state === 'connected' ? 'connected' :
				state === 'failed' || state === 'closed' ? 'error' :
				'disconnected';
			webRTCStore.update(currentState => ({
				...currentState,
				connectionStatus: mapped
			}));
			
			// Update UI based on connection state
			if (state === 'connected') {
				connecting = false;
				connected = true;
			} else if (state === 'disconnected') {
				// Don't change UI immediately for disconnected state
				// as it might reconnect automatically
				console.log('Connection disconnected - may reconnect automatically');
			} else if (state === 'failed' || state === 'closed') {
				connecting = false;
				connected = false;
				
				// Attempt to reconnect after a brief delay
				setTimeout(() => {
					console.log('Attempting to reconnect...');
					isConnecting = true;
					webrtcClient.connect();
				}, 2000);
			}
		});
		
		// Subscribe to device store for WebRTC signaling messages
		unsubscribeDevice = deviceStore.subscribe(state => {
			// Process new WebRTC messages
			if (state.latestWebRTCMessage && 
			    state.latestWebRTCMessage !== previousWebRTCMessage) {
				previousWebRTCMessage = state.latestWebRTCMessage;
				webrtcClient.handleWebRTCMessage(state.latestWebRTCMessage);
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
		console.log('Sent RDP start request');

		// If no video appears after a timeout, try requesting again
		setTimeout(() => {
			if (!connected && videoElement && !videoElement.srcObject) {
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
		
		// Clean up video element
		if (videoElement && videoElement.srcObject) {
			videoElement.srcObject = null;
		}
		
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
	
	// Derived connection state
	$: connected = $webRTCStore.connectionStatus === 'connected';
	$: connecting = isConnecting && $webRTCStore.connectionStatus !== 'connected';
	
	// Monitor video play/pause state
	function updateVideoState() {
		if (!videoElement) return;
		isVideoPaused = videoElement.paused;
	}
	
	// Simple video stream assignment without reactive conflicts
	$: if (videoStream && videoElement && videoStream.id !== currentVideoStreamId) {
		console.log('[WebRTC] New video stream received:', videoStream.id);
		console.log('[WebRTC] Video stream has', videoStream.getTracks().length, 'tracks');
		
		// Set stream directly - let autoplay handle the rest
		videoElement.srcObject = videoStream;
		currentVideoStreamId = videoStream.id;
		
		console.log('[WebRTC] Video stream assigned - autoplay will handle playback');
		
		// Debug video element state after assignment
		setTimeout(() => {
			console.log('[Video Debug] Element state after stream assignment:', {
				srcObject: !!videoElement.srcObject,
				readyState: videoElement.readyState,
				videoWidth: videoElement.videoWidth,
				videoHeight: videoElement.videoHeight,
				paused: videoElement.paused,
				muted: videoElement.muted,
				autoplay: videoElement.autoplay,
				currentTime: videoElement.currentTime,
				duration: videoElement.duration
			});
			
			// Try manual play if autoplay failed
			if (videoElement.paused) {
				console.log('[Video Debug] Video is paused, attempting manual play...');
				videoElement.play().then(() => {
					console.log('[Video Debug] Manual play successful');
				}).catch(e => {
					console.error('[Video Debug] Manual play failed:', e);
				});
			}
		}, 1000);
	}
	
	// Remote Desktop Input Handling Functions
	let lastMouseMoveTime = 0;

	function getVideoCoordinates(event: MouseEvent) {
		if (!videoElement) return { x: 0, y: 0 };
		
		const rect = videoElement.getBoundingClientRect();
		const scaleX = videoElement.videoWidth / rect.width;
		const scaleY = videoElement.videoHeight / rect.height;
		
		const x = Math.round((event.clientX - rect.left) * scaleX);
		const y = Math.round((event.clientY - rect.top) * scaleY);
		
		console.log(`[RDP] Mouse coordinates: screen(${event.clientX}, ${event.clientY}) -> video(${x}, ${y})`);
		return { x, y };
	}

	function handleMouseClick(event: MouseEvent) {
		if (!webrtcClient || !connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		console.log(`[RDP] Mouse click at (${x}, ${y})`);
		
		// Send mouse click to device
		webrtcClient.sendMouseClick('left', x, y);
		
		// Focus the video element to capture keyboard events
		if (videoElement) {
			videoElement.focus();
		}
	}

	function handleRightClick(event: MouseEvent) {
		if (!webrtcClient || !connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		console.log(`[RDP] Right click at (${x}, ${y})`);
		
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
		
		console.log(`[RDP] Key down: ${event.key} (code: ${event.code})`);
		
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
		
		console.log(`[RDP] Key up: ${event.key} (code: ${event.code})`);
		
		// For key up, we typically don't need special handling in most RDP implementations
		// The key press already handles the full key interaction
	}

	function handleMouseWheel(event: WheelEvent) {
		if (!webrtcClient || !connected) return;
		
		event.preventDefault();
		
		const direction = event.deltaY > 0 ? 'down' : 'up';
		const amount = Math.abs(Math.round(event.deltaY / 10)); // Normalize scroll amount
		
		console.log(`[RDP] Mouse wheel: ${direction} by ${amount}`);
		
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
		
		// Clean up video element
		if (videoElement && videoElement.srcObject) {
			videoElement.srcObject = null;
		}
		
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
			dataChannelStatus: 'closed'
		}));
		
		console.log('RDP component destroyed, WebRTC resources cleaned up');
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
					<div 
						class="w-full aspect-video bg-muted rounded-lg overflow-hidden" 
						bind:this={videoContainer}
					>
						{#if !connected}
							<div class="h-full flex items-center justify-center">
								<p class="text-muted-foreground">
									{connecting ? "Connecting to device..." : "Not connected to device"}
								</p>
							</div>
						{:else}
							<div class="relative w-full h-full">
								<video 
									bind:this={videoElement} 
									class="w-full h-full object-contain bg-black cursor-crosshair"
									autoplay
									playsinline
									controls={false}
									muted={true} 
									tabindex="0"
									on:loadedmetadata={() => {
										console.log('[WebRTC] Video metadata loaded - autoplay should start');
									}}
									on:playing={() => {
										console.log('[WebRTC] Video playback started');
										isVideoPaused = false;
									}}
									on:pause={() => {
										console.log('[WebRTC] Video playback paused');
										isVideoPaused = true;
									}}
									on:error={(e) => console.error('[WebRTC] Video error:', e)}
									on:click={handleMouseClick}
									on:mousemove={handleMouseMove}
									on:contextmenu|preventDefault={handleRightClick}
									on:keydown={handleKeyDown}
									on:keyup={handleKeyUp}
									on:wheel={handleMouseWheel}
								></video>
								
								<!-- Connection status overlay -->
								{#if !videoStream}
									<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
										<div class="text-white text-center">
											<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
											<p>Waiting for video stream...</p>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
					
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
