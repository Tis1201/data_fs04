<script lang="ts">
    import {
        Save,
        MapPin,
        Grid3x3,
        Eye,
        Plus,
        Pencil,
        Trash,
        X,
        Upload,
        CheckCircle2,
        AlertCircle,
        Clock,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Badge } from "$lib/components/ui/badge";
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle,
        DialogFooter,
    } from "$lib/components/ui/dialog";
    import {
        Tabs,
        TabsContent,
        TabsList,
        TabsTrigger,
    } from "$lib/components/ui/tabs";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import RadarVisualEditor from "$lib/components/ui_components_sveltekit/radar/RadarVisualEditor.svelte";
    import { mqttStore } from "$lib/stores/mqtt-store";

    // Props from parent
    export let open = false;
    export let config: any;
    export let sensorName: string;

    // Sensor info for MQTT operations
    export let sensorId: string = "";
    export let syncStatus: string = "SYNCED";
    export let isDeviceOnline: boolean = false;

    // Form Data Bindings (from SuperForms stores)
    export let trackingAreaForm: any;
    export let zoneForm: any;
    export let dwellBucketForm: any;

    // Form States (submitting, errors, enhance)
    export let formStates: {
        trackingArea: { submitting: boolean; errors: any; enhance: any };
        zone: { submitting: boolean; errors: any; enhance: any };
        dwellBucket: { submitting: boolean; errors: any; enhance: any };
    };

    // Visual Editor State
    export let editorArena: any;
    export let editorZones: any[];

    // Internal state
    let activeTab = "visual";
    let showZoneDialog = false;
    let editingZoneId: string | null = null;
    let zoneDialogForm = {
        name: "",
        zoneNumber: 1,
        color: "#10b981",
        description: "",
    };
    let isPushing = false;

    // Subscribe to MQTT status
    $: mqttStatus = $mqttStore.status;
    $: isMqttConnected = mqttStatus === "OPEN";

    // Dispatch events
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    // Push config to device via MQTT RPC
    async function handlePushToDevice() {
        const userSub = mqttStore.subject;
        if (!sensorId || !isMqttConnected || !userSub) {
            toast.error("Not connected to MQTT");
            return;
        }

        isPushing = true;
        try {
            const requestId = crypto.randomUUID();
            const requestPayload = {
                op: "sensor.config.push",
                params: { sensorId },
                requestId,
                timestamp: new Date().toISOString(),
            };

            // Set up response listener
            const responsePromise = new Promise<any>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error("Request timed out"));
                }, 10000);

                const cleanup = mqttStore.on(
                    `user/${userSub}/response`,
                    (msg) => {
                        const payload = msg.payload as any;
                        if (payload?.requestId === requestId) {
                            clearTimeout(timeout);
                            cleanup();
                            resolve(payload);
                        }
                    },
                );
            });

            // Publish the request
            await mqttStore.publish(
                `user/${userSub}/requests`,
                requestPayload,
                { qos: 1 },
            );

            // Wait for response
            const response = await responsePromise;
            const result = response.result?.result || response.result;

            if (result?.synced) {
                toast.success("Config pushed to device!");
                syncStatus = "SYNCED";
                dispatch("synced");
            } else {
                toast.error(result?.error || "Push failed");
                syncStatus = "FAILED";
                syncStatus = "FAILED";
            }
        } catch (err: any) {
            toast.error(err.message || "Push failed");
            syncStatus = "FAILED";
        } finally {
            isPushing = false;
        }
    }

    function handleArenaChange(event: any) {
        editorArena = event.detail;
        // Sync to form
        if (trackingAreaForm) {
            // We update the bound prop directly.
            // Note: Since trackingAreaForm is likely a store value ($trackingAreaForm),
            // updating it here via assignment works if it's an object, but better to update properties.
            trackingAreaForm.startX = event.detail.startX;
            trackingAreaForm.startY = event.detail.startY;
            trackingAreaForm.endX = event.detail.endX;
            trackingAreaForm.endY = event.detail.endY;
        }
    }

    function handleZonesChange(event: any) {
        editorZones = event.detail;
        dispatch("zonesChange", event.detail);
    }

    // Zone Dialog Logic
    $: nextZoneNumber = config?.zones
        ? Math.max(0, ...config.zones.map((z: any) => z.zoneNumber)) + 1
        : 1;

    const COLORS = {
        zonePalette: [
            "#ef4444",
            "#f97316",
            "#f59e0b",
            "#84cc16",
            "#10b981",
            "#06b6d4",
            "#3b82f6",
            "#8b5cf6",
            "#d946ef",
        ],
    };

    function openCreateZone() {
        editingZoneId = null;
        zoneDialogForm = {
            name: "",
            zoneNumber: nextZoneNumber,
            color:
                COLORS.zonePalette[
                    nextZoneNumber % COLORS.zonePalette.length
                ] || "#10b981",
            description: "",
        };
        showZoneDialog = true;
    }

    function openEditZone(zone: any) {
        editingZoneId = zone.id;
        zoneDialogForm = {
            name: zone.name,
            zoneNumber: zone.zoneNumber,
            color: zone.color || "#10b981",
            description: zone.description || "",
        };
        showZoneDialog = true;
    }

    // We need to proxy the delete actions up
    export let onDeleteZone: (id: string, name: string) => void;
    export let onDeleteDwellBucket: (id: string, name: string) => void;
    export let onSaveLayout: (data: { arena: any; zones: any[] }) => void; // Explicit save layout action with data
