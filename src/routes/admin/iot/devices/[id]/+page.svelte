<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Clock, RefreshCw, Key, Wifi, Cpu, Server, Shield, Info, Settings, Tag } from "lucide-svelte";
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
    const title = "Edit Device";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Devices", "/admin/iot/devices"],
        [device.name || "Device", ""]
    ];

    // Setup the form
    const { form, errors, enhance, submitting, delayed } = superForm(data.form, {
        onUpdated: ({ form }) => {
            if (form.data.success) {
                toast.success(form.data.message || "Device updated successfully");
            }
        },
        resetForm: false,
        taintedMessage: null
    });

    // Handle API key generation
    async function generateApiKey() {
        try {
            const response = await fetch(`?/generateApiKey`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(result.message);
                // Refresh the page to show the new API key
                goto(`/admin/iot/devices/${device.id}`, { invalidateAll: true });
            } else {
                toast.error(result.error || "Failed to generate API key");
            }
        } catch (error) {
            toast.error("An error occurred while generating API key");
            console.error(error);
        }
    }

    // Format connection status
    function getConnectionStatusBadge(connected: boolean) {
        return connected 
            ? { label: "Connected", variant: "success" as const }
            : { label: "Disconnected", variant: "destructive" as const };
    }

    const connectionStatus = getConnectionStatusBadge(device.connected);
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        <div class="grid gap-6 md:grid-cols-1 lg:grid-cols-6">
            <!-- Left column (2/3) - Main device info and editable fields -->
            <div class="lg:col-span-4">
                <!-- Device Info Card -->
                <FormCard
                    title="Device Information"
                    description="Edit basic details for this IoT device"
                    loading={$submitting}
                    delayed={$delayed}
                >
                    <FormContainer {enhance} action="?/save">
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

                        <!-- Form Actions -->
                        <FormActions>
                            <Button type="submit" disabled={$submitting}>
                                {$submitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                on:click={() => goto('/admin/iot/devices')}
                            >
                                Cancel
                            </Button>
                        </FormActions>

                        <!-- Hidden ID field -->
                        <input type="hidden" name="id" bind:value={$form.id} />
                    </FormContainer>

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
                    <Card.Header>
                        <Card.Title class="flex items-center">
                            <Info class="mr-2 h-5 w-5" />
                            Technical Details
                        </Card.Title>
                        <Card.Description>
                            Hardware and software information
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="grid grid-cols-2 gap-4">
                            <!-- Device Type -->
                            <div>
                                <div class="text-sm font-medium mb-1 flex items-center">
                                    <Tag class="mr-1.5 h-3.5 w-3.5" />
                                    Device Type
                                </div>
                                <div class="text-sm">
                                    {device.deviceType || '—'}
                                </div>
                            </div>

                            <!-- Model -->
                            <div>
                                <div class="text-sm font-medium mb-1">Model</div>
                                <div class="text-sm">
                                    {device.model || '—'}
                                </div>
                            </div>

                            <!-- Manufacturer -->
                            <div>
                                <div class="text-sm font-medium mb-1">Manufacturer</div>
                                <div class="text-sm">
                                    {device.manufacturer || '—'}
                                </div>
                            </div>

                            <!-- Hardware ID -->
                            <div>
                                <div class="text-sm font-medium mb-1">Hardware ID</div>
                                <div class="text-sm font-mono">
                                    {device.hardwareId || '—'}
                                </div>
                            </div>

                            <!-- Firmware Version -->
                            <div>
                                <div class="text-sm font-medium mb-1 flex items-center">
                                    <Cpu class="mr-1.5 h-3.5 w-3.5" />
                                    Firmware Version
                                </div>
                                <div class="text-sm">
                                    {device.firmwareVersion || '—'}
                                </div>
                            </div>

                            <!-- OS Version -->
                            <div>
                                <div class="text-sm font-medium mb-1">OS Version</div>
                                <div class="text-sm">
                                    {device.osVersion || '—'}
                                </div>
                            </div>
                        </div>

                        <Separator class="my-4" />

                        <!-- Network Information -->
                        <div>
                            <h3 class="text-sm font-medium mb-3 flex items-center">
                                <Wifi class="mr-1.5 h-4 w-4" />
                                Network Information
                            </h3>

                            <div class="grid grid-cols-3 gap-4">
                                <!-- IP Address -->
                                <div>
                                    <div class="text-sm font-medium mb-1">IP Address</div>
                                    <div class="text-sm font-mono">
                                        {device.ipAddress || '—'}
                                    </div>
                                </div>

                                <!-- WiFi MAC -->
                                <div>
                                    <div class="text-sm font-medium mb-1">WiFi MAC</div>
                                    <div class="text-sm font-mono">
                                        {device.wifiMac || '—'}
                                    </div>
                                </div>

                                <!-- LAN MAC -->
                                <div>
                                    <div class="text-sm font-medium mb-1">LAN MAC</div>
                                    <div class="text-sm font-mono">
                                        {device.lanMac || '—'}
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
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    on:click={generateApiKey}
                                    class="flex items-center"
                                >
                                    <RefreshCw class="mr-2 h-3 w-3" />
                                    Generate New Key
                                </Button>
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
