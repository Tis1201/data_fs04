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
	import { sseStore } from "$lib/stores/sse-store";
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
		["Home", "/user"],
		["IoT", "/user/iot"],
		["Devices", "/user/iot/devices"],
		["Device", `/user/iot/devices/${deviceId}`],
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

	// Request RDP stream via SSE (control message)
	function requestRDP() {
		console.log('[RDP] Requesting RDP stream via SSE');
		
		// Ensure SSE connection is established
		if (!$sseStore.isConnected) {
			console.log('[RDP] SSE not connected, connecting...');
			sseStore.connect('/api/sse', { withCredentials: true });
		}

		// Send RDP start request via SSE
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:start',
				deviceId: deviceId,
				options: {
					frameRate: 60,
					quality: 80,
					captureMode: 'screen'
				}
			}
		}).then(() => {
			console.log('[RDP] RDP start request sent via SSE');
		}).catch(error => {
			console.error('[RDP] Failed to send RDP start request:', error);
		});
		
		// Also set up a fallback retry in case the first request fails
		setTimeout(() => {
			if (connected && !$webRTCStore.videoStream) {
				console.log('[RDP] Retrying RDP start request...');
				sseStore.sendRequest({
					type: 'rdp',
					scope: 'user:self',
					payload: {
						type: 'rdp:start',
						deviceId: deviceId,
						options: {
							frameRate: 60,
							quality: 80,
							captureMode: 'test'
						}
					}
				}).catch(error => {
					console.error('[RDP] Failed to retry RDP start request:', error);
				});
			}
		}, 3000);
	}

    // Monitor for video stream availability
    $: {
        // WebRTC store updated
        if (browser) {
            setTimeout(() => {
                if ($webRTCStore.connectionStatus !== 'connected' && !$webRTCStore.videoStream) {
                    console.log('No video received, requesting again via SSE...');
                    // Use SSE instead of WebRTC data channel (per migration plan)
                    sseStore.sendRequest({
                        type: 'rdp',
                        scope: 'user:self',
                        payload: {
                            type: 'rdp:start',
                            deviceId: deviceId,
                            options: {
                                frameRate: 60,
                                quality: 80,
                                captureMode: 'test'
                            }
                        }
                    }).catch(error => {
                        console.error('[RDP] Failed to retry RDP start request:', error);
                    });
                }
            }, 5000);
        }
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
		if (!connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		console.log('[RDP] Sending mouse click via SSE:', { button: 'left', x, y });
		
		// Send mouse click to device via SSE
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:mouse',
				deviceId: deviceId,
				mouse: {
					action: 'click',
					button: 'left',
					x: x,
					y: y
				}
			}
		}).catch(error => {
			console.error('[RDP] Failed to send mouse click:', error);
		});
		
        (event.currentTarget as HTMLVideoElement)?.focus();
	}

	function handleRightClick(event: MouseEvent) {
		if (!connected) return;
		
		const { x, y } = getVideoCoordinates(event);
		console.log('[RDP] Sending right click via SSE:', { button: 'right', x, y });
		
		// Send right click to device via SSE
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:mouse',
				deviceId: deviceId,
				mouse: {
					action: 'click',
					button: 'right',
					x: x,
					y: y
				}
			}
		}).catch(error => {
			console.error('[RDP] Failed to send right click:', error);
		});
	}

	function handleMouseMove(event: MouseEvent) {
		if (!connected) return;
		
		// Throttle mouse move events to avoid flooding
		if (Date.now() - lastMouseMoveTime < 50) return; // 20 FPS max
		lastMouseMoveTime = Date.now();
		
		const { x, y } = getVideoCoordinates(event);
		
		// Send mouse move to device via SSE (no requestId needed for frequent events)
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:mouse',
				deviceId: deviceId,
				mouse: {
					action: 'move',
					x: x,
					y: y
				}
			}
		}).catch(error => {
			// Silently fail for mouse moves to avoid console spam
			console.debug('[RDP] Failed to send mouse move:', error);
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!connected) return;
		
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
		
		console.log('[RDP] Sending key press via SSE:', { key: event.key, modifiers });
		
		// Send key press to device via SSE
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:keyboard',
				deviceId: deviceId,
				keyboard: {
					key: event.key,
					modifiers: modifiers,
					action: 'keydown'
				}
			}
		}).catch(error => {
			console.error('[RDP] Failed to send key press:', error);
		});
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (!webrtcClient || !connected) return;
		
		// Key up sent
		
		// For key up, we typically don't need special handling in most RDP implementations
		// The key press already handles the full key interaction
	}

	function handleMouseWheel(event: WheelEvent) {
		if (!connected) return;
		
		event.preventDefault();
		
		const direction = event.deltaY > 0 ? 'down' : 'up';
		const amount = Math.abs(Math.round(event.deltaY / 10)); // Normalize scroll amount
		
		console.log('[RDP] Sending mouse scroll via SSE:', { direction, amount });
		
		// Send scroll to device via SSE
		sseStore.sendRequest({
			type: 'rdp',
			scope: 'user:self',
			payload: {
				type: 'rdp:mouse',
				deviceId: deviceId,
				mouse: {
					action: 'scroll',
					direction: direction,
					amount: amount
				}
			}
		}).catch(error => {
			console.error('[RDP] Failed to send mouse scroll:', error);
		});
	}

	// Set up interval and initialize on mount
	onMount(() => {
		if (browser) {
			// Ensure SSE connection is established for RDP control/input
			if (!$sseStore.isConnected) {
				console.log('[RDP] Connecting to SSE...');
				sseStore.connect('/api/sse', { withCredentials: true });
			}

			// Subscribe to device updates so we can receive RDP messages
			let lastSubscribedConnectionId: string | null = null;
			const subscribeToDevice = () => {
				const connId = sseStore.connectionId;
				if (!connId || connId === lastSubscribedConnectionId) {
					return;
				}
				console.log('[RDP] Subscribing to device channel:', { deviceId, connId });
				fetch(`/api/sse/subscribe/device/${deviceId}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ connectionId: connId })
				}).then(() => {
					lastSubscribedConnectionId = connId;
					console.log('[RDP] Successfully subscribed to device channel');
				}).catch((err) => {
					console.warn('[RDP] Failed to subscribe to device channel:', err);
				});
			};

			// Subscribe immediately if connectionId is available
			if (sseStore.connectionId) {
				subscribeToDevice();
			}

			// Also subscribe when connection is established
			sseStore.on('connected', (msg: any) => {
				const connId = msg?.data?.connectionId || sseStore.connectionId;
				if (connId && connId !== lastSubscribedConnectionId) {
					subscribeToDevice();
				}
			});

			// Initialize WebRTC client for video streaming
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
		
		// Send RDP stop command via SSE
		if (connected) {
			try {
				sseStore.sendRequest({
					type: 'rdp',
					scope: 'user:self',
					payload: {
						type: 'rdp:stop',
						deviceId: deviceId
					}
				}).catch(error => {
					console.error('[RDP] Failed to send stop command:', error);
				});
			} catch (error) {
				console.warn('[RDP] Error sending stop command:', error);
			}
		}

		// Clean up WebRTC resources
		if (webrtcClient) {
			
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
