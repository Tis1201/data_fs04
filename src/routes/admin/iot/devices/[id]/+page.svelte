<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { writable } from "svelte/store";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import SecureKeyDisplay from "$lib/components/ui_components_sveltekit/display/SecureKeyDisplay.svelte";
    import { 
        Clock, RefreshCw, Key, Wifi, Cpu, Server, Shield, Info, Settings, Tag, 
        Terminal, Camera, RotateCcw, Upload, FileText, Edit, AlertCircle, CheckCircle, Loader2, Monitor
    } from "lucide-svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
import { CompactInfoGrid, CompactInfoItem } from "$lib/components/ui_components_sveltekit/layout";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
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
    const activeTab = writable("overview");
    // Terminal state is now managed in the terminal page
    const isLoading = writable(false);
    const actionStatus = writable({ action: "", status: "", message: "" });

    // Setup the form for API key generation
    const { form: apiKeyForm, enhance: apiKeyEnhance, submitting: apiKeySubmitting } = superForm(data.form, {
        id: 'api-key-form', // Add a unique ID to avoid duplicate form ID errors
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
    function accessRemoteTerminal() {
        // Navigate to the terminal page
        goto(`/admin/iot/devices/${device.id}/terminal`);
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

    // Navigate to edit page
    function navigateToEdit() {
        goto(`/admin/iot/devices/${device.id}/edit`);
    }
</script>

<AdminPageLayout
    title={title}
    crumbs={pageCrumbs}
    actionLabel="Edit"
    actionIcon={Edit}
    actionOnClick={navigateToEdit}
    compact={true}
    contentSpacing="space-y-4"
>
        <!-- Device Action Buttons -->
        <AdminCard
            title="Device Actions"
            description="Manage and interact with this device"
            icon={Settings}
            class_name="mb-4"
            compact={true}
        >
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        <!-- Define a consistent button style -->
                        {#if false}
                        <!-- This is just a template, not rendered -->
                        <div class="btn-template hidden">
                            <Button
                                variant="outline"
                                class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            >
                                <div class="h-5 w-5" />
                                <span class="text-xs">Label</span>
                            </Button>
                        </div>
                        {/if}
                        <!-- Remote Terminal -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={accessRemoteTerminal}
                        >
                            <Terminal class="h-5 w-5" />
                            <span class="text-xs">Terminal</span>
                        </Button>

                        <!-- Remote Desktop -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={() => goto(`/admin/iot/devices/${device.id}/rdp`)}
                        >
                            <Monitor class="h-5 w-5" />
                            <span class="text-xs">Remote Desktop</span>
                        </Button>

                        <!-- Snapshot -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={retrieveSnapshot}
                            disabled={$isLoading && $actionStatus.action === 'snapshot'}
                        >
                            {#if $isLoading && $actionStatus.action === 'snapshot'}
                                <Loader2 class="h-5 w-5 animate-spin" />
                            {:else}
                                <Camera class="h-5 w-5" />
                            {/if}
                            <span class="text-xs">Snapshot</span>
                        </Button>

                        <!-- Restart -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={restartDevice}
                            disabled={$isLoading && $actionStatus.action === 'restart'}
                        >
                            {#if $isLoading && $actionStatus.action === 'restart'}
                                <Loader2 class="h-5 w-5 animate-spin" />
                            {:else}
                                <RotateCcw class="h-5 w-5" />
                            {/if}
                            <span class="text-xs">Restart</span>
                        </Button>

                        <!-- Update Firmware -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={updateFirmware}
                            disabled={$isLoading && $actionStatus.action === 'firmware'}
                        >
                            {#if $isLoading && $actionStatus.action === 'firmware'}
                                <Loader2 class="h-5 w-5 animate-spin" />
                            {:else}
                                <Upload class="h-5 w-5" />
                            {/if}
                            <span class="text-xs">Update Firmware</span>
                        </Button>

                        <!-- View Logs -->
                        <Button 
                            variant="outline" 
                            class="flex flex-col items-center justify-center h-16 w-full space-y-1 p-2"
                            on:click={viewLogs}
                            disabled={$isLoading && $actionStatus.action === 'logs'}
                        >
                            {#if $isLoading && $actionStatus.action === 'logs'}
                                <Loader2 class="h-5 w-5 animate-spin" />
                            {:else}
                                <FileText class="h-5 w-5" />
                            {/if}
                            <span class="text-xs">View Logs</span>
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
                </AdminCard>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Device Info Card -->
            <AdminCard
                title="Device Information"
                description="Basic details about this device"
                icon={Info}
                compact={true}
                class_name="md:col-span-2"
            >
                <!-- View Mode: Read-only display -->
                <div class="space-y-4">
                    <!-- Basic Info -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="md:col-span-2">
                            <CompactInfoGrid columns={2} gap="gap-4">
                                <!-- Name -->
                                <CompactInfoItem label="Device Name">
                                    <div class="font-medium">{device.name}</div>
                                </CompactInfoItem>

                                <!-- Status -->
                                <CompactInfoItem label="Status">
                                    <Badge 
                                        variant={device.status === 'ACTIVE' ? 'default' : 
                                                device.status === 'INACTIVE' ? 'secondary' : 
                                                device.status === 'PENDING' ? 'warning' : 'outline'}
                                    >
                                        {device.status}
                                    </Badge>
                                </CompactInfoItem>
                                
                                <!-- Description -->
                                <CompactInfoItem label="Description" class_name="col-span-2">
                                    {device.description || '—'}
                                </CompactInfoItem>
                            </CompactInfoGrid>
                        </div>
                        
                        <!-- Metadata Section -->
                        <div class="border-l-0 md:border-l border-muted pl-0 md:pl-4">
                            {#if device}
                                <CompactInfoGrid columns={1} gap="gap-1">
                                    <CompactInfoItem label="Created" icon={Clock}>
                                        <div class="text-xs">
                                            <RelativeDate date={device.createdAt} />
                                            {#if device.createdBy && device.user}
                                                <span class="block text-muted-foreground">by {device.user.name || device.user.email}</span>
                                            {/if}
                                        </div>
                                    </CompactInfoItem>
                                    
                                    {#if device.updatedAt && device.updatedAt.toString() !== device.createdAt.toString()}
                                        <CompactInfoItem label="Updated" icon={Clock}>
                                            <div class="text-xs">
                                                <RelativeDate date={device.updatedAt} />
                                            </div>
                                        </CompactInfoItem>
                                    {/if}
                                    
                                    {#if device.lastUsedAt}
                                        <CompactInfoItem label="Last used" icon={Clock}>
                                            <div class="text-xs">
                                                <RelativeDate date={device.lastUsedAt} />
                                            </div>
                                        </CompactInfoItem>
                                    {/if}
                                </CompactInfoGrid>
                            {:else}
                                <div class="space-y-2">
                                    <Skeleton class="h-3 w-3/4" />
                                    <Skeleton class="h-3 w-1/2" />
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </AdminCard>

            <!-- Combined Connection & Security Card -->
            <AdminCard
                title="Device Status"
                icon={Server}
                compact={true}
                class_name="md:col-span-2"
            >
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Connection Status Section -->
                    <div>
                        <h3 class="text-sm font-medium mb-2 flex items-center">
                            <Server class="mr-1.5 h-4 w-4" />
                            Connection Status
                        </h3>
                        
                        <div class="flex items-center space-x-2 mb-2">
                            <Badge variant={connectionStatus.variant} class="px-3 py-1">
                                {connectionStatus.label}
                            </Badge>
                        </div>
                        
                        {#if device.connected && device.connectedAt}
                            <CompactInfoItem label="Connected since" icon={Clock}>
                                <RelativeDate date={device.connectedAt} />
                            </CompactInfoItem>
                        {:else if device.disconnectedAt}
                            <CompactInfoItem label="Last seen" icon={Clock}>
                                <RelativeDate date={device.disconnectedAt} />
                            </CompactInfoItem>
                        {/if}
                    </div>

                    <!-- Security Section -->
                    <div class="border-t md:border-t-0 md:border-l border-muted pt-4 md:pt-0 md:pl-4">
                        <h3 class="text-sm font-medium mb-2 flex items-center">
                            <Shield class="mr-1.5 h-4 w-4" />
                            Security
                        </h3>
                        
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <div class="font-medium flex items-center text-sm">
                                    <Key class="mr-1.5 h-3.5 w-3.5" />
                                    API Key
                                </div>
                                <form id="api-key-form" action="?/generateApiKey" method="POST" use:apiKeyEnhance>
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
                            
                            <SecureKeyDisplay 
                                apiKey={device.apiKey || ""}
                                createdAt={device.apiKeyCreatedAt}
                                rotatedAt={device.apiKeyRotatedAt}
                                loading={$apiKeySubmitting}
                            />
                        </div>
                    </div>
                </div>
            </AdminCard>

            <!-- Device Technical Details Card -->
            <AdminCard
                title="Technical Details"
                description="Hardware and software information"
                icon={Info}
                compact={true}
                class_name="md:col-span-2"
            >
                <div class="space-y-4">
                    <!-- Device Type & Model -->
                    <CompactInfoGrid columns={4} gap="gap-4">
                        <CompactInfoItem label="Device Type" icon={Tag}>
                            {device.deviceType || '—'}
                        </CompactInfoItem>

                        <CompactInfoItem label="Model">
                            {device.model || '—'}
                        </CompactInfoItem>
                    
                        <!-- Manufacturer & Hardware ID -->
                        <CompactInfoItem label="Manufacturer">
                            {device.manufacturer || '—'}
                        </CompactInfoItem>

                        <CompactInfoItem label="Hardware ID">
                            <span class="font-mono">{device.hardwareId || '—'}</span>
                        </CompactInfoItem>
                    </CompactInfoGrid>

                    <!-- Firmware & OS Version -->
                    <CompactInfoGrid columns={4} gap="gap-4">
                        <CompactInfoItem label="Firmware Version">
                            {device.firmwareVersion || '—'}
                        </CompactInfoItem>

                        <CompactInfoItem label="OS Version">
                            {device.osVersion || '—'}
                        </CompactInfoItem>
                    
                        <!-- IP Address & MAC Address -->
                        <CompactInfoItem label="IP Address">
                            <span class="font-mono">{device.ipAddress || '—'}</span>
                        </CompactInfoItem>

                        <CompactInfoItem label="MAC Address">
                            <span class="font-mono">{device.macAddress || '—'}</span>
                        </CompactInfoItem>
                    </CompactInfoGrid>

                    <!-- Network Information -->
                    <div>
                        <h3 class="text-sm font-medium mb-2 flex items-center">
                            <Wifi class="mr-1.5 h-4 w-4" />
                            Network Information
                        </h3>

                        <CompactInfoGrid columns={3} gap="gap-4">
                            <!-- WiFi MAC -->
                            <CompactInfoItem label="WiFi MAC">
                                <span class="font-mono">{device.wifiMac || '—'}</span>
                            </CompactInfoItem>

                            <!-- LAN MAC -->
                            <CompactInfoItem label="LAN MAC">
                                <span class="font-mono">{device.lanMac || '—'}</span>
                            </CompactInfoItem>
                        </CompactInfoGrid>
                    </div>
                </div>
            </AdminCard>
        </div>
</AdminPageLayout>

<!-- Terminal Dialog has been replaced with a dedicated terminal page -->
