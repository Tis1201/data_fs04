<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { onDestroy, onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { ArrowLeft } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { WebRTCClient } from "$lib/webrtc/WebRTCClient";
	import { webRTCStore } from "$lib/stores/webrtc-store";
	import { deviceStore } from "$lib/stores/device-store";
	import { AdminPageLayout, AdminCard } from "$lib/components/admin";
	import RDPVideo from "$lib/webrtc/RDPVideo.svelte";
	import { mqttClient } from "$lib/client/mqtt/mqttClient";
	import { toast } from "$lib/stores/alertToast";

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

	// Current RDP operation log ID (from rdp.start) - used to mark success when rdp:started received
	let currentRdpLogId: string | null = null;

	// Define breadcrumbs for this page
	const pageCrumbs: [string, string][] = [
		["Devices", "/admin/iot/devices"],
		["Device", `/admin/iot/devices/${deviceId}`],
		["RDP", ""],
	];

	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval> | null = null;
	let connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let unsubscribeWebRTC: () => void;

	// Match server TimeoutConfig.DEVICE_RDP (30s)
	const RDP_CONNECT_TIMEOUT_MS = 30 * 1000;
	let unsubscribeMqttWebRTC: (() => void) | undefined;

	// Video stream handling - get from WebRTC store
	let videoStream: MediaStream | null = $webRTCStore.videoStream;
	let playAttemptInProgress = false;

	// Reactive statement to update videoStream when WebRTC store changes
	$: videoStream = $webRTCStore.videoStream;

	// Reactive statement to update connection state from WebRTC store
	$: connected = $webRTCStore.connectionStatus === "connected";
	$: connecting =
		$webRTCStore.connectionStatus !== "connected" && isConnecting;

	// Note: We rely on autoplay now - no manual play() calls needed for remote desktop
	// This mimics TeamViewer/RDP behavior where video just starts automatically

	// Initialize WebRTC client
	function initWebRTC() {
		if (!browser) return; // Skip during SSR

		// Clean up existing client if any
		if (webrtcClient) {
			webrtcClient.cleanup();
		}

		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId as string);

		// Video track handling is now done automatically by WebRTC client
		// The WebRTC store will be updated with the video stream

		// Track handler is no longer needed - WebRTC client handles video streams automatically
		// The video stream will be available in $webRTCStore.videoStream

		// Set up data channel open callback
		webrtcClient.setDataChannelOpenCallback((dataChannel) => {
			// Data channel is ready for RDP

			// Update WebRTC store to reflect the open data channel
			webRTCStore.update((state) => ({
				...state,
				dataChannelStatus: "open",
			}));

			// Auto-request RDP when data channel opens
			setTimeout(() => {
				requestRDP();
			}, 1000);
		});

		// When device sends rdp:started over WebRTC data channel, notify server to update activity log
		// (Device sends rdp:started only over WebRTC, not MQTT, so server never receives it)
		webrtcClient.setRdpStartedCallback(() => {
			if (connectTimeoutId) {
				clearTimeout(connectTimeoutId);
				connectTimeoutId = null;
			}
			if (currentRdpLogId) {
				fetch(`/api/user/iot/devices/${deviceId}/rdp-complete`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ logId: currentRdpLogId }),
					credentials: 'include'
				}).catch((err) => console.warn('[RDP] Failed to mark RDP success:', err));
				currentRdpLogId = null; // Only fire once per session
			}
		});
	}

	// Connection Management Functions
	async function connectToDevice() {
		if (!webrtcClient) {
			console.error("WebRTC client not initialized");
			return;
		}

		isConnecting = true;

		// Create activity log immediately (even if device is offline) - rdp.start creates log + notifies device
		const options = { frameRate: 60, quality: 80, captureMode: 'screen' as const };
		try {
			await mqttClient.connect();
			const res = await mqttClient.request('rdp.start', { deviceId, options }) as { result?: { result?: { operationId?: string }; operationId?: string }; operationId?: string };
			const opId = res?.result?.result?.operationId ?? res?.result?.operationId ?? res?.operationId;
			if (opId) currentRdpLogId = opId;
		} catch (err) {
			console.error('[RDP] Failed to create RDP session (activity log):', err);
		}

		// Start the WebRTC connection
		webrtcClient?.connect();

		// Client-side 30s timeout (matches server TimeoutConfig.DEVICE_RDP)
		connectTimeoutId = setTimeout(() => {
			if (connected) return;
			connectTimeoutId = null;
			toast.error('Connection timed out: device did not respond within 30 seconds');
			disconnectFromDevice();
		}, RDP_CONNECT_TIMEOUT_MS);

		// Set up ping interval
		pingInterval = setInterval(() => {
			if (webrtcClient && $webRTCStore.connectionStatus === "connected") {
				webrtcClient.sendPing();
			}
		}, 30000); // Ping every 30 seconds

		// Subscribe to WebRTC store updates
		unsubscribeWebRTC = webRTCStore.subscribe((store) => {
			console.log("WebRTC store update:", store);
		});

		// Subscribe to MQTT WebRTC messages (only once)
		if (!unsubscribeMqttWebRTC) {
			unsubscribeMqttWebRTC = mqttClient.onNotification(
				"device:webrtc",
				async (payload: any) => {
					console.log(
						"[RDP] Received WebRTC message via MQTT:",
						payload,
					);
					if (webrtcClient) {
						await webrtcClient.handleWebRTCMessage(payload);
					}
				},
			);
		}

		// Note: Device store subscription for WebRTC messages removed.
		// We use the direct MQTT handler above to avoid duplicate processing.
		// The device store still listens for device:webrtc to record messages,
		// but we don't need to process them again here.
	}

	// Request RDP stream - send via WebRTC data channel (log already created in connectToDevice)
	async function requestRDP() {
		if (!webrtcClient) {
			console.error("[RDP] WebRTC client not initialized");
			return;
		}

		// Check if data channel is open
		if ($webRTCStore.dataChannelStatus !== "open") {
			setTimeout(() => {
				if ($webRTCStore.dataChannelStatus === "open") {
					requestRDP();
				}
			}, 1000);
			return;
		}

		const options = { frameRate: 60, quality: 80, captureMode: "screen" as const };
		try {
			webrtcClient.sendRDPStart(options);
		} catch (error) {
			console.error("[RDP] Failed to send RDP start via WebRTC:", error);
		}
	}

	// Monitor for video stream availability
	$: {
		// WebRTC store updated - video stream should be available via WebRTC
		if (browser && webrtcClient && connected && !$webRTCStore.videoStream) {
			// If connected but no video stream, request RDP again
			setTimeout(() => {
				if (connected && !$webRTCStore.videoStream) {
					requestRDP();
				}
			}, 5000);
		}
	}

	// Disconnect from device
	function disconnectFromDevice() {
		if (connectTimeoutId) {
			clearTimeout(connectTimeoutId);
			connectTimeoutId = null;
		}
		if (!webrtcClient) return;

		currentRdpLogId = null;
		webrtcClient.setRdpStartedCallback(null);

		// Video stream cleanup is handled by WebRTC store

		// Video element cleanup handled by shared component

		// Reset video state
		currentVideoStreamId = null;
		isVideoPaused = true;

		// Close WebRTC connection
		webrtcClient.cleanup();

		// Reset connection state
		isConnecting = false;

		console.log("Disconnected from device");
	}

	// Reset connection state
	function resetConnection() {
		// Update WebRTC store
		webRTCStore.update((state) => ({
			...state,
			connectionStatus: "disconnected",
			dataChannelStatus: "closed",
			peerConnection: null,
			dataChannel: null,
			videoStream: null, // Clear the video stream to prevent reuse
			latestMessage: null,
			error: null,
		}));
	}

	// Note: Connection state is now handled by reactive statement above

	// Stream assignment handled by shared component

	// Remote Desktop Input Handling Functions
	let lastMouseMoveTime = 0;

	/**
	 * Map event coords to video pixel coords, accounting for object-contain
	 * letterboxing. Returns null when the event is outside the visible video
	 * frame unless clamp=true (used for mouseup to avoid stuck buttons).
	 */
	function getVideoCoordinates(event: MouseEvent, clamp = false): { x: number; y: number } | null {
		const target = event.currentTarget as HTMLVideoElement | HTMLImageElement;
		if (!target) return null;
		const rect = target.getBoundingClientRect();
		if (!rect.width || !rect.height) return null;
		let w = "videoWidth" in target ? target.videoWidth : (target as HTMLImageElement).naturalWidth;
		let h = "videoHeight" in target ? target.videoHeight : (target as HTMLImageElement).naturalHeight;
		if (!w || !h) {
			w = 1280;
			h = 720;
		}
		const rectAspect = rect.width / rect.height;
		const videoAspect = w / h;
		let displayW: number, displayH: number, offsetX: number, offsetY: number;
		if (rectAspect > videoAspect) {
			displayH = rect.height;
			displayW = rect.height * videoAspect;
			offsetX = (rect.width - displayW) / 2;
			offsetY = 0;
		} else {
			displayW = rect.width;
			displayH = rect.width / videoAspect;
			offsetX = 0;
			offsetY = (rect.height - displayH) / 2;
		}
		const relX = event.clientX - rect.left - offsetX;
		const relY = event.clientY - rect.top - offsetY;
		if (relX < 0 || relX >= displayW || relY < 0 || relY >= displayH) {
			if (!clamp) return null;
		}
		const x = Math.round(Math.max(0, Math.min(w - 1, (relX / displayW) * w)));
		const y = Math.round(Math.max(0, Math.min(h - 1, (relY / displayH) * h)));
		return { x, y };
	}

	function buttonFromEvent(e: MouseEvent): string {
		if (e.button === 0) return "left";
		if (e.button === 1) return "middle";
		if (e.button === 2) return "right";
		return "left";
	}

	function handleMouseDown(event: MouseEvent) {
		(event.currentTarget as HTMLElement)?.focus();
		if (!connected || !webrtcClient) return;
		const coords = getVideoCoordinates(event);
		if (!coords) return;
		webrtcClient.sendMouseDown(buttonFromEvent(event), coords.x, coords.y);
	}

	function handleMouseUp(event: MouseEvent) {
		if (!connected || !webrtcClient) return;
		const coords = getVideoCoordinates(event, true);
		if (!coords) return;
		webrtcClient.sendMouseUp(buttonFromEvent(event), coords.x, coords.y);
	}

	function handleMouseClick(event: MouseEvent) {
		(event.currentTarget as HTMLVideoElement)?.focus();
	}

	function handleRightClick(event: MouseEvent) {
		if (!connected || !webrtcClient) return;
		const coords = getVideoCoordinates(event);
		if (!coords) return;
		webrtcClient.sendMouseClick("right", coords.x, coords.y);
	}

	function handleMouseMove(event: MouseEvent) {
		if (!connected || !webrtcClient) return;
		if (Date.now() - lastMouseMoveTime < 16) return;
		lastMouseMoveTime = Date.now();
		const coords = getVideoCoordinates(event);
		if (!coords) return;
		webrtcClient.sendMouseMove(coords.x, coords.y);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!connected || !webrtcClient) return;

		// Prevent default browser behavior for most keys
		if (!["F12", "F5"].includes(event.key)) {
			event.preventDefault();
		}

		// Build modifiers array
		const modifiers: string[] = [];
		if (event.ctrlKey) modifiers.push("ctrl");
		if (event.altKey) modifiers.push("alt");
		if (event.shiftKey) modifiers.push("shift");
		if (event.metaKey) modifiers.push("meta");

		webrtcClient.sendKeyPress(event.key, modifiers);
	}

	function handleKeyUp(event: KeyboardEvent) {
		// Key up typically not needed for RDP
		// The key press already handles the full key interaction
	}

	function handleMouseWheel(event: WheelEvent) {
		if (!connected || !webrtcClient) return;

		event.preventDefault();

		const direction = event.deltaY > 0 ? "down" : "up";
		const amount = Math.abs(Math.round(event.deltaY / 10)); // Normalize scroll amount

		webrtcClient.sendMouseScroll(direction, amount);
	}

	// Set up interval and initialize on mount
	onMount(() => {
		if (browser) {
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

		// Clear connect timeout
		if (connectTimeoutId) {
			clearTimeout(connectTimeoutId);
			connectTimeoutId = null;
		}

		// Clear intervals
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}

		// Send RDP stop command via WebRTC and cleanup
		if (connected && webrtcClient) {
			try {
				webrtcClient.sendRDPStop();
			} catch (error) {
				console.warn("[RDP] Error sending stop command:", error);
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
				console.log("WebRTC cleanup error:", error);
			}
		}

		// Unsubscribe from stores
		if (unsubscribeWebRTC) {
			try {
				unsubscribeWebRTC();
			} catch (error) {
				console.log("Error unsubscribing from WebRTC store:", error);
			}
		}

		// Unsubscribe from MQTT WebRTC notifications
		if (unsubscribeMqttWebRTC) {
			try {
				unsubscribeMqttWebRTC();
			} catch (error) {
				console.log("Error unsubscribing from MQTT WebRTC:", error);
			}
		}

		// Note: unsubscribeDevice removed - we no longer use device store subscription for WebRTC

		// Reset connection state
		try {
			resetConnection();
		} catch (error) {
			console.log("Error resetting connection:", error);
		}

		// RDP component destroyed, WebRTC resources cleaned up
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<AdminPageLayout title="Device Remote Desktop" crumbs={pageCrumbs}>
	<svelte:fragment slot="header">
		<div class="flex gap-2 items-center">
			<!-- Connection status indicator -->
			{#if connecting}
				<div
					class="flex items-center gap-2 text-sm text-muted-foreground"
				>
					<div
						class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
					></div>
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
				{videoStream}
				{connected}
				{connecting}
				mqttFrame={null}
				onMouseClick={handleMouseClick}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
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
