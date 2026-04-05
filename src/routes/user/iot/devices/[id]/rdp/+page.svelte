<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { onDestroy, onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { ArrowLeft, Maximize2, Minimize2 } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";
	import { WebRTCClient } from "$lib/webrtc/WebRTCClient";
	import { webRTCStore } from "$lib/stores/webrtc-store";
	import RDPVideo from "$lib/webrtc/RDPVideo.svelte";
	import { mqttClient } from "$lib/client/mqtt/mqttClient";
	import { toast } from "$lib/stores/alertToast";
	import type { WebRTCMessage } from "$lib/stores/webrtc-store";
	import {
		getRdpVideoCoordinates,
		readStoredDisplayMode,
		writeStoredDisplayMode,
		type RdpDisplayMode,
	} from "$lib/webrtc/rdpPointerMapping";

	const deviceId = $page.params.id;

	let isConnecting = false;
	let connecting = false;
	let connected = false;

	let webrtcClient: WebRTCClient | undefined;
	let currentRdpLogId: string | null = null;

	let pingInterval: ReturnType<typeof setInterval> | null = null;
	let connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let unsubscribeWebRTC: () => void;

	const RDP_CONNECT_TIMEOUT_MS = 30 * 1000;
	let unsubscribeMqttWebRTC: (() => void) | undefined;

	let videoStream: MediaStream | null = $webRTCStore.videoStream;
	$: videoStream = $webRTCStore.videoStream;

	$: connected = $webRTCStore.connectionStatus === "connected";
	$: connecting =
		$webRTCStore.connectionStatus !== "connected" && isConnecting;

	let displayMode: RdpDisplayMode = "bestFit";
	let modalEl: HTMLDivElement | null = null;
	let browserFullscreen = false;

	function onFullscreenChange() {
		browserFullscreen = !!document.fullscreenElement;
	}

	function initWebRTC() {
		if (!browser) return;

		if (webrtcClient) {
			webrtcClient.cleanup();
		}

		webrtcClient = new WebRTCClient(deviceId as string);

		webrtcClient.setDataChannelOpenCallback(() => {
			webRTCStore.update((state) => ({
				...state,
				dataChannelStatus: "open",
			}));
			setTimeout(() => {
				requestRDP();
			}, 1000);
		});

		webrtcClient.setRdpStartedCallback(() => {
			if (connectTimeoutId) {
				clearTimeout(connectTimeoutId);
				connectTimeoutId = null;
			}
			if (currentRdpLogId) {
				fetch(`/api/user/iot/devices/${deviceId}/rdp-complete`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ logId: currentRdpLogId }),
					credentials: "include",
				}).catch((err) =>
					console.warn("[RDP] Failed to mark RDP success:", err),
				);
				currentRdpLogId = null;
			}
		});
	}

	async function connectToDevice() {
		if (!webrtcClient) {
			console.error("WebRTC client not initialized");
			return;
		}

		isConnecting = true;

		const options = {
			frameRate: 60,
			quality: 80,
			captureMode: "screen" as const,
		};
		try {
			await mqttClient.connect();
			const res = (await mqttClient.request("rdp.start", {
				deviceId,
				options,
			})) as {
				result?: {
					result?: { operationId?: string };
					operationId?: string;
				};
				operationId?: string;
			};
			const opId =
				res?.result?.result?.operationId ??
				res?.result?.operationId ??
				res?.operationId;
			if (opId) currentRdpLogId = opId;
		} catch (err) {
			console.error("[RDP] Failed to create RDP session (activity log):", err);
		}

		webrtcClient?.connect();

		connectTimeoutId = setTimeout(() => {
			if (connected) return;
			connectTimeoutId = null;
			const msg =
				"Connection timed out: device did not respond within 30 seconds";
			toast.error(msg);
			disconnectFromDevice();
		}, RDP_CONNECT_TIMEOUT_MS);

		pingInterval = setInterval(() => {
			if (webrtcClient && $webRTCStore.connectionStatus === "connected") {
				webrtcClient.sendPing();
			}
		}, 30000);

		unsubscribeWebRTC = webRTCStore.subscribe((store) => {
			console.log("WebRTC store update:", store);
		});

		if (!unsubscribeMqttWebRTC) {
			unsubscribeMqttWebRTC = mqttClient.onNotification(
				"device:webrtc",
				async (payload: WebRTCMessage) => {
					if (webrtcClient) {
						await webrtcClient.handleWebRTCMessage(payload);
					}
				},
			);
		}
	}

	async function requestRDP() {
		if (!webrtcClient) {
			console.error("[RDP] WebRTC client not initialized");
			return;
		}

		if ($webRTCStore.dataChannelStatus !== "open") {
			setTimeout(() => {
				if ($webRTCStore.dataChannelStatus === "open") {
					requestRDP();
				}
			}, 1000);
			return;
		}

		const options = {
			frameRate: 60,
			quality: 80,
			captureMode: "screen" as const,
		};
		try {
			webrtcClient.sendRDPStart(options);
		} catch (error) {
			console.error("[RDP] Failed to send RDP start via WebRTC:", error);
		}
	}

	$: {
		if (browser && webrtcClient && connected && !$webRTCStore.videoStream) {
			setTimeout(() => {
				if (connected && !$webRTCStore.videoStream) {
					requestRDP();
				}
			}, 5000);
		}
	}

	function disconnectFromDevice() {
		if (connectTimeoutId) {
			clearTimeout(connectTimeoutId);
			connectTimeoutId = null;
		}
		if (!webrtcClient) return;

		currentRdpLogId = null;
		webrtcClient.setRdpStartedCallback(null);

		webrtcClient.cleanup();
		isConnecting = false;
	}

	function resetConnection() {
		webRTCStore.update((state) => ({
			...state,
			connectionStatus: "disconnected",
			dataChannelStatus: "closed",
			peerConnection: null,
			dataChannel: null,
			videoStream: null,
			latestMessage: null,
			error: null,
		}));
	}

	function closeRdp() {
		goto(`/user/iot/devices/${deviceId}`);
	}

	function setDisplayMode(mode: RdpDisplayMode) {
		displayMode = mode;
		writeStoredDisplayMode(mode);
	}

	async function toggleBrowserFullscreen() {
		if (!modalEl || !browser) return;
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await modalEl.requestFullscreen();
			}
		} catch (e) {
			console.warn("[RDP] Fullscreen:", e);
		}
	}

	let lastMouseMoveTime = 0;

	function getVideoCoordinates(event: MouseEvent, clamp = false) {
		return getRdpVideoCoordinates(event, displayMode, clamp);
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

	function handleMouseMove(event: MouseEvent) {
		if (!connected || !webrtcClient) return;
		if (Date.now() - lastMouseMoveTime < 16) return;
		lastMouseMoveTime = Date.now();
		const coords = getVideoCoordinates(event);
		if (!coords) return;
		webrtcClient.sendMouseMove(coords.x, coords.y);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			if (document.fullscreenElement) {
				void document.exitFullscreen();
				return;
			}
			closeRdp();
			return;
		}

		if (!connected || !webrtcClient) return;

		if (!["F12", "F5"].includes(event.key)) {
			event.preventDefault();
		}

		const modifiers: string[] = [];
		if (event.ctrlKey) modifiers.push("ctrl");
		if (event.altKey) modifiers.push("alt");
		if (event.shiftKey) modifiers.push("shift");
		if (event.metaKey) modifiers.push("meta");

		webrtcClient.sendKeyPress(event.key, modifiers);
	}

	function handleKeyUp(_event: KeyboardEvent) {}

	function handleMouseWheel(event: WheelEvent) {
		if (!connected || !webrtcClient) return;

		event.preventDefault();

		const direction = event.deltaY > 0 ? "down" : "up";
		const amount = Math.abs(Math.round(event.deltaY / 10));

		webrtcClient.sendMouseScroll(direction, amount);
	}

	onMount(() => {
		const stored = readStoredDisplayMode();
		if (stored) displayMode = stored;

		if (browser) {
			document.addEventListener("fullscreenchange", onFullscreenChange);
			initWebRTC();
			setTimeout(() => {
				connectToDevice();
			}, 1000);
		}
	});

	onDestroy(() => {
		if (!browser) return;

		document.removeEventListener("fullscreenchange", onFullscreenChange);

		if (connectTimeoutId) {
			clearTimeout(connectTimeoutId);
			connectTimeoutId = null;
		}

		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}

		if (connected && webrtcClient) {
			try {
				webrtcClient.sendRDPStop();
			} catch (error) {
				console.warn("[RDP] Error sending stop command:", error);
			}
		}

		if (webrtcClient) {
			try {
				webrtcClient.cleanup();
			} catch (error) {
				console.log("WebRTC cleanup error:", error);
			}
		}

		if (unsubscribeWebRTC) {
			try {
				unsubscribeWebRTC();
			} catch (error) {
				console.log("Error unsubscribing from WebRTC store:", error);
			}
		}

		if (unsubscribeMqttWebRTC) {
			try {
				unsubscribeMqttWebRTC();
			} catch (error) {
				console.log("Error unsubscribing from MQTT WebRTC:", error);
			}
		}

		try {
			resetConnection();
		} catch (error) {
			console.log("Error resetting connection:", error);
		}
	});
