<script lang="ts">
    import {
        Breadcrumb,
        BreadcrumbItem,
        BreadcrumbList,
        BreadcrumbPage,
        BreadcrumbSeparator,
    } from "$lib/components/ui/breadcrumb";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Cable, Send, Trash2, Play, Square, Radio } from "lucide-svelte";
    import { onDestroy } from "svelte";
    import RadarVisualizer from "$lib/components/radar/RadarVisualizer.svelte";

    const RADAR_CMD_HEX = "446208001000000000000000BE4B";

    // @ts-ignore
    let port: any | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let status = "Disconnected";
    let logs = "";
    let inputMessage = "";
    let autoScroll = true;
    let logElement: HTMLTextAreaElement;

    // Radar-specific state
    let isPolling = false;
    let pollingTimer: ReturnType<typeof setTimeout> | null = null;
    let txAttemptCount = 0;
    let txOkCount = 0;
    let rxBytes = 0;
    let rxBuffer: number[] = [];
    let radarObjects: { id: number; dist: number; x: number; y: number }[] = [];

    function hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    async function connect() {
        if (port) {
            await disconnect();
            return;
        }

        try {
            // @ts-ignore
            port = await navigator.serial.requestPort();
            await port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "even",
            });
            status = "Connected";
            addLog("✅ Serial Port Opened");

            // Start reading
            readLoop();
        } catch (error: any) {
            console.error(error);
            status = `Error: ${error.message}`;
            addLog(`❌ Error: ${error.message}`);
            port = null;
        }
    }

    let isClosing = false;

    async function disconnect() {
        if (isClosing) return;
        isClosing = true;

        stopPolling();

        // Cancel the reader first - this will break the read loop
        if (reader) {
            try {
                await reader.cancel();
            } catch (e) {
                console.log("Reader cancel error:", e);
            }
            try {
                reader.releaseLock();
            } catch (e) {
                // Already released
            }
            reader = null;
        }

        // Small delay to ensure read loop has exited
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (port) {
            try {
                await port.close();
            } catch (e: any) {
                console.log("Port close error:", e);
                addLog(`⚠️ Close error: ${e.message}`);
            }
            port = null;
        }

        status = "Disconnected";
        isClosing = false;
        addLog("🔌 Disconnected");
    }

    async function readLoop() {
        while (port && port.readable && !isClosing) {
            try {
                reader = port.readable.getReader();
                while (true) {
                    const { value, done } = await reader!.read();
                    if (done || isClosing) {
                        reader!.releaseLock();
                        break;
                    }
                    if (value) {
                        onData(value);
                    }
                }
            } catch (e: any) {
                // NetworkError is expected when we cancel the reader
                if (e.name !== "NetworkError" && !isClosing) {
                    console.error("Read error:", e);
                    addLog(`❌ Read error: ${e.message}`);
                }
                break;
            } finally {
                if (reader) {
                    try {
                        reader.releaseLock();
                    } catch (e) {
                        // Already released
                    }
                    reader = null;
                }
            }
        }
    }

    function bytesToHex(bytes: number[] | Uint8Array): string {
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
            .join(" ");
    }

    // Toggle for showing raw hex data
    let showRawHex = true;

    function onData(chunk: Uint8Array) {
        rxBytes += chunk.length;

        // Log raw hex if enabled
        if (showRawHex) {
            addLog(`RX: ${bytesToHex(chunk)}`);
        }

        // Accumulate bytes
        for (let i = 0; i < chunk.length; i++) {
            rxBuffer.push(chunk[i]);
        }

        // Parse packets (End byte 0x4A)
        while (rxBuffer.length > 0) {
            const endIdx = rxBuffer.indexOf(0x4a);
            if (endIdx === -1) break;

            const packet = rxBuffer.splice(0, endIdx + 1);
            decodePacket(packet);
        }
    }

    function decodePacket(packet: number[]) {
        // Log the packet hex
        addLog(`PKT [${packet.length}]: ${bytesToHex(packet)}`);

        // Basic Validation: Header 0x4D, Min Length 14
        if (packet.length < 14 || packet[0] !== 0x4d) {
            addLog(
                `⚠️ Invalid packet: len=${packet.length}, header=0x${packet[0]?.toString(16)}`,
            );
            return;
        }

        const objectCount = packet[5];
        const objects: typeof radarObjects = [];

        if (objectCount > 0) {
            let offset = 12;
            for (let i = 0; i < objectCount; i++) {
                if (offset + 8 > packet.length) break;

                const objData = packet.slice(offset, offset + 8);
                const id = objData[0];
                const dist = objData[1] * 0.1;

                // Coordinates (signed bytes)
                const rawX = objData[6];
                const x = (rawX > 127 ? rawX - 256 : rawX) * 0.1;

                const rawY = objData[7];
                const y = (rawY > 127 ? rawY - 256 : rawY) * 0.1;

                objects.push({ id, dist, x, y });
                offset += 8;
            }
        }

        radarObjects = objects;

        if (objects.length > 0) {
            const summary = objects
                .map(
                    (o) =>
                        `ID:${o.id} D:${o.dist.toFixed(1)}m (${o.x.toFixed(1)},${o.y.toFixed(1)})`,
                )
                .join(" | ");
            addLog(`📡 ${summary}`);
        }
    }

    async function sendRadarCommand() {
        if (!port || !port.writable) return;

        txAttemptCount++;
        try {
            const writer = port.writable.getWriter();
            await writer.write(hexToBytes(RADAR_CMD_HEX));
            writer.releaseLock();
            txOkCount++;
        } catch (e: any) {
            console.error("Write error:", e);
            addLog(`❌ Write error: ${e.message}`);
        }
    }

    function startPolling() {
        if (isPolling || !port) return;

        isPolling = true;
        addLog("📡 Starting Radar Polling (200ms)...");

        const loop = async () => {
            if (!isPolling || !port) return;

            await sendRadarCommand();
            pollingTimer = setTimeout(loop, 200);
        };

        loop();
    }

    function stopPolling() {
        if (pollingTimer) {
            clearTimeout(pollingTimer);
            pollingTimer = null;
        }
        if (isPolling) {
            isPolling = false;
            addLog("⏹️ Polling stopped");
        }
    }

    // Combined start/stop sensor functions
    async function startSensor() {
        if (port) return; // Already connected

        try {
            // @ts-ignore
            port = await navigator.serial.requestPort();
            await port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "even",
            });
            status = "Connected";
            addLog("✅ Serial Port Opened");

            // Start reading
            readLoop();

            // Auto-start polling
            startPolling();
        } catch (error: any) {
            console.error(error);
            status = `Error: ${error.message}`;
            addLog(`❌ Error: ${error.message}`);
            port = null;
        }
    }

    async function stopSensor() {
        await disconnect();
    }

    async function sendManual() {
        if (!port || !port.writable || !inputMessage) return;
        try {
            const writer = port.writable.getWriter();
            const encoder = new TextEncoder();
            await writer.write(encoder.encode(inputMessage + "\n"));
            writer.releaseLock();
            addLog(`> ${inputMessage}`);
            inputMessage = "";
        } catch (e: any) {
            console.error(e);
            status = `Send Error: ${e.message}`;
        }
    }

    function addLog(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        logs += `[${timestamp}] ${message}\n`;
        if (autoScroll && logElement) {
            setTimeout(() => {
                if (logElement) logElement.scrollTop = logElement.scrollHeight;
            }, 0);
        }
    }

    function clearLogs() {
        logs = "";
        rxBytes = 0;
        txAttemptCount = 0;
        txOkCount = 0;
    }

    onDestroy(() => {
        disconnect();
    });
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a
                    href="/admin"
                    class="text-sm font-medium underline-offset-4 hover:underline"
                    >Admin</a
                >
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <a
                    href="/admin/debug"
                    class="text-sm font-medium underline-offset-4 hover:underline"
                    >Debug</a
                >
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Web Serial</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">
                Radar Sensor Debug
            </h2>
            <p class="text-muted-foreground">
                Test Web Serial API with radar sensor (9600 baud, even parity)
            </p>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Main Console (controls first for UX) -->
        <Card class="flex flex-col h-[500px]">
            <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2">
                    <Cable class="h-5 w-5" />
                    <span>Serial Console</span>
                </CardTitle>
                <CardDescription
                    >Connect to radar sensor via USB serial</CardDescription
                >
            </CardHeader>
            <CardContent class="flex-1 flex flex-col gap-3 overflow-hidden">
                <div class="flex items-center gap-2 flex-wrap">
                    <Button
                        on:click={status === "Connected"
                            ? stopSensor
                            : startSensor}
                        variant={status === "Connected"
                            ? "destructive"
                            : "default"}
                        class="min-w-[120px]"
                    >
                        {#if status === "Connected"}
                            <Square class="h-4 w-4 mr-2" />
                            Stop Sensor
                        {:else}
                            <Play class="h-4 w-4 mr-2" />
                            Start Sensor
                        {/if}
                    </Button>

                    <Button
                        variant="outline"
                        size="icon"
                        on:click={clearLogs}
                        title="Clear"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>

                    <Button
                        variant={showRawHex ? "secondary" : "outline"}
                        size="sm"
                        on:click={() => (showRawHex = !showRawHex)}
                    >
                        {showRawHex ? "Raw: ON" : "Raw: OFF"}
                    </Button>

                    <span
                        class="text-xs font-medium border px-2 py-1 rounded bg-muted/50 ml-auto"
                    >
                        {status} | TX:{txOkCount} RX:{rxBytes}b | Obj:{radarObjects.length}
                    </span>
                </div>

                <div
                    class="flex-1 min-h-0 border rounded-md bg-black text-green-400 font-mono text-xs"
                >
                    <textarea
                        bind:this={logElement}
                        bind:value={logs}
                        readonly
                        class="w-full h-full bg-transparent border-none resize-none p-2 focus:outline-none"
                    ></textarea>
                </div>

                <div class="flex gap-2">
                    <Input
                        bind:value={inputMessage}
                        placeholder="Send command..."
                        on:keydown={(e) => e.key === "Enter" && sendManual()}
                        disabled={status !== "Connected"}
                        class="text-sm"
                    />
                    <Button
                        on:click={sendManual}
                        disabled={status !== "Connected"}
                        size="sm"
                    >
                        <Send class="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- 3D Visualizer -->
        <Card class="flex flex-col h-[500px]">
            <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2">
                    <Radio class="h-5 w-5" />
                    <span>3D Radar View</span>
                </CardTitle>
            </CardHeader>
            <CardContent class="flex-1 p-0 overflow-hidden">
                <RadarVisualizer {radarObjects} />
            </CardContent>
        </Card>
    </div>
</div>
