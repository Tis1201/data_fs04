<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Card from "$lib/components/ui/card";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { 
        Clock, RefreshCw, Key, Wifi, Cpu, Server, Shield, Info, Settings, Tag, 
        Terminal, Camera, RotateCcw, Upload, FileText, Edit, Save, X, PlayCircle, 
        StopCircle, AlertCircle, CheckCircle, Loader2 
    } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";
    import { DEVICE_STATUSES, DEVICE_TYPES } from "./schema";

    export let data: PageData;
    const { device } = data;
    const title = device.name || "Device Details";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Devices", "/admin/iot/devices"],
        [device.name || "Device", ""]
    ];

    // State management
    const isEditMode = writable(false);
    const activeTab = writable("overview");
    const isTerminalOpen = writable(false);
    const terminalOutput = writable([]);
    const isLoading = writable(false);
    const actionStatus = writable({ action: "", status: "", message: "" });

    // Setup the form
    const { form, errors, enhance, submitting, delayed } = superForm(data.form, {
        onUpdated: ({ form }) => {
            if (form.data.success) {
                toast.success(form.data.message || "Device updated successfully");
                // Exit edit mode after successful update
                isEditMode.set(false);
            }
        },
        resetForm: false,
        taintedMessage: null
    });

    // Handle API key generation using a form submission
    const { form: apiKeyForm, enhance: apiKeyEnhance, submitting: apiKeySubmitting } = superForm(data.form, {
        resetForm: false,
        taintedMessage: null,
        onSubmit: ({ action }) => {
            // Only handle the generateApiKey action
            if (action !== '?/generateApiKey') {
                return;
            }
        },
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('API key generated successfully');
                // Refresh the page to show the new API key
                goto(`/admin/iot/devices/${device.id}`, { invalidateAll: true });
            } else if (result.type === 'failure') {
                toast.error(result.data?.error || 'Failed to generate API key');
            }
        },
        onError: () => {
            toast.error('An error occurred while generating API key');
        }
    });

    // Format connection status
    function getConnectionStatusBadge(connected: boolean) {
        return connected 
            ? { label: "Connected", variant: "success" as const }
            : { label: "Disconnected", variant: "destructive" as const };
    }

    const connectionStatus = getConnectionStatusBadge(device.connected);

    // Device action handlers
    async function accessRemoteTerminal() {
        isTerminalOpen.set(true);
        isLoading.set(true);
        actionStatus.set({ action: "terminal", status: "loading", message: "Connecting to device terminal..." });
        
        try {
            // Simulate terminal connection
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            terminalOutput.update(output => [
                ...output,
                { type: "system", content: "Connected to device terminal." },
                { type: "prompt", content: "device@" + device.name + ":~$ " }
            ]);
            
            actionStatus.set({ action: "terminal", status: "success", message: "Terminal connected" });
        } catch (error) {
            actionStatus.set({ action: "terminal", status: "error", message: "Failed to connect to terminal" });
            toast.error("Failed to connect to device terminal");
        } finally {
            isLoading.set(false);
        }
    }

    async function retrieveSnapshot() {
        isLoading.set(true);
        actionStatus.set({ action: "snapshot", status: "loading", message: "Retrieving device snapshot..." });
        
        try {
            // Simulate snapshot retrieval
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            actionStatus.set({ action: "snapshot", status: "success", message: "Snapshot retrieved" });
            toast.success("Device snapshot retrieved successfully");
        } catch (error) {
            actionStatus.set({ action: "snapshot", status: "error", message: "Failed to retrieve snapshot" });
            toast.error("Failed to retrieve device snapshot");
        } finally {
            isLoading.set(false);
        }
    }

    async function restartDevice() {
        isLoading.set(true);
        actionStatus.set({ action: "restart", status: "loading", message: "Sending restart command..." });
        
        try {
            // Simulate device restart
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            actionStatus.set({ action: "restart", status: "success", message: "Restart command sent" });
            toast.success("Device restart initiated");
        } catch (error) {
            actionStatus.set({ action: "restart", status: "error", message: "Failed to restart device" });
            toast.error("Failed to restart device");
        } finally {
            isLoading.set(false);
        }
    }

    async function updateFirmware() {
        isLoading.set(true);
        actionStatus.set({ action: "firmware", status: "loading", message: "Initiating firmware update..." });
        
        try {
            // Simulate firmware update
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            actionStatus.set({ action: "firmware", status: "success", message: "Firmware update initiated" });
            toast.success("Firmware update has been initiated");
        } catch (error) {
            actionStatus.set({ action: "firmware", status: "error", message: "Failed to update firmware" });
            toast.error("Failed to initiate firmware update");
        } finally {
            isLoading.set(false);
        }
    }

    async function viewLogs() {
        isLoading.set(true);
        actionStatus.set({ action: "logs", status: "loading", message: "Fetching device logs..." });
        
        try {
            // Simulate logs retrieval
            await new Promise(resolve => setTimeout(resolve, 1800));
            
            actionStatus.set({ action: "logs", status: "success", message: "Logs retrieved" });
            toast.success("Device logs retrieved successfully");
        } catch (error) {
            actionStatus.set({ action: "logs", status: "error", message: "Failed to retrieve logs" });
            toast.error("Failed to retrieve device logs");
        } finally {
            isLoading.set(false);
        }
    }

    // Terminal command handling
    function handleTerminalCommand(event) {
        if (event.key === "Enter") {
            const command = event.target.value;
            event.target.value = "";
            
            if (command.trim()) {
                terminalOutput.update(output => [
                    ...output,
                    { type: "command", content: command },
                    { type: "response", content: `Executed: ${command}` },
                    { type: "prompt", content: "device@" + device.name + ":~$ " }
                ]);
            }
        }
    }

    // Toggle edit mode
    function toggleEditMode() {
        isEditMode.update(value => !value);
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight">{title}</h1>
            {#if !$isEditMode}
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    on:click={toggleEditMode}
                    class="h-8"
                >
                    <Edit class="h-3.5 w-3.5" />
                </Button>
            {/if}
        </div>
        
        {#if $isEditMode}
            <!-- Edit mode actions -->
            <div class="flex items-center space-x-2">
                <Button 
                    type="submit" 
                    form="device-edit-form"
                    disabled={$submitting}
                    variant="default"
                >
                    <Save class="mr-2 h-4 w-4" />
                    {$submitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                    type="button" 
                    variant="outline" 
                    on:click={toggleEditMode}
                >
                    <X class="mr-2 h-4 w-4" />
                    Cancel
                </Button>
            </div>
        {/if}
    </div>

    <PageContent>
        <!-- Device Action Buttons (only in view mode) -->
        {#if !$isEditMode}
            <Card.Root class="mb-6">
                <Card.Header class="pb-3">
                    <Card.Title class="flex items-center">
                        <Settings class="mr-2 h-5 w-5" />
                        Device Actions
                    </Card.Title>
                    <Card.Description>
                        Manage and interact with this device
                    </Card.Description>
                </Card.Header>
                <Card.Content>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        <!-- Remote Terminal -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-24 space-y-2"
                            on:click={accessRemoteTerminal}
                            disabled={$isLoading && $actionStatus.action === 'terminal'}
                        >
                            {#if $isLoading && $actionStatus.action === 'terminal'}
                                <Loader2 class="h-6 w-6 animate-spin" />
                            {:else}
                                <Terminal class="h-6 w-6" />
                            {/if}
                            <span>Terminal</span>
                        </Button>

                        <!-- Snapshot -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-24 space-y-2"
                            on:click={retrieveSnapshot}
                            disabled={$isLoading && $actionStatus.action === 'snapshot'}
                        >
                            {#if $isLoading && $actionStatus.action === 'snapshot'}
                                <Loader2 class="h-6 w-6 animate-spin" />
                            {:else}
                                <Camera class="h-6 w-6" />
                            {/if}
                            <span>Snapshot</span>
                        </Button>

                        <!-- Restart -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-24 space-y-2"
                            on:click={restartDevice}
                            disabled={$isLoading && $actionStatus.action === 'restart'}
                        >
                            {#if $isLoading && $actionStatus.action === 'restart'}
                                <Loader2 class="h-6 w-6 animate-spin" />
                            {:else}
                                <RotateCcw class="h-6 w-6" />
                            {/if}
                            <span>Restart</span>
                        </Button>

                        <!-- Update Firmware -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-24 space-y-2"
                            on:click={updateFirmware}
                            disabled={$isLoading && $actionStatus.action === 'firmware'}
                        >
                            {#if $isLoading && $actionStatus.action === 'firmware'}
                                <Loader2 class="h-6 w-6 animate-spin" />
                            {:else}
                                <Upload class="h-6 w-6" />
                            {/if}
                            <span>Update Firmware</span>
                        </Button>

                        <!-- View Logs -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-24 space-y-2"
                            on:click={viewLogs}
                            disabled={$isLoading && $actionStatus.action === 'logs'}
                        >
                            {#if $isLoading && $actionStatus.action === 'logs'}
                                <Loader2 class="h-6 w-6 animate-spin" />
                            {:else}
                                <FileText class="h-6 w-6" />
                            {/if}
                            <span>View Logs</span>
                        </Button>
                    </div>

                    <!-- Status message for actions -->
                    {#if $actionStatus.status}
                        <div class="mt-4 p-3 rounded-md text-sm flex items-center" class:bg-muted={$actionStatus.status === 'loading'} class:bg-green-50={$actionStatus.status === 'success'} class:bg-red-50={$actionStatus.status === 'error'}>
                            {#if $actionStatus.status === 'loading'}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                            {:else if $actionStatus.status === 'success'}
                                <CheckCircle class="mr-2 h-4 w-4 text-green-500" />
                            {:else if $actionStatus.status === 'error'}
                                <AlertCircle class="mr-2 h-4 w-4 text-red-500" />
                            {/if}
                            <span class:text-muted-foreground={$actionStatus.status === 'loading'} class:text-green-700={$actionStatus.status === 'success'} class:text-red-700={$actionStatus.status === 'error'}>
                                {$actionStatus.message}
                            </span>
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <div class="grid gap-6 md:grid-cols-1 lg:grid-cols-6">
            <!-- Left column (2/3) - Main device info and editable fields -->
            <div class="lg:col-span-4">
                <!-- Device Info Card -->
                <FormCard
                    title="Device Information"
                    description={$isEditMode ? "Edit basic details for this IoT device" : "Basic details about this device"}
                    loading={$submitting}
                    delayed={$delayed}
                >
                    {#if $isEditMode}
                        <!-- Edit Mode: Form with editable fields -->
                        <FormContainer id="device-edit-form" {enhance} action="?/save">
                            <!-- Editable fields -->
                            <FormRow columns={2}>
                                <!-- Name -->
                                <FormField
                                    label="Device Name"
                                    required={true}
                                    error={$errors.name}
                                >
                                    <Input
                                        name="name"
                                        placeholder="Enter device name"
                                        bind:value={$form.name}
                                    />
                                </FormField>

                                <!-- Status -->
                                <FormField
                                    label="Status"
                                    required={true}
                                    error={$errors.status}
                                >
                                    <EnhancedSelect
                                        name="status"
                                        options={DEVICE_STATUSES}
                                        bind:value={$form.status}
                                    />
                                </FormField>
                            </FormRow>

                            <!-- Description -->
                            <FormField
                                label="Description"
                                error={$errors.description}
                            >
                                <Textarea
                                    name="description"
                                    placeholder="Enter device description"
                                    bind:value={$form.description}
                                    rows={3}
                                />
                            </FormField>

                            <!-- Hidden ID field -->
                            <input type="hidden" name="id" bind:value={$form.id} />
                        </FormContainer>
                    {:else}
                        <!-- View Mode: Read-only display -->
                        <div class="space-y-6">
                            <!-- Basic Info -->
                            <div class="grid grid-cols-2 gap-6">
                                <!-- Name -->
                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Device Name</div>
                                    <div class="text-lg font-medium">{device.name}</div>
                                </div>

                                <!-- Status -->
                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Status</div>
                                    <Badge 
                                        variant={device.status === 'ACTIVE' ? 'default' : 
                                                device.status === 'INACTIVE' ? 'secondary' : 
                                                device.status === 'PENDING' ? 'warning' : 'outline'}
                                    >
                                        {device.status}
                                    </Badge>
                                </div>
                            </div>

                            <!-- Description -->
                            <div>
                                <div class="text-sm font-medium text-muted-foreground mb-1">Description</div>
                                <div class="text-sm">{device.description || '—'}</div>
                            </div>
                        </div>
                    {/if}

                    <svelte:fragment slot="footer">
                        {#if device}
                            <div class="mt-4 pt-3 border-t border-muted">
                                <div class="flex items-center text-xs text-muted-foreground">
                                    <Clock size={12} class="mr-1.5" />
                                    <div>
                                        Created <RelativeDate date={device.createdAt} />
                                        {#if device.createdBy && device.user}
                                            by {device.user.name || device.user.email}
                                        {/if}
                                    </div>
                                </div>
                                
                                {#if device.updatedAt && device.updatedAt.toString() !== device.createdAt.toString()}
                                    <div class="flex items-center text-xs text-muted-foreground mt-1">
                                        <Clock size={12} class="mr-1.5" />
                                        <div>Updated <RelativeDate date={device.updatedAt} /></div>
                                    </div>
                                {/if}
                                
                                {#if device.lastUsedAt}
                                    <div class="flex items-center text-xs text-muted-foreground mt-1">
                                        <Clock size={12} class="mr-1.5" />
                                        <div>Last used <RelativeDate date={device.lastUsedAt} /></div>
                                    </div>
                                {/if}
                            </div>
                        {:else}
                            <div class="mt-4 pt-3 border-t border-muted">
                                <div class="space-y-2">
                                    <Skeleton class="h-3 w-3/4" />
                                    <Skeleton class="h-3 w-1/2" />
                                </div>
                            </div>
                        {/if}
                    </svelte:fragment>
                </FormCard>

                <!-- Device Technical Details Card -->
                <Card.Root class="mt-6">
                    <Card.Header class="pb-3">
                        <Card.Title class="flex items-center">
                            <Info class="mr-2 h-5 w-5" />
                            Technical Details
                        </Card.Title>
                        <Card.Description>
                            Hardware and software information
                        </Card.Description>
                    </Card.Header>
                    <Card.Content class="pt-0">
                        <div class="space-y-5">
                            <!-- Device Type & Model -->
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                                        <Tag class="mr-1.5 h-3.5 w-3.5" />
                                        Device Type
                                    </div>
                                    <div>
                                        {device.deviceType || '—'}
                                    </div>
                                </div>

                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Model</div>
                                    <div>
                                        {device.model || '—'}
                                    </div>
                                </div>
                            </div>

                            <!-- Manufacturer & Hardware ID -->
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Manufacturer</div>
                                    <div>
                                        {device.manufacturer || '—'}
                                    </div>
                                </div>

                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Hardware ID</div>
                                    <div class="font-mono">
                                        {device.hardwareId || '—'}
                                    </div>
                                </div>
                            </div>

                            <!-- Firmware & OS Version -->
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                                        <Cpu class="mr-1.5 h-3.5 w-3.5" />
                                        Firmware Version
                                    </div>
                                    <div>
                                        {device.firmwareVersion || '—'}
                                    </div>
                                </div>

                                <div>
                                    <div class="text-sm font-medium text-muted-foreground mb-1">OS Version</div>
                                    <div>
                                        {device.osVersion || '—'}
                                    </div>
                                </div>
                            </div>

                            <!-- Network Information -->
                            <div>
                                <h3 class="text-sm font-medium mb-3 flex items-center">
                                    <Wifi class="mr-1.5 h-4 w-4" />
                                    Network Information
                                </h3>

                                <div class="grid grid-cols-3 gap-6">
                                    <!-- IP Address -->
                                    <div>
                                        <div class="text-sm font-medium text-muted-foreground mb-1">IP Address</div>
                                        <div class="font-mono">
                                            {device.ipAddress || '—'}
                                        </div>
                                    </div>

                                    <!-- WiFi MAC -->
                                    <div>
                                        <div class="text-sm font-medium text-muted-foreground mb-1">WiFi MAC</div>
                                        <div class="font-mono">
                                            {device.wifiMac || '—'}
                                        </div>
                                    </div>

                                    <!-- LAN MAC -->
                                    <div>
                                        <div class="text-sm font-medium text-muted-foreground mb-1">LAN MAC</div>
                                        <div class="font-mono">
                                            {device.lanMac || '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card.Content>
                </Card.Root>
            </div>

            <!-- Right column (1/3) - Status and security -->
            <div class="lg:col-span-2">
                <!-- Connection Status Card -->
                <Card.Root>
                    <Card.Header>
                        <Card.Title class="flex items-center">
                            <Server class="mr-2 h-5 w-5" />
                            Connection Status
                        </Card.Title>
                    </Card.Header>
                    <Card.Content>
                        <div class="flex items-center space-x-2 mb-3">
                            <Badge variant={connectionStatus.variant} class="px-3 py-1">
                                {connectionStatus.label}
                            </Badge>
                        </div>
                        
                        {#if device.connected && device.connectedAt}
                            <div class="text-sm">
                                <div class="font-medium mb-1">Connected since</div>
                                <div class="flex items-center">
                                    <Clock class="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <RelativeDate date={device.connectedAt} />
                                </div>
                            </div>
                        {:else if device.disconnectedAt}
                            <div class="text-sm">
                                <div class="font-medium mb-1">Last seen</div>
                                <div class="flex items-center">
                                    <Clock class="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <RelativeDate date={device.disconnectedAt} />
                                </div>
                            </div>
                        {/if}
                    </Card.Content>
                </Card.Root>

                <!-- Security Card -->
                <Card.Root class="mt-6">
                    <Card.Header>
                        <Card.Title class="flex items-center">
                            <Shield class="mr-2 h-5 w-5" />
                            Security
                        </Card.Title>
                    </Card.Header>
                    <Card.Content>
                        <div class="mb-3">
                            <div class="flex items-center justify-between mb-2">
                                <div class="font-medium flex items-center text-sm">
                                    <Key class="mr-1.5 h-3.5 w-3.5" />
                                    API Key
                                </div>
                                <form action="?/generateApiKey" method="POST" use:apiKeyEnhance>
                                    <Button 
                                        type="submit" 
                                        variant="outline" 
                                        size="sm"
                                        disabled={$apiKeySubmitting}
                                        class="flex items-center"
                                    >
                                        <RefreshCw class="mr-2 h-3 w-3" />
                                        {$apiKeySubmitting ? 'Generating...' : 'Generate New Key'}
                                    </Button>
                                </form>
                            </div>
                            
                            {#if device.apiKey}
                                <div class="font-mono text-xs bg-muted p-2 rounded border break-all">
                                    {device.apiKey}
                                </div>
                                <div class="text-xs text-muted-foreground mt-1">
                                    {#if device.apiKeyCreatedAt}
                                        Created <RelativeDate date={device.apiKeyCreatedAt} />
                                    {/if}
                                    {#if device.apiKeyRotatedAt && device.apiKeyRotatedAt !== device.apiKeyCreatedAt}
                                        • Rotated <RelativeDate date={device.apiKeyRotatedAt} />
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-sm text-muted-foreground italic">
                                    No API key has been generated for this device
                                </div>
                            {/if}
                        </div>
                    </Card.Content>
                </Card.Root>
            </div>
        </div>
    </PageContent>
</PageContainer>

<!-- Terminal Dialog -->
<Dialog.Root open={$isTerminalOpen} onOpenChange={(open) => isTerminalOpen.set(open)}>
    <Dialog.Content class="max-w-4xl h-[80vh] flex flex-col">
        <Dialog.Header>
            <Dialog.Title class="flex items-center">
                <Terminal class="mr-2 h-5 w-5" />
                Remote Terminal: {device.name}
            </Dialog.Title>
            <Dialog.Description>
                Execute commands on the device remotely
            </Dialog.Description>
        </Dialog.Header>
        
        <div class="flex-1 bg-black text-green-400 p-4 rounded font-mono text-sm overflow-y-auto mb-4">
            {#each $terminalOutput as line}
                {#if line.type === 'system'}
                    <div class="text-blue-400 mb-1">{line.content}</div>
                {:else if line.type === 'command'}
                    <div class="mb-1">
                        <span class="text-yellow-400">device@{device.name}:~$</span> {line.content}
                    </div>
                {:else if line.type === 'response'}
                    <div class="mb-1">{line.content}</div>
                {:else if line.type === 'prompt'}
                    <div class="mb-1">
                        <span class="text-yellow-400">{line.content}</span>
                    </div>
                {/if}
            {/each}
        </div>
        
        <div class="relative">
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span class="text-yellow-400 font-mono">device@{device.name}:~$</span>
            </div>
            <Input 
                class="pl-[calc(1rem+{device.name.length}ch+12ch)] bg-black text-green-400 font-mono" 
                placeholder="Type command and press Enter"
                on:keydown={handleTerminalCommand}
            />
        </div>
        
        <Dialog.Footer class="flex justify-between">
            <div class="text-sm text-muted-foreground">
                Press ESC to close the terminal
            </div>
            <Button variant="outline" on:click={() => isTerminalOpen.set(false)}>
                Close Terminal
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