</script>

<Dialog bind:open>
    <DialogContent class="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
        <!-- Header -->
        <div
            class="px-6 py-4 border-b flex items-center justify-between bg-muted/20"
        >
            <div class="flex items-center gap-3">
                <div>
                    <DialogTitle>Configure Sensor: {sensorName}</DialogTitle>
                    <DialogDescription
                        >Manage tracking area, zones, and dwell buckets.</DialogDescription
                    >
                </div>
                <!-- Sync Status Badge -->
                {#if syncStatus === "SYNCED"}
                    <Badge
                        variant="outline"
                        class="bg-green-100 text-green-700 border-green-300"
                    >
                        <CheckCircle2 class="h-3 w-3 mr-1" /> Synced
                    </Badge>
                {:else if syncStatus === "PENDING"}
                    <Badge
                        variant="outline"
                        class="bg-yellow-100 text-yellow-700 border-yellow-300"
                    >
                        <Clock class="h-3 w-3 mr-1" /> Pending
                    </Badge>
                {:else if syncStatus === "FAILED"}
                    <Badge
                        variant="outline"
                        class="bg-red-100 text-red-700 border-red-300"
                    >
                        <AlertCircle class="h-3 w-3 mr-1" /> Failed
                    </Badge>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Button variant="outline" on:click={() => (open = false)}
                    >Close</Button
                >
                <Button
                    on:click={() =>
                        onSaveLayout({
                            arena: editorArena,
                            zones: editorZones,
                        })}
                >
                    <Save class="h-4 w-4 mr-2" /> Save Layout
                </Button>
                <Button
                    variant="default"
                    class="bg-blue-600 hover:bg-blue-700"
                    on:click={handlePushToDevice}
                    disabled={isPushing || !sensorId}
                    title={!isDeviceOnline
                        ? "Device is offline (debug enabled)"
                        : "Push config to device"}
                >
                    <Upload class="h-4 w-4 mr-2" />
                    {isPushing ? "Pushing..." : "Push to Device"}
                </Button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 overflow-auto p-6 bg-background">
            <Tabs bind:value={activeTab} class="w-full h-full flex flex-col">
                <TabsList class="mb-6 w-fit">
                    <TabsTrigger value="visual"
                        ><Eye class="h-4 w-4 mr-2" /> Visual Editor</TabsTrigger
                    >
                    <TabsTrigger value="tracking"
                        ><MapPin class="h-4 w-4 mr-2" /> Tracking Area</TabsTrigger
                    >
                    <TabsTrigger value="zones"
                        ><Grid3x3 class="h-4 w-4 mr-2" /> Zones List</TabsTrigger
                    >
                    <TabsTrigger value="dwell"
                        ><div
                            class="h-4 w-4 mr-2 flex items-center justify-center font-bold text-xs"
                        >
                            DB
                        </div>
                        Dwell Buckets</TabsTrigger
                    >
                </TabsList>

                <!-- Visual Editor Tab -->
                <TabsContent
                    value="visual"
                    class="flex-1 min-h-[500px] border rounded-lg bg-slate-50 relative overflow-hidden"
                >
                    <RadarVisualEditor
                        arena={editorArena}
                        zones={editorZones}
                        maxZones={5}
                        on:arenaChange={handleArenaChange}
                        on:zonesChange={handleZonesChange}
                    />
                    <div
                        class="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur px-4 py-2 rounded-md border text-xs text-muted-foreground shadow-sm pointer-events-none"
                    >
                        Visual changes to Arena and Zones are local. Click <strong
                            >Save Layout</strong
                        > to persist them.
                    </div>
                </TabsContent>

                <!-- Tracking Area Form Tab -->
                <TabsContent value="tracking" class="max-w-2xl">
                    <div class="border rounded-lg p-6">
                        <h3 class="text-lg font-medium mb-4">
                            Tracking Area Configuration
                        </h3>
                        <FormContainer
                            method="POST"
                            action={config?.trackingArea
                                ? "?/updateTrackingArea"
                                : "?/createTrackingArea"}
                            enhance={formStates.trackingArea.enhance}
                            novalidate
                        >
                            <FormRow columns={2}>
                                <FormField
                                    id="ta_name"
                                    label="Area Name"
                                    error={formStates.trackingArea.errors.name}
                                    required
                                >
                                    <Input
                                        name="name"
                                        bind:value={trackingAreaForm.name}
                                        placeholder="e.g. Main Hall"
                                    />
                                </FormField>
                            </FormRow>

                            <div class="bg-muted/30 p-4 rounded mt-4">
                                <h4 class="text-sm font-semibold mb-3">
                                    Dimensions (Meters)
                                </h4>
                                <FormRow columns={2}>
                                    <FormField
                                        id="ta_startX"
                                        label="Start X"
                                        error={formStates.trackingArea.errors
                                            .startX}
                                        required
                                    >
                                        <Input
                                            name="startX"
                                            type="number"
                                            step="0.1"
                                            bind:value={trackingAreaForm.startX}
                                        />
                                    </FormField>
                                    <FormField
                                        id="ta_startY"
                                        label="Start Y"
                                        error={formStates.trackingArea.errors
                                            .startY}
                                        required
                                    >
                                        <Input
                                            name="startY"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            bind:value={trackingAreaForm.startY}
                                        />
                                    </FormField>
                                </FormRow>
                                <FormRow columns={2}>
                                    <FormField
                                        id="ta_endX"
                                        label="End X"
                                        error={formStates.trackingArea.errors
                                            .endX}
                                        required
                                    >
                                        <Input
                                            name="endX"
                                            type="number"
                                            step="0.1"
                                            bind:value={trackingAreaForm.endX}
                                        />
                                    </FormField>
                                    <FormField
                                        id="ta_endY"
                                        label="End Y"
                                        error={formStates.trackingArea.errors
                                            .endY}
                                        required
                                    >
                                        <Input
                                            name="endY"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            bind:value={trackingAreaForm.endY}
                                        />
                                    </FormField>
                                </FormRow>
                            </div>
                            <div class="mt-4 flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={formStates.trackingArea
                                        .submitting}
                                >
                                    {formStates.trackingArea.submitting
                                        ? "Saving..."
                                        : "Save Area Configuration"}
                                </Button>
                            </div>
                        </FormContainer>
                    </div>
                </TabsContent>

                <!-- Zones List Tab -->
                <TabsContent value="zones">
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {#if !config?.trackingArea}
                            <div
                                class="col-span-full text-center py-10 text-muted-foreground"
                            >
                                Configure Tracking Area first.
                            </div>
                        {:else if !config?.zones?.length}
                            <div
                                class="col-span-full text-center py-10 border-2 border-dashed rounded-lg"
                            >
                                <p class="mb-4">No zones configured.</p>
                                <Button on:click={openCreateZone}
                                    ><Plus class="h-4 w-4 mr-2" /> Add Zone</Button
                                >
                            </div>
                        {:else}
                            {#each config.zones as zone}
                                <div
                                    class="border rounded-lg p-4 bg-card shadow-sm flex flex-col justify-between"
                                >
                                    <div>
                                        <div
                                            class="flex items-center justify-between mb-2"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span
                                                    class="w-3 h-3 rounded-full"
                                                    style="background-color: {zone.color ||
                                                        '#10b981'}"
                                                ></span>
                                                <span class="font-medium"
                                                    >{zone.name}</span
                                                >
                                            </div>
                                            <Badge variant="outline"
                                                >#{zone.zoneNumber}</Badge
                                            >
                                        </div>
                                        <p
                                            class="text-xs text-muted-foreground"
                                        >
                                            ({zone.startX},{zone.startY}) → ({zone.endX},{zone.endY})
                                        </p>
                                    </div>
                                    <div
                                        class="flex justify-end gap-2 mt-4 pt-2 border-t"
                                    >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            on:click={() => openEditZone(zone)}
                                            ><Pencil class="h-4 w-4" /></Button
                                        >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="text-destructive"
                                            on:click={() =>
                                                onDeleteZone(
                                                    zone.id,
                                                    zone.name,
                                                )}
                                            ><Trash class="h-4 w-4" /></Button
                                        >
                                    </div>
                                </div>
                            {/each}
                            {#if config.zones.length < 5}
                                <button
                                    class="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:border-primary transition-colors"
                                    on:click={openCreateZone}
                                >
                                    <Plus class="h-8 w-8 mb-2" />
                                    <span>Add Zone</span>
                                </button>
                            {/if}
                        {/if}
                    </div>
                </TabsContent>

                <!-- Dwell Buckets Tab -->
                <TabsContent value="dwell" class="max-w-2xl">
                    <div class="space-y-6">
                        <!-- List -->
                        <div class="border rounded-lg divide-y">
                            <div class="p-4 font-medium bg-muted/20">
                                Configured Buckets
                            </div>
                            {#if !config?.dwellBuckets?.length}
                                <div
                                    class="p-8 text-center text-muted-foreground"
                                >
                                    No dwell buckets defined.
                                </div>
                            {:else}
                                {#each config.dwellBuckets as bucket}
                                    <div
                                        class="p-4 flex items-center justify-between"
                                    >
                                        <div>
                                            <p class="font-medium">
                                                {bucket.name}
                                            </p>
                                            <p
                                                class="text-xs text-muted-foreground"
                                            >
                                                {bucket.minDuration}s - {bucket.maxDuration
                                                    ? bucket.maxDuration + "s"
                                                    : "∞"}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="text-destructive"
                                            on:click={() =>
                                                onDeleteDwellBucket(
                                                    bucket.id,
                                                    bucket.name,
                                                )}
                                            ><Trash class="h-4 w-4" /></Button
                                        >
                                    </div>
                                {/each}
                            {/if}
                        </div>

                        <!-- Create Form -->
                        <div class="border rounded-lg p-6">
                            <h4 class="font-medium mb-4">Add New Bucket</h4>
                            <FormContainer
                                method="POST"
                                action="?/createDwellBucket"
                                enhance={formStates.dwellBucket.enhance}
                                novalidate
                            >
                                <FormRow columns={2}>
                                    <FormField
                                        id="db_name"
                                        label="Name"
                                        error={formStates.dwellBucket.errors
                                            .name}
                                        required
                                    >
                                        <Input
                                            name="name"
                                            bind:value={dwellBucketForm.name}
                                            placeholder="e.g. Browsing"
                                        />
                                    </FormField>
                                    <FormField
                                        id="db_color"
                                        label="Color"
                                        error={formStates.dwellBucket.errors
                                            .color}
                                    >
                                        <Input
                                            name="color"
                                            type="color"
                                            bind:value={dwellBucketForm.color}
                                            class="h-10 w-full"
                                        />
                                    </FormField>
                                </FormRow>
                                <FormRow columns={2}>
                                    <FormField
                                        id="db_min"
                                        label="Min Duration (s)"
                                        error={formStates.dwellBucket.errors
                                            .minDuration}
                                        required
                                    >
                                        <Input
                                            name="minDuration"
                                            type="number"
                                            min="0"
                                            bind:value={
                                                dwellBucketForm.minDuration
                                            }
                                        />
                                    </FormField>
                                    <FormField
                                        id="db_max"
                                        label="Max Duration (s)"
                                        error={formStates.dwellBucket.errors
                                            .maxDuration}
                                    >
                                        <Input
                                            name="maxDuration"
                                            type="number"
                                            min="0"
                                            bind:value={
                                                dwellBucketForm.maxDuration
                                            }
                                            placeholder="Leave empty for ∞"
                                        />
                                    </FormField>
                                </FormRow>
                                <div class="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={formStates.dwellBucket
                                            .submitting}>Add Bucket</Button
                                    >
                                </div>
                            </FormContainer>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    </DialogContent>
</Dialog>

<!-- Nested Zone Dialog (reused logic from original page, simplified) -->
<Dialog bind:open={showZoneDialog}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle
                >{editingZoneId ? "Edit Zone" : "Create Zone"}</DialogTitle
            >
        </DialogHeader>
        <FormContainer
            method="POST"
            action={editingZoneId ? "?/updateZone" : "?/createZone"}
            enhance={formStates.zone.enhance}
            novalidate
        >
            <!-- Logic for hidden inputs -->
            {#if editingZoneId}
                <input type="hidden" name="zoneId" value={editingZoneId} />
                <input
                    type="hidden"
                    name="startX"
                    value={config?.zones?.find((z) => z.id === editingZoneId)
                        ?.startX || 0}
                />
                <input
                    type="hidden"
                    name="startY"
                    value={config?.zones?.find((z) => z.id === editingZoneId)
                        ?.startY || 0}
                />
                <input
                    type="hidden"
                    name="endX"
                    value={config?.zones?.find((z) => z.id === editingZoneId)
                        ?.endX || 0}
                />
                <input
                    type="hidden"
                    name="endY"
                    value={config?.zones?.find((z) => z.id === editingZoneId)
                        ?.endY || 0}
                />
            {:else}
                <!-- New zone default Coords -->
                <input type="hidden" name="startX" value={0} />
                <input type="hidden" name="startY" value={0} />
                <input type="hidden" name="endX" value={2} />
                <input type="hidden" name="endY" value={2} />
            {/if}

            <FormRow columns={2}>
                <FormField id="z_name" label="Name" required
                    ><Input
                        name="name"
                        bind:value={zoneDialogForm.name}
                    /></FormField
                >
                <FormField id="z_num" label="Number" required
                    ><Input
                        name="zoneNumber"
                        type="number"
                        bind:value={zoneDialogForm.zoneNumber}
                    /></FormField
                >
            </FormRow>
            <FormRow columns={1}>
                <FormField id="z_desc" label="Description"
                    ><Textarea
                        name="description"
                        bind:value={zoneDialogForm.description}
                    /></FormField
                >
            </FormRow>
            <div class="flex justify-end">
                <Button type="submit">Save Zone</Button>
            </div>
        </FormContainer>
    </DialogContent>
</Dialog>
