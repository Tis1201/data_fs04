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
	import {
		createRDPMqttClient,
		type RDPMqttClient,
	} from "$lib/client/mqtt/rdpFlow";
	import { mqttClient } from "$lib/client/mqtt/mqttClient";

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

	// MQTT RDP client
	let rdpMqttClient: RDPMqttClient | undefined;

	// Video rendered by shared component

	// Define breadcrumbs for this page
	const pageCrumbs: [string, string][] = [
		["Devices", "/admin/iot/devices"],
		["Device", `/admin/iot/devices/${deviceId}`],
		["RDP", ""],
	];

	// Track resources for cleanup
	let pingInterval: ReturnType<typeof setInterval> | null = null;
	let unsubscribeWebRTC: () => void;
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
		console.log("[RDP] Initializing WebRTC client...");
		if (!browser) return; // Skip during SSR

		// Clean up existing client if any
		if (webrtcClient) {
			console.log("[RDP] Cleaning up existing WebRTC client");
			webrtcClient.cleanup();
		}

		// Create WebRTC client
		webrtcClient = new WebRTCClient(deviceId as string);
		console.log("[RDP] New WebRTC client created");

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
	}

	// Connection Management Functions
	function connectToDevice() {
		if (!webrtcClient) {
			console.error("WebRTC client not initialized");
			return;
		}

		console.log("Connecting to device:", deviceId);
		isConnecting = true;

		// Start the WebRTC connection
		webrtcClient?.connect();

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

	// Request RDP stream via SSE (control message)
	async function requestRDP() {
		console.log("[RDP] Requesting RDP stream via MQTT");

		// Create MQTT RDP client if not exists
		if (!rdpMqttClient) {
			rdpMqttClient = createRDPMqttClient(deviceId as string);

			// Set up status callback
			rdpMqttClient.onStatus((status, data) => {
				console.log("[RDP] RDP status update:", status, data);
			});

			// Set up error callback
			rdpMqttClient.onError((error) => {
				console.error("[RDP] RDP error:", error);
			});
		}

		// Send RDP start request via MQTT
		try {
			await rdpMqttClient.start({
				frameRate: 60,
				quality: 80,
				captureMode: "screen",
			});
			console.log("[RDP] RDP start request sent via MQTT");
		} catch (error) {
			console.error("[RDP] Failed to send RDP start request:", error);
		}

		// Also set up a fallback retry in case the first request fails
		setTimeout(async () => {
			if (connected && !$webRTCStore.videoStream && rdpMqttClient) {
				console.log("[RDP] Retrying RDP start request...");
				try {
					await rdpMqttClient.start({
						frameRate: 60,
						quality: 80,
						captureMode: "test",
					});
				} catch (error) {
					console.error(
						"[RDP] Failed to retry RDP start request:",
						error,
					);
				}
			}
		}, 3000);
	}

	// Monitor for video stream availability
	$: {
		// WebRTC store updated
		if (browser && rdpMqttClient) {
			setTimeout(async () => {
				if (
					$webRTCStore.connectionStatus !== "connected" &&
					!$webRTCStore.videoStream
				) {
					console.log(
						"No video received, requesting again via MQTT...",
					);
					try {
						await rdpMqttClient.start({
							frameRate: 60,
							quality: 80,
							captureMode: "test",
						});
					} catch (error) {
						console.error(
							"[RDP] Failed to retry RDP start request:",
							error,
						);
					}
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
		if (!connected || !rdpMqttClient) return;

		const { x, y } = getVideoCoordinates(event);
		console.log("[RDP] Sending mouse click via MQTT:", {
			button: "left",
			x,
			y,
		});

		// Send mouse click to device via MQTT
		rdpMqttClient
			.sendControl("rdp:mouse", {
				action: "click",
				button: "left",
				x: x,
				y: y,
			})
			.catch((error) => {
				console.error("[RDP] Failed to send mouse click:", error);
			});

		(event.currentTarget as HTMLVideoElement)?.focus();
	}

	function handleRightClick(event: MouseEvent) {
		if (!connected || !rdpMqttClient) return;

		const { x, y } = getVideoCoordinates(event);
		console.log("[RDP] Sending right click via MQTT:", {
			button: "right",
			x,
			y,
		});

		// Send right click to device via MQTT
		rdpMqttClient
			.sendControl("rdp:mouse", {
				action: "click",
				button: "right",
				x: x,
				y: y,
			})
			.catch((error) => {
				console.error("[RDP] Failed to send right click:", error);
			});
	}

	function handleMouseMove(event: MouseEvent) {
		if (!connected || !rdpMqttClient) return;

		// Throttle mouse move events to avoid flooding
		if (Date.now() - lastMouseMoveTime < 50) return; // 20 FPS max
		lastMouseMoveTime = Date.now();

		const { x, y } = getVideoCoordinates(event);

		// Send mouse move to device via MQTT
		rdpMqttClient
			.sendControl("rdp:mouse", {
				action: "move",
				x: x,
				y: y,
			})
			.catch((error) => {
				// Silently fail for mouse moves to avoid console spam
				console.debug("[RDP] Failed to send mouse move:", error);
			});
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!connected || !rdpMqttClient) return;

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

		console.log("[RDP] Sending key press via MQTT:", {
			key: event.key,
			modifiers,
		});

		// Send key press to device via MQTT
		rdpMqttClient
			.sendControl("rdp:keyboard", {
				key: event.key,
				modifiers: modifiers,
				action: "keydown",
			})
			.catch((error) => {
				console.error("[RDP] Failed to send key press:", error);
			});
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (!connected || !rdpMqttClient) return;

		// Key up sent

		// For key up, we typically don't need special handling in most RDP implementations
		// The key press already handles the full key interaction
	}

	function handleMouseWheel(event: WheelEvent) {
		if (!connected || !rdpMqttClient) return;

		event.preventDefault();

		const direction = event.deltaY > 0 ? "down" : "up";
		const amount = Math.abs(Math.round(event.deltaY / 10)); // Normalize scroll amount

		console.log("[RDP] Sending mouse scroll via MQTT:", {
			direction,
			amount,
		});

		// Send scroll to device via MQTT
		rdpMqttClient
			.sendControl("rdp:mouse", {
				action: "scroll",
				direction: direction,
				amount: amount,
			})
			.catch((error) => {
				console.error("[RDP] Failed to send mouse scroll:", error);
			});
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

		// Clear intervals
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}

		// Send RDP stop command via MQTT and cleanup
		if (connected && rdpMqttClient) {
			try {
				rdpMqttClient.stop().catch((error) => {
					console.error("[RDP] Failed to send stop command:", error);
				});
			} catch (error) {
				console.warn("[RDP] Error sending stop command:", error);
			}
		}

		// Cleanup MQTT RDP client
		if (rdpMqttClient) {
			try {
				rdpMqttClient.cleanup();
			} catch (error) {
				console.log("MQTT RDP cleanup error:", error);
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
