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
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";

	// Get device ID from route params
	const deviceId = $page.params.id;

	// Page breadcrumbs
	const pageCrumbs = [
		["Admin", "/admin"],
		["IoT", "/admin/iot"],
		["Devices", "/admin/iot/devices"],
		["Device", `/admin/iot/devices/${deviceId}`],
		["RDP", ""]
	];
	
	// WebRTC client
	let webrtcClient: WebRTCClient;
	
	// Video elements
	let videoContainer: HTMLDivElement;
	let videoElement: HTMLVideoElement;
	
	// Connection state
	let connecting = false;
	let connected = false;
	let isVideoPaused = true;
	let currentVideoStreamId: string | null = null;
	
	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval>;
	let unsubscribeWebRTC: () => void;
	let unsubscribeDevice: () => void;
	let previousWebRTCMessage: WebRTCMessage | null = null;
	
	// Video stream handling
	let videoStream: MediaStream | null = null;
	let playAttemptInProgress = false;
	
	// Safe play function with debounce to avoid multiple rapid play attempts
	function safePlayVideo() {
		if (playAttemptInProgress || !videoElement) return;
		playAttemptInProgress = true;
		
		console.log('Attempting to play video safely...');
		
		// Ensure video is muted for autoplay
		videoElement.muted = true;
		
		// Debug video element state
		console.log('Video element state before play:', {
			readyState: videoElement.readyState,
			paused: videoElement.paused,
			autoplay: videoElement.autoplay,
			muted: videoElement.muted,
			width: videoElement.videoWidth,
			height: videoElement.videoHeight
		});
		
		const playPromise = videoElement.play();
		if (playPromise !== undefined) {
			playPromise
				.then(() => {
					console.log('Video playback started successfully');
					isVideoPaused = false;
					
					// Keep video muted to avoid autoplay policy issues
					// Browser autoplay policy requires user interaction to unmute
					console.log('Video will remain muted - user can unmute manually if needed');
					
					playAttemptInProgress = false;
				})
				.catch(err => {
					console.error('Error playing video:', err);
					isVideoPaused = true;
					playAttemptInProgress = false;
				});
		} else {
			playAttemptInProgress = false;
		}
	}
	
	// Initialize WebRTC client
	function initWebRTC() {
		console.log("Initializing WebRTC client...");
		if (!browser) return; // Skip during SSR
		
		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId);
		
		// Function to handle a video track
		const handleVideoTrack = (track: MediaStreamTrack) => {
			console.log('Processing video track:', track.id, 'readyState:', track.readyState);
			
			// Create a MediaStream and add the track
			const stream = new MediaStream();
			stream.addTrack(track);
			console.log('Created MediaStream with video track, stream ID:', stream.id);
			
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
				console.log('Video track unmuted');
				// Ensure video is playing when track is unmuted
				if (videoElement && videoElement.paused) {
					console.log('Video is paused when track unmuted, attempting to play');
					safePlayVideo();
				}
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
			webRTCStore.update(currentState => ({
				...currentState,
				connectionState: state
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
					connecting = true;
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
		
		// Check if data channel is open
		if ($webRTCStore.dataChannelStatus !== 'open') {
			console.warn('Data channel not open, cannot request video stream');
			return;
		}
		
		// Send request to device to start video stream
		// const message = {
		// 	type: 'device',
		// 	payload: {
		// 		action: 'message',
		// 		type: 'webrtc:video-request',
		// 		deviceId: deviceId
		// 	},
		// 	scope: `subscription:device:${deviceId}`
		// };
		
		// socketStore.send(message);
		// console.log('Sent RDP request');
		
		// If no video appears after a timeout, try requesting again
		setTimeout(() => {
			if (!connected && videoElement && !videoElement.srcObject) {
				console.log('No video received, requesting again...');
				socketStore.send(message);
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
		connected = false;
		connecting = false;
		
		// Update WebRTC store
		webRTCStore.update(state => ({
			...state,
			connectionState: 'closed',
			dataChannelStatus: 'closed'
		}));
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
	
	// Monitor video play/pause state
	function updateVideoState() {
		if (!videoElement) return;
		isVideoPaused = videoElement.paused;
	}
	
	// When a video stream is available, bind it to the video element
	$: if (videoStream && videoElement && (!currentVideoStreamId || currentVideoStreamId !== videoStream.id)) {
		console.log('[WebRTC] Setting video stream to element:', videoStream.id);
		currentVideoStreamId = videoStream.id;
		
		// Only set srcObject if it's a different stream
		if (videoElement.srcObject !== videoStream) {
			videoElement.srcObject = videoStream;
			console.log('Set video element srcObject to stream');
			// Attempt to play the video
			safePlayVideo();
		}
	}
	
	// Set up interval and initialize on mount
	let videoStateInterval;
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
		
		// We don't need to unsubscribe from WebRTC store anymore since we're using callbacks
		// but we'll keep the variable check for backward compatibility
		if (unsubscribeWebRTC) {
			unsubscribeWebRTC();
		}
		
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
			connectionState: 'closed',
			dataChannelStatus: 'closed'
		}));
		
		console.log('RDP component destroyed, WebRTC resources cleaned up');
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<PageContainer crumbs={pageCrumbs}>
	<PageHeader title="Device Remote Desktop">
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
	</PageHeader>
	
	<PageContent>
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
					<div class="relative w-full h-full">
						<video 
							bind:this={videoElement} 
							class="w-full h-full object-contain bg-black"
							autoplay
							playsinline
							controls
							muted={true} 
							on:loadedmetadata={() => {
								console.log('[WebRTC] Video metadata loaded');
								// Use our safe play function to handle autoplay
								safePlayVideo();
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
						></video>
						
						<!-- Play button overlay that shows only if video is not playing -->
						{#if isVideoPaused && videoStream}
						<div 
							class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 cursor-pointer"
							on:click={() => {
								// Use our safe play function
								safePlayVideo();
							}}
						>
							<Button size="lg" variant="default">
								Play Video
							</Button>
						</div>
						{/if}
					</div>
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
	</PageContent>
</PageContainer>