</script>

<svelte:head>
	<title>Device RDP - {deviceId}</title>
</svelte:head>

<div
	bind:this={modalEl}
	class="fixed inset-0 z-50 flex flex-col bg-background"
	role="dialog"
	aria-modal="true"
	aria-labelledby="rdp-dialog-title"
>
	<header
		class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2"
	>
		<Button variant="ghost" size="icon" class="shrink-0" on:click={closeRdp} aria-label="Close remote desktop">
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<h1 id="rdp-dialog-title" class="text-base font-semibold tracking-tight">
			Remote desktop
		</h1>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			<div class="flex rounded-md border bg-muted/50 p-0.5 text-xs">
				<button
					type="button"
					class="rounded px-2 py-1 transition-colors"
					class:bg-background={displayMode === "bestFit"}
					class:shadow-sm={displayMode === "bestFit"}
					class:text-foreground={displayMode === "bestFit"}
					class:text-muted-foreground={displayMode !== "bestFit"}
					on:click={() => setDisplayMode("bestFit")}
				>
					Best fit
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 transition-colors"
					class:bg-background={displayMode === "original"}
					class:shadow-sm={displayMode === "original"}
					class:text-foreground={displayMode === "original"}
					class:text-muted-foreground={displayMode !== "original"}
					on:click={() => setDisplayMode("original")}
				>
					Original (1:1)
				</button>
			</div>
			<Button
				variant="outline"
				size="sm"
				class="hidden sm:inline-flex"
				on:click={toggleBrowserFullscreen}
			>
				{#if browserFullscreen}
					<Minimize2 class="mr-1 h-4 w-4" />
					Exit fullscreen
				{:else}
					<Maximize2 class="mr-1 h-4 w-4" />
					Fullscreen
				{/if}
			</Button>
			<Button variant="outline" size="sm" on:click={closeRdp}>
				Close
			</Button>
			{#if connecting}
				<span class="flex items-center gap-1.5 text-sm text-muted-foreground">
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
					></span>
					Connecting…
				</span>
			{:else if connected}
				<span class="flex items-center gap-1.5 text-sm text-green-600">
					<span class="h-2 w-2 rounded-full bg-green-500"></span>
					Connected
				</span>
			{:else}
				<span class="flex items-center gap-1.5 text-sm text-red-600">
					<span class="h-2 w-2 rounded-full bg-red-500"></span>
					Disconnected
				</span>
			{/if}
		</div>
	</header>

	{#if displayMode === "original"}
		<p class="shrink-0 border-b px-3 py-1 text-center text-[11px] text-muted-foreground">
			Scroll to pan. Use <kbd class="rounded border bg-muted px-1">Ctrl</kbd> +
			scroll to send wheel to the device.
		</p>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1">
		<RDPVideo
			fillViewport={true}
			className="rounded-md border border-border/60"
			{displayMode}
			autoFocusMedia={true}
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
		<p class="mt-1 shrink-0 text-center text-[11px] text-muted-foreground">
			<span class="font-mono">{deviceId}</span>
			· {$webRTCStore.connectionStatus}
		</p>
	</div>
</div>
