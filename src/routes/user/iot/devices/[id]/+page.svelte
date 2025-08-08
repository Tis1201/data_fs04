<script lang="ts">
    import {goto} from "$app/navigation";
    import {superForm} from "sveltekit-superforms/client";
    import {toast} from "svelte-sonner";
    import {writable} from "svelte/store";
    import {sseStore} from "$lib/stores/sse-store";
    import {Button} from "$lib/components/ui/button";
    import {Badge} from "$lib/components/ui/badge";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import SecureKeyDisplay from "$lib/components/ui_components_sveltekit/display/SecureKeyDisplay.svelte";
    import {
        ArrowLeft,
        Camera,
        Clock,
        Cpu,
        Edit,
        FileText,
        Info,
        Key,
        Loader2,
        Radar,
        RefreshCw,
        RotateCcw,
        Server,
        Settings,
        Shield,
        Tag,
        Terminal,
        Wifi,
    } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import {CompactInfoGrid, CompactInfoItem,} from "$lib/components/ui_components_sveltekit/layout";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type {PageData} from "./$types";

    export let data: PageData;
    const { device, form } = data;

    // Setup the form for API key generation
    const {
        form: apiKeyForm,
        enhance: apiKeyEnhance,
        submitting: apiKeySubmitting,
    } = superForm(data.form, {
        id: "api-key-form",
        resetForm: false,
        taintedMessage: null,
        onSubmit: ({ action }) => {
            console.log("Form submission started, action:", action);
            // Only handle the generateApiKey action
            if (action?.toString() !== "?/generateApiKey") {
                return;
            }
        },
        onResult: ({ result }) => {
            console.log("Form result received:", result);
            if (result.type === "success") {
                toast.success("API key generated successfully");
                // Refresh the page to show the new API key
                goto(`/user/iot/devices/${device.id}`, {
                    invalidateAll: true,
                });
            } else if (result.type === "failure") {
                toast.error(result.data?.error || "Failed to generate API key");
            }
        },
        onError: (error) => {
            console.error("Form error:", error);
            toast.error("An error occurred while generating API key");
        },
    });

    // Helper functions for status and connection colors
    function getStatusColor(status: string) {
        switch (status) {
            case "ACTIVE":
                return "bg-green-500/20 text-green-700 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/25";
            case "INACTIVE":
                return "bg-gray-500/20 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 hover:bg-gray-500/25";
            case "PENDING":
                return "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 hover:bg-yellow-500/25";
            case "DISABLED":
                return "bg-red-500/20 text-red-700 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/25";
            default:
                return "bg-gray-500/20 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 hover:bg-gray-500/25";
        }
    }

    function getConnectionColor(connected: boolean) {
        return connected
            ? "bg-green-500/20 text-green-700 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/25"
            : "bg-red-500/20 text-red-700 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/25";
    }
    const title = device.name || "Device Details";

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Home", "/user"],
        ["IoT", "/user/iot"],
        ["Devices", "/user/iot/devices"],
        [device.name || "Device", ""],
    ];

    // State management
    const activeTab = writable("overview");
    const isLoading = writable(false);
    const actionStatus = writable({ action: "", status: "", message: "" });

    // Format connection status
    function getConnectionStatusBadge(connected: boolean) {
        return connected
            ? { label: "Connected", variant: "success" as const }
            : { label: "Disconnected", variant: "destructive" as const };
    }

    const connectionStatus = getConnectionStatusBadge(device.connected);

    // View device logs
    async function viewLogs() {
        isLoading.set(true);
        actionStatus.set({
            action: "logs",
            status: "loading",
            message: "Fetching device logs...",
        });

        try {
            // Navigate to the logs page
            goto(`/user/iot/devices/${device.id}/logs`);
        } catch (error) {
            actionStatus.set({
                action: "logs",
                status: "error",
                message: "Failed to fetch device logs. Please try again.",
            });
            console.error("Error fetching logs:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // Navigate to edit page
    function navigateToEdit() {
        goto(`/user/iot/devices/${device.id}/edit`);
    }

    // Ping device
    async function pingDevice() {
        isLoading.set(true);
        actionStatus.set({
            action: "monitor",
            status: "loading",
            message: "Pinging device...",
        });

        try {
            // Instead of manually generating requestId & timestamp,
            // call socketStore.sendRequest({ type, scope, payload }, timeoutMs).
            const responsePayload = await sseStore.sendRequest(
                {
                    type: "device",
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: "message",
                        type: "ping",
                        deviceId: device.id,
                    },
                },
                5000,
                'device-ping'
            );

            console.log("responsePayload", responsePayload);

            // If we get here, the device replied before timeout
            actionStatus.set({
                action: "monitor",
                status: "success",
                message: "Ping succeeded!",
            });
            toast.success("Device replied to ping.");
        } catch (error) {
            // If sendRequest() rejected (timeout or other error), we land here
            actionStatus.set({
                action: "monitor",
                status: "error",
                message: error instanceof Error ? error.message : "Ping failed",
            });
            toast.error("Failed to ping device.");
            console.error("Error pinging device:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // Take screenshot
    async function retrieveSnapshot() {
        isLoading.set(true);
        actionStatus.set({
            action: "snapshot",
            status: "loading",
            message: "Taking screenshot...",
        });

        try {
            // Call the screenshot handler on the device
            const responsePayload = await sseStore.sendRequest(
                {
                    type: "device",
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: "message",
                        type: "screenshot:request",
                        deviceId: device.id,
                        quality: 120, // JPEG quality (1-100)
                    },
                },
                10000, // Screenshots might take longer than pings
                'device-screenshot'
            );

            console.log("Screenshot response:", responsePayload);

            // Check for explicit device error first
            const payloadType = responsePayload?.payload?.type;
            if (payloadType === 'screenshot:error') {
                const errMsg = responsePayload?.payload?.error || 'Device reported screenshot error';
                throw new Error(errMsg);
            }

            // Try multiple shapes for image + format
            const imageData = responsePayload?.image
                || responsePayload?.payload?.image
                || responsePayload?.data?.image;
            const format = responsePayload?.format
                || responsePayload?.payload?.format
                || responsePayload?.data?.format
                || 'jpeg';

            if (imageData) {

                // Create an image element to display the screenshot
                const img = document.createElement("img");
                img.src = `data:image/${format};base64,${imageData}`;
                img.style.maxWidth = "100%";
                img.style.height = "auto";
                img.style.borderRadius = "8px";
                img.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";

                // Create a modal to display the image
                const modal = document.createElement("div");
                modal.style.position = "fixed";
                modal.style.top = "0";
                modal.style.left = "0";
                modal.style.width = "100%";
                modal.style.height = "100%";
                modal.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
                modal.style.display = "flex";
                modal.style.justifyContent = "center";
                modal.style.alignItems = "center";
                modal.style.zIndex = "9999";
                modal.style.padding = "20px";

                // Create a container for the image
                const container = document.createElement("div");
                container.style.position = "relative";
                container.style.maxWidth = "90%";
                container.style.maxHeight = "90%";
                container.style.overflow = "auto";
                container.style.backgroundColor = "white";
                container.style.borderRadius = "8px";
                container.style.padding = "20px";

                // Create a close button
                const closeButton = document.createElement("button");
                closeButton.textContent = "×";
                closeButton.style.position = "absolute";
                closeButton.style.top = "10px";
                closeButton.style.right = "10px";
                closeButton.style.fontSize = "24px";
                closeButton.style.fontWeight = "bold";
                closeButton.style.border = "none";
                closeButton.style.background = "none";
                closeButton.style.cursor = "pointer";
                closeButton.style.color = "#333";
                closeButton.onclick = () => document.body.removeChild(modal);

                // Add elements to the DOM
                container.appendChild(img);
                container.appendChild(closeButton);
                modal.appendChild(container);
                document.body.appendChild(modal);

                // Close modal when clicking outside the image
                modal.addEventListener("click", (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });

                actionStatus.set({
                    action: "snapshot",
                    status: "success",
                    message: "Screenshot captured",
                });
                toast.success("Device screenshot captured successfully");
            } else {
                throw new Error("No image data received from device");
            }
        } catch (error) {
            actionStatus.set({
                action: "snapshot",
                status: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to capture screenshot",
            });
            toast.error("Failed to capture device screenshot");
            console.error("Error capturing screenshot:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // Restart app
    async function restartApp() {
        isLoading.set(true);
        actionStatus.set({
            action: "restart",
            status: "loading",
            message: "Restarting app...",
        });

        try {
            // Simulate app restart
            await new Promise((resolve) => setTimeout(resolve, 1500));

            actionStatus.set({
                action: "restart",
                status: "success",
                message: "App restart initiated",
            });
            toast.success("App restart initiated successfully");
        } catch (error) {
            actionStatus.set({
                action: "restart",
                status: "error",
                message: "Failed to restart app",
            });
            toast.error("Failed to restart app");
            console.error("Error restarting app:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // View device camera
    async function viewCamera() {
        isLoading.set(true);
        actionStatus.set({
            action: "camera",
            status: "loading",
            message: "Connecting to camera...",
        });

        try {
            // Navigate to the camera page
            goto(`/user/iot/devices/${device.id}/camera`);
        } catch (error) {
            actionStatus.set({
                action: "camera",
                status: "error",
                message: "Failed to connect to camera. Please try again.",
            });
            console.error("Error connecting to camera:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // View device monitor
    async function viewMonitor() {
        isLoading.set(true);
        actionStatus.set({
            action: "monitor",
            status: "loading",
            message: "Loading device monitor...",
        });

        try {
            // Navigate to the monitor page
            goto(`/user/iot/devices/${device.id}/monitor`);
        } catch (error) {
            actionStatus.set({
                action: "monitor",
                status: "error",
                message: "Failed to load device monitor. Please try again.",
            });
            console.error("Error loading monitor:", error);
        } finally {
            isLoading.set(false);
        }
    }
</script>

<UserPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Edit Device",
            icon: Edit,
            onClick: navigateToEdit,
            variant: "default",
        },
        {
            label: "Back to Devices",
            href: "/user/iot/devices",
            icon: ArrowLeft,
            variant: "outline",
        },
    ]}
>
    <!-- Device Action Buttons -->
    <UserCard
        title="Device Actions"
        description="Interact with this device"
        icon={Settings}
        compact={true}
        class_name="mb-4"
    >
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
            <!-- Monitor Button -->
            <Button
                variant="outline"
                class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                on:click={pingDevice}
                disabled={$isLoading && $actionStatus.action === "monitor"}
            >
                {#if $isLoading && $actionStatus.action === "monitor"}
                    <Loader2 class="h-5 w-5 animate-spin" />
                {:else}
                    <Radar class="h-5 w-5" />
                {/if}
                <span class="text-xs">Ping</span>
            </Button>

            <!-- Screenshot Button -->
            <Button
                variant="outline"
                class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                on:click={retrieveSnapshot}
                disabled={$isLoading && $actionStatus.action === "snapshot"}
            >
                {#if $isLoading && $actionStatus.action === "snapshot"}
                    <Loader2 class="h-5 w-5 animate-spin" />
                {:else}
                    <Camera class="h-5 w-5" />
                {/if}
                <span class="text-xs">Screenshot</span>
            </Button>

            <!-- Terminal Button -->
            <Button
                    variant="outline"
                    class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                    on:click={retrieveSnapshot}
                    disabled={$isLoading && $actionStatus.action === "terminal"}
            >
                {#if $isLoading && $actionStatus.action === "terminal"}
                    <Loader2 class="h-5 w-5 animate-spin" />
                {:else}
                    <Terminal class="h-5 w-5" />
                {/if}
                <span class="text-xs">Terminal</span>
            </Button>

            <!-- Restart App Button -->
            <Button
                variant="outline"
                class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                on:click={restartApp}
                disabled={$isLoading && $actionStatus.action === "restart"}
            >
                {#if $isLoading && $actionStatus.action === "restart"}
                    <Loader2 class="h-5 w-5 animate-spin" />
                {:else}
                    <RotateCcw class="h-5 w-5" />
                {/if}
                <span class="text-xs">Restart App</span>
            </Button>

            <!-- Logs Button -->
            <Button
                variant="outline"
                class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                on:click={viewLogs}
                disabled={$isLoading && $actionStatus.action === "logs"}
            >
                {#if $isLoading && $actionStatus.action === "logs"}
                    <Loader2 class="h-5 w-5 animate-spin" />
                {:else}
                    <FileText class="h-5 w-5" />
                {/if}
                <span class="text-xs">View Logs</span>
            </Button>
        </div>

        <!-- Status message for actions -->
        {#if $actionStatus.status}
            <div
                class="mt-4 p-3 rounded-md text-sm flex items-center"
                class:bg-muted={$actionStatus.status === "loading"}
                class:bg-green-50={$actionStatus.status === "success"}
                class:bg-red-50={$actionStatus.status === "error"}
            >
                {#if $actionStatus.status === "loading"}
                    <Clock
                        class="mr-2 h-4 w-4 animate-spin text-muted-foreground"
                    />
                {:else if $actionStatus.status === "success"}
                    <div class="mr-2 h-4 w-4 text-green-500">✓</div>
                {:else if $actionStatus.status === "error"}
                    <div class="mr-2 h-4 w-4 text-red-500">⚠</div>
                {/if}
                <span
                    class:text-muted-foreground={$actionStatus.status ===
                        "loading"}
                    class:text-green-700={$actionStatus.status === "success"}
                    class:text-red-700={$actionStatus.status === "error"}
                >
                    {$actionStatus.message}
                </span>
            </div>
        {/if}
    </UserCard>

    <!-- Device Overview with metadata footer -->
    <UserCard
        title="Device Overview"
        description="Basic information and status"
        icon={Info}
        compact={true}
        class_name="mb-4"
    >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Status and Connection -->
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-sm font-medium mb-1">Status</div>
                        <Badge class={getStatusColor(device.status)}
                            >{device.status || "Unknown"}</Badge
                        >
                    </div>
                    <div>
                        <div class="text-sm font-medium mb-1">Connection</div>
                        <Badge class={getConnectionColor(device.connected)}>
                            {device.connected ? "Connected" : "Disconnected"}
                        </Badge>
                    </div>
                </div>

                <!-- Description -->
                <div>
                    <div class="text-sm font-medium mb-1">Description</div>
                    <div class="text-sm text-muted-foreground">
                        {device.description || "No description provided"}
                    </div>
                </div>

                <!-- Connected/Last Seen Info -->
                {#if device.connectedAt && device.connected}
                    <div>
                        <div class="text-sm font-medium mb-1">
                            Connected Since
                        </div>
                        <div class="text-sm text-muted-foreground">
                            <RelativeDate date={device.connectedAt} />
                        </div>
                    </div>
                {:else if device.disconnectedAt && !device.connected}
                    <div>
                        <div class="text-sm font-medium mb-1">Last Seen</div>
                        <div class="text-sm text-muted-foreground">
                            <RelativeDate date={device.disconnectedAt} />
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Basic Device Info -->
            <div>
                <CompactInfoGrid columns={1} gap="gap-4">
                    <CompactInfoItem label="Name" icon={Tag}>
                        <div class="text-sm">{device.name || "N/A"}</div>
                    </CompactInfoItem>

                    <CompactInfoItem label="Model" icon={Cpu}>
                        <div class="text-sm">{device.model || "N/A"}</div>
                    </CompactInfoItem>

                    <CompactInfoItem label="Manufacturer" icon={Server}>
                        <div class="text-sm">
                            {device.manufacturer || "N/A"}
                        </div>
                    </CompactInfoItem>
                </CompactInfoGrid>
            </div>
        </div>

        <svelte:fragment slot="footer">
            <MetadataFooter
                items={[
                    {
                        label: "Created",
                        date: device.createdAt,
                        icon: "calendar",
                    },
                    {
                        label: "Created By",
                        value: device.user?.name || "Unknown",
                        icon: "user",
                    },
                    {
                        label: "Account",
                        value: device.account?.name || "None",
                        icon: "tag",
                    },
                    {
                        label: "Last Updated",
                        date: device.updatedAt,
                        icon: "clock",
                    },
                ]}
            />
        </svelte:fragment>
    </UserCard>

    <UserCard
        title="Device Security"
        description="Manage API key for device authentication"
        icon={Shield}
        compact={true}
        class_name="mb-4"
    >
        <div class="space-y-4">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <div class="font-medium flex items-center text-sm">
                        <Key class="mr-1.5 h-3.5 w-3.5" />
                        API Key
                    </div>
                    <form
                        id="api-key-form"
                        action="?/generateApiKey"
                        method="POST"
                        use:apiKeyEnhance
                    >
                        <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={$apiKeySubmitting}
                            class="flex items-center"
                        >
                            <RefreshCw class="mr-2 h-3 w-3" />
                            {$apiKeySubmitting
                                ? "Generating..."
                                : "Generate New Key"}
                        </Button>
                    </form>
                </div>

                <SecureKeyDisplay
                    apiKey={device.apiKey || ""}
                    createdAt={device.apiKeyCreatedAt}
                    rotatedAt={device.apiKeyRotatedAt}
                    loading={$apiKeySubmitting}
                />
            </div>
        </div>
    </UserCard>

    <!-- Technical Details Card -->
    <div class="grid grid-cols-1 gap-4">
        <UserCard
            title="Technical Details"
            description="Hardware and software information"
            icon={Shield}
            compact={true}
        >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Hardware Details -->
                <div>
                    <h3 class="text-sm font-medium mb-3">Hardware</h3>
                    <CompactInfoGrid columns={1} gap="gap-4">
                        <CompactInfoItem label="Hardware ID" icon={Shield}>
                            <div class="text-sm font-mono text-xs">
                                {device.hardwareId || "N/A"}
                            </div>
                        </CompactInfoItem>

                        {#if device.deviceType}
                            <CompactInfoItem label="Device Type" icon={Tag}>
                                <div class="text-sm">{device.deviceType}</div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.wifiMac}
                            <CompactInfoItem label="WiFi MAC" icon={Wifi}>
                                <div class="text-sm font-mono text-xs">
                                    {device.wifiMac}
                                </div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.lanMac}
                            <CompactInfoItem label="LAN MAC" icon={Wifi}>
                                <div class="text-sm font-mono text-xs">
                                    {device.lanMac}
                                </div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.ipAddress}
                            <CompactInfoItem label="IP Address" icon={Wifi}>
                                <div class="text-sm font-mono text-xs">
                                    {device.ipAddress}
                                </div>
                            </CompactInfoItem>
                        {/if}
                    </CompactInfoGrid>
                </div>

                <!-- Software Details -->
                <div>
                    <h3 class="text-sm font-medium mb-3">Software</h3>
                    <CompactInfoGrid columns={1} gap="gap-4">
                        {#if device.osVersion}
                            <CompactInfoItem label="OS Version" icon={Server}>
                                <div class="text-sm">{device.osVersion}</div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.firmwareVersion}
                            <CompactInfoItem
                                label="Firmware Version"
                                icon={Cpu}
                            >
                                <div class="text-sm">
                                    {device.firmwareVersion}
                                </div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.lastUsedAt}
                            <CompactInfoItem label="Last Activity" icon={Clock}>
                                <div class="text-sm">
                                    <RelativeDate date={device.lastUsedAt} />
                                </div>
                            </CompactInfoItem>
                        {/if}

                        {#if device.lastSeen}
                            <CompactInfoItem label="Last Seen" icon={Clock}>
                                <div class="text-sm">
                                    <RelativeDate date={device.lastSeen} />
                                </div>
                            </CompactInfoItem>
                        {/if}
                    </CompactInfoGrid>
                </div>
            </div>
        </UserCard>
    </div>

    <!-- Status message for actions -->
    <!-- Status message is already displayed in the device actions section -->
    <!-- Removed duplicate status message that was here -->
</UserPageLayout>
