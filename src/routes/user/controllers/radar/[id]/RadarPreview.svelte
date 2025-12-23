<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        mqttClient,
        type UserMqttStatus,
    } from "$lib/client/mqtt/mqttClient";
    import { Button } from "$lib/components/ui/button";

    // Props
    export let deviceId: string;
    export let controllerId: string;
    export let sensorId: string;
    export let duration = 60;
    export let width = 400;
    export let height = 400;

    // Types
    interface RadarPoint {
        x: number;
        y: number;
        z: number;
        velocity?: number;
    }

    interface DataFrame {
        timestamp: number;
        frameNumber?: number;
        points: RadarPoint[];
    }

    type PreviewState = "idle" | "starting" | "active" | "stopping" | "error";

    // State
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let previewState: PreviewState = "idle";
    let error: string | null = null;
    let latestFrame: DataFrame | null = null;
    let frameCount = 0;
    let sessionId: string | null = null;
    let flowId: string | null = null;
    let notificationCleanup: (() => void) | null = null;
    let statusCleanup: (() => void) | null = null;
    let expiresAt: Date | null = null;
    let timeRemaining = 0;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;

    // Radar display settings
    const RADAR_RANGE = 10; // meters
    const POINT_SIZE = 4;
    const GRID_LINES = 5;

    // Connection status from mqttClient
    let mqttStatus: UserMqttStatus = "idle";
    $: isConnected = mqttStatus === "connected";

    // Redraw when frame updates
    $: if (latestFrame && ctx) {
        drawFrame(latestFrame);
    }

    onMount(() => {
        if (canvas) {
            ctx = canvas.getContext("2d");
            drawGrid();
        }

        // Subscribe to MQTT status changes
        statusCleanup = mqttClient.onStatus((status) => {
            mqttStatus = status;
        });
    });

    onDestroy(() => {
        if (previewState === "active") {
            handleStop();
        }
        stopCountdown();
        if (statusCleanup) {
            statusCleanup();
            statusCleanup = null;
        }
    });

    function startCountdown() {
        stopCountdown();
        updateTimeRemaining();
        countdownInterval = setInterval(updateTimeRemaining, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        timeRemaining = 0;
    }

    function updateTimeRemaining() {
        if (!expiresAt) {
            timeRemaining = 0;
            return;
        }
        const remaining = Math.max(
            0,
            Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        );
        timeRemaining = remaining;

        // Auto-stop if time expired
        if (remaining <= 0 && previewState === "active") {
            handleStop();
        }
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function drawGrid() {
        if (!ctx) return;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / (RADAR_RANGE * 2);

        // Clear
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, width, height);

        // Grid circles
        ctx.strokeStyle = "rgba(100, 100, 150, 0.3)";
        ctx.lineWidth = 1;
        for (let i = 1; i <= GRID_LINES; i++) {
            const radius = (RADAR_RANGE / GRID_LINES) * i * scale;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Cross lines
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.stroke();

        // Center point
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFrame(frame: DataFrame) {
        if (!ctx) return;

        drawGrid();

        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / (RADAR_RANGE * 2);

        // Draw points
        for (const point of frame.points) {
            const x = centerX + point.x * scale;
            const y = centerY - point.y * scale; // Invert Y for screen coords

            // Color based on velocity
            const velocity = point.velocity || 0;
            const hue = velocity > 0 ? 120 : velocity < 0 ? 0 : 60; // green/red/yellow
            const saturation = Math.min(Math.abs(velocity) * 50, 100);
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, 60%)`;

            ctx.beginPath();
            ctx.arc(x, y, POINT_SIZE, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    async function handleStart() {
        if (!isConnected) {
            error = "MQTT not connected. Please wait...";
            return;
        }

        previewState = "starting";
        error = null;
        frameCount = 0;

        try {
            // Use mqttClient.request() for RPC call
            const response = await mqttClient.request(
                "sensor.preview.start",
                {
                    deviceId,
                    controllerId,
                    sensorId,
                    duration,
                },
                { timeoutMs: 10000 },
            );

            console.log(
                "[RadarPreview] Full response:",
                JSON.stringify(response, null, 2),
            );

            // RPC responses have double-nested result: response.result.result
            // flowId is at response.result.flowId
            // sessionId is at response.result.result.sessionId
            const rpcResult = response.result;
            sessionId = rpcResult?.result?.sessionId;
            flowId = rpcResult?.flowId || rpcResult?.result?.flowId;

            // Parse expiration time for countdown
            const expiresAtStr = rpcResult?.result?.expiresAt;
            if (expiresAtStr) {
                expiresAt = new Date(expiresAtStr);
                startCountdown();
            }

            console.log(
                "[RadarPreview] Started session:",
                sessionId,
                "flowId:",
                flowId,
            );

            // Subscribe to preview data notifications using mqttClient.onNotification
            notificationCleanup = mqttClient.onNotification(
                "preview.data",
                (payload: any) => {
                    // The notification structure is: { type, flowId, params: { data: { points } } }
                    // Direct publish from handler (no ticket) means payload = entire notification object
                    const params = payload.params || payload;
                    const data = params.data || params;

                    // Extract points from various possible structures
                    let points: RadarPoint[] = [];

                    if (data?.points && Array.isArray(data.points)) {
                        points = data.points;
                    } else if (Array.isArray(data)) {
                        points = data;
                    } else {
                        console.warn(
                            "[RadarPreview] No points found. payload keys:",
                            Object.keys(payload || {}),
                        );
                        console.warn("[RadarPreview] params:", params);
                        console.warn("[RadarPreview] data:", data);
                    }

                    const frame: DataFrame = {
                        timestamp: params.timestamp || Date.now(),
                        frameNumber: params.frameNumber,
                        points,
                    };
                    latestFrame = frame;
                    frameCount++;
                    console.log("[RadarPreview] Frame updated:", {
                        frameCount,
                        pointCount: points.length,
                    });
                },
            );

            previewState = "active";
        } catch (err) {
            console.error("[RadarPreview] Failed to start:", err);
            error =
                err instanceof Error ? err.message : "Failed to start preview";
            previewState = "error";
        }
    }

    async function handleStop() {
        console.log("[RadarPreview] Stopping session:", sessionId);

        if (!sessionId) {
            previewState = "idle";
            return;
        }

        previewState = "stopping";

        try {
            console.log(
                "[RadarPreview] Sending stop request for session:",
                sessionId,
            );
            await mqttClient.request(
                "sensor.preview.stop",
                { sessionId },
                { timeoutMs: 5000 },
            );
            console.log("[RadarPreview] Stop request sent");
        } catch (err) {
            console.error("[RadarPreview] Failed to stop:", err);
        }

        // Cleanup
        if (notificationCleanup) {
            notificationCleanup();
            notificationCleanup = null;
        }
        stopCountdown();
        expiresAt = null;
        sessionId = null;
        flowId = null;
        previewState = "idle";
        if (ctx) drawGrid();
    }
</script>

<div class="radar-preview">
    <div class="radar-header">
        <h3>Radar Preview</h3>
        <div
            class="status"
            class:active={previewState === "active"}
            class:error={previewState === "error"}
        >
            {#if !isConnected}
                Disconnected
            {:else if previewState === "idle"}
                Ready
            {:else if previewState === "starting"}
                Connecting...
            {:else if previewState === "active"}
                Live • {frameCount} frames
            {:else if previewState === "stopping"}
                Stopping...
            {:else if previewState === "error"}
                Error
            {/if}
        </div>
    </div>

    <div class="canvas-container">
        <canvas bind:this={canvas} {width} {height}></canvas>
    </div>

    {#if error}
        <div class="error-message">{error}</div>
    {/if}

    <div class="controls">
        {#if previewState === "idle" || previewState === "error"}
            <Button
                on:click={handleStart}
                variant="default"
                disabled={!isConnected}
            >
                {isConnected ? "Start Preview" : "Waiting for MQTT..."}
            </Button>
        {:else if previewState === "active"}
            <Button on:click={handleStop} variant="destructive">
                Stop Preview
            </Button>
        {:else}
            <Button disabled>
                {previewState === "starting" ? "Starting..." : "Stopping..."}
            </Button>
        {/if}
    </div>

    {#if previewState === "active"}
        <div class="frame-info">
            {#if latestFrame}
                Points: {latestFrame.points.length} |
            {/if}
            {#if timeRemaining > 0}
                <span class="countdown"
                    >Time left: {formatTime(timeRemaining)}</span
                >
            {:else}
                Session ending...
            {/if}
        </div>
    {/if}
</div>

<style>
    .radar-preview {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        background: var(--card, #1e1e2e);
        border-radius: 0.5rem;
        border: 1px solid var(--border, #333);
    }

    .radar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .radar-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--foreground, #fff);
    }

    .status {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        background: var(--muted, #333);
        color: var(--muted-foreground, #999);
    }

    .status.active {
        background: rgba(74, 222, 128, 0.2);
        color: #4ade80;
    }

    .status.error {
        background: rgba(248, 113, 113, 0.2);
        color: #f87171;
    }

    .canvas-container {
        display: flex;
        justify-content: center;
    }

    canvas {
        border-radius: 0.25rem;
        background: #1a1a2e;
    }

    .controls {
        display: flex;
        justify-content: center;
    }

    .error-message {
        color: #f87171;
        font-size: 0.875rem;
        text-align: center;
    }

    .frame-info {
        font-size: 0.875rem;
        color: var(--muted-foreground, #999);
        text-align: center;
    }

    .frame-info .countdown {
        font-weight: 600;
        color: var(--primary, #4ade80);
    }
</style>
