<script lang="ts">
    import { goto } from '$app/navigation';
    import { invalidate } from '$app/navigation';
    import { writable } from 'svelte/store';
    import { toast } from 'svelte-sonner';
    import {
        ArrowLeft,
        Trash2,
        Package,
        Calendar,
        Settings,
        BarChart3,
        Play,
        Copy
    } from 'lucide-svelte';
    import { postV2 } from '$lib/utils/v2ApiHandler';

    // Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { AdminCard } from "$lib/components/admin";

    // UI Components
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Tabs from "$lib/components/ui/tabs";

    // Local Components
    import BundleAppsComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_apps/BundleAppsComponent.svelte";
    import BundleDeviceComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_device/BundleDeviceComponent.svelte";
    import WaveComponent from "$lib/components/ui_components_sveltekit/bundles/waves/WaveComponent.svelte";
    import BundleDeviceProgressComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_device_progress/BundleDeviceProgressComponent.svelte";

    // Utilities
    import { useBundleDetail } from '$lib/composables/useBundleDetail';
    import {
        getBundleStatusLabel,
        getBundleStatusVariant,
        getOSDisplay,
        formatBundleDate,
        formatBundleDateWithTimezone
    } from '$lib/utils/bundleUtils';

    interface Props {
        // Data from server
        bundle: any;
        bundleDevices: any[];
        resources?: any[];
        
        // Configuration
        title: string;
        pageCrumbs: [string, string][];
        context: 'admin' | 'user';
        basePath: string; // "/admin/iot/bundles" or "/user/iot/bundles"
        
        // Optional features
        enableDeviceTracking?: boolean; // Admin only
        enableStopAllWaves?: boolean;    // Admin only
    }

    export let bundle: Props['bundle'];
    export let bundleDevices: Props['bundleDevices'];
    export let resources: Props['resources'] = [];
    export let title: Props['title'];
    export let pageCrumbs: Props['pageCrumbs'];
    export let context: Props['context'];
    export let basePath: Props['basePath'];
    export let enableDeviceTracking: Props['enableDeviceTracking'] = false;
    export let enableStopAllWaves: Props['enableStopAllWaves'] = false;

    // Make bundle reactive to server invalidations
    $: bundle = bundle;

    // Selected wave for device progress view
    let selectedWave: any = null;

    // Delete dialog state
    const state = writable<{ 
        confirmationOpen: boolean; 
        selectedRecord: any | null; 
        title: string; 
        message: string; 
        confirmButtonText: string; 
        cancelButtonText: string; 
    }>({
        confirmationOpen: false,
        selectedRecord: null,
        title: "Delete Bundle",
        message: "Are you sure you want to delete this bundle? This action cannot be undone.",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel"
    });

    // Setup composable
    const {
        showAppSelector,
        addingApp,
        activeTab,
        appsCount,
        wavesCount,
        onlineDevicesCount,
        offlineDevicesCount,
        totalDevicesCount,
        derivedWaves,
        deviceProgressReloadToken,
        handleDeleteBundle,
        handleStopAllWaves,
        updateComputedCounts,
        updateDerivedWaves,
        setupMQTTSubscriptions
    } = useBundleDetail({
        bundleId: bundle.id,
        context,
        bundle: { 
            get: () => bundle, 
            set: (v) => bundle = v 
        },
        bundleDevices: { 
            get: () => bundleDevices 
        },
        selectedWave: { 
            get: () => selectedWave, 
            set: (v) => selectedWave = v 
        },
        enableDeviceTracking,
        enableStopAllWaves
    });

    // Reactive updates when bundle changes
    $: if (bundle?.id) {
        updateComputedCounts();
        updateDerivedWaves();
        setupMQTTSubscriptions();
    }

    // Action handlers
    function deleteBundle() {
        state.update((s) => ({ ...s, selectedRecord: bundle, confirmationOpen: true }));
    }

    async function handleDeleteConfirm() {
        try {
            const current = $state;
            if (!current.selectedRecord) return;
            await handleDeleteBundle();
        } catch (error) {
            toast.error("Failed to delete bundle");
            console.error(error);
        } finally {
            state.update((s) => ({ ...s, confirmationOpen: false, selectedRecord: null }));
        }
    }

    async function handlePublish() {
        try {
            const apiPath = `/api/v2/bundles/${bundle.id}/publish`;
            const response = await postV2(apiPath); // Using postV2 helper
            toast.success('Bundle published');
            await invalidate('app:bundle');
        } catch (e) {
            toast.error('Failed to publish bundle');
        }
    }

    async function handleDuplicate() {
        try {
            const apiPath = `/api/v2/bundles/${bundle.id}/duplicate`;
            const response = await postV2(apiPath); // Using postV2 helper
            toast.success('Bundle duplicated successfully');
            // Navigate to the new bundle
            if (response.id) {
                goto(`${basePath}/${response.id}`);
            }
            // Auto-refresh to load complete data and ensure MQTT subscription works
            setTimeout(() => window.location.reload(), 100);
        } catch (e) {
            toast.error('Failed to duplicate bundle');
        }
    }

    // Action buttons configuration
    $: actionButtons = [
        {
            label: "Back",
            icon: ArrowLeft,
            onClick: () => goto(basePath),
            variant: "outline" as const
        },
        {
            label: "Edit",
            icon: Settings,
            onClick: () => {
                if (bundle.status !== 'DRAFT') return;
                goto(`${basePath}/${bundle.id}/edit`);
            },
            variant: bundle.status === 'DRAFT' ? 'default' as const : 'outline' as const,
            disabled: bundle.status !== 'DRAFT',
            title: bundle.status !== 'DRAFT' ? 'Not editable: bundle already published' : undefined
        },
        {
            label: "Publish",
            icon: Play,
            onClick: handlePublish,
            variant: "outline" as const,
            disabled: bundle.status !== 'DRAFT',
            title: bundle.status !== 'DRAFT' ? 'Cannot publish: bundle already published' : undefined
        },
        {
            label: "Duplicate",
            icon: Copy,
            onClick: handleDuplicate,
            variant: "outline" as const,
            title: "Create a copy of this bundle with same apps and devices"
        },
        {
            label: "Delete",
            icon: Trash2,
            onClick: deleteBundle,
            variant: "destructive" as const
        }
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
>
    <div class="w-full space-y-6">
        <!-- Bundle Overview Card -->
        <AdminCard>
            <svelte:fragment slot="header">
                <h3 class="text-lg font-medium">Bundle Overview</h3>
                <p class="text-sm text-muted-foreground">Key information about this bundle</p>
            </svelte:fragment>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Name</p>
                    <p class="text-sm font-medium">{bundle.name || 'Unnamed Bundle'}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Status</p>
                    <div>
                        <Badge variant={getBundleStatusVariant(bundle.status)}>
                            {getBundleStatusLabel(bundle.status)}
                        </Badge>
                    </div>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Target OS</p>
                    <p class="text-sm">{getOSDisplay(bundle.os)}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Version</p>
                    <p class="text-sm">{bundle.version || 'N/A'}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Wave Size</p>
                    <p class="text-sm">{bundle.waveSize || 'Not configured'}</p>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Force Update</p>
                    <p class="text-sm">{bundle.forceUpdate ? 'Yes' : 'No'}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Auto Open</p>
                    <p class="text-sm">{bundle.autoOpen ? 'Yes' : 'No'}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Apps Included</p>
                    <p class="text-sm">{$appsCount} app{$appsCount !== 1 ? 's' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Batches</p>
                    <p class="text-sm">{$wavesCount} batch{$wavesCount !== 1 ? 'es' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Device Status</p>
                    <div class="flex items-center gap-2">
                        {#if $totalDevicesCount > 0}
                            <div class="flex items-center gap-1">
                                <div class="w-2 h-2 rounded-full {$onlineDevicesCount > 0 ? 'bg-green-500' : 'bg-gray-400'}"></div>
                                <span class="text-sm">{$onlineDevicesCount}/{$totalDevicesCount} online</span>
                            </div>
                        {:else}
                            <span class="text-sm text-muted-foreground">No devices</span>
                        {/if}
                    </div>
                </div>
            </div>

            {#if bundle.description}
                <div class="mt-4 pt-4 border-t">
                    <p class="text-xs text-muted-foreground mb-1">Description</p>
                    <p class="text-sm">{bundle.description}</p>
                </div>
            {/if}

            {#if bundle.scheduledAt}
                <div class="mt-4 pt-4 border-t">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <Calendar class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm text-muted-foreground">Scheduled for:</span>
                            <span class="text-sm font-medium">{formatBundleDate(bundle.scheduledAt)}</span>
                        </div>
                        {#if bundle.scheduledAtTimezone && formatBundleDateWithTimezone(bundle.scheduledAt, bundle.scheduledAtTimezone)}
                            <div class="flex items-center gap-2 pl-6">
                                <span class="text-xs text-muted-foreground">Original timezone:</span>
                                <span class="text-xs font-mono">{formatBundleDateWithTimezone(bundle.scheduledAt, bundle.scheduledAtTimezone)}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
            
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        { label: "ID", value: bundle.id },
                        { label: "Reboot Required", value: bundle.reboot ? 'Yes' : 'No'},
                        { label: "Force Update", value: bundle.forceUpdate ? 'Yes' : 'No'},
                        { label: "Auto Open", value: bundle.autoOpen ? 'Yes' : 'No'},
                        { label: 'Created', date: bundle.createdAt, icon: 'calendar' },
                        { label: 'Updated', date: bundle.updatedAt, icon: 'clock' }
                    ]}
                />
            </svelte:fragment>
        </AdminCard>

        <!-- Tabs for Bundle Info and Waves -->
        <Tabs.Root bind:value={$activeTab} class="space-y-6">
            <Tabs.List class="grid w-full grid-cols-2">
                <Tabs.Trigger value="info">
                    <Package class="h-4 w-4 mr-2" />
                    Bundle Info
                </Tabs.Trigger>
                <Tabs.Trigger value="waves">
                    <BarChart3 class="h-4 w-4 mr-2" />
                    Batches
                </Tabs.Trigger>
            </Tabs.List>
            
            <!-- Bundle Info Tab -->
            <Tabs.Content value="info" class="space-y-6">
                
                <!-- Bundle Apps -->
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Bundle Apps</h3>
                        <p class="text-sm text-muted-foreground">Manage apps included in this bundle</p>
                    </svelte:fragment>
                    <BundleAppsComponent 
                        bundleId={bundle.id} 
                        apps={bundle.apps}
                    />
                </AdminCard>
                
                <!-- Bundle Devices -->
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Bundle Devices</h3>
                        <p class="text-sm text-muted-foreground">Devices targeted by this bundle</p>
                    </svelte:fragment>
                    
                    <!-- Device Status Summary -->
                    {#if $totalDevicesCount > 0}
                        <div class="mb-4 p-4 bg-muted/50 rounded-lg">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="flex items-center gap-2">
                                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span class="text-sm font-medium">{$onlineDevicesCount} Online</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <div class="w-3 h-3 rounded-full bg-gray-400"></div>
                                        <span class="text-sm font-medium">{$offlineDevicesCount} Offline</span>
                                    </div>
                                </div>
                                <div class="text-sm text-muted-foreground">
                                    {$totalDevicesCount > 0 ? Math.round(($onlineDevicesCount / $totalDevicesCount) * 100) : 0}% online
                                </div>
                            </div>
                        </div>
                    {/if}
                    
                    <BundleDeviceComponent 
                        bundleId={bundle.id}
                        devices={bundleDevices || []}
                        loading={false}
                    />
                </AdminCard>
            </Tabs.Content>
            
            <!-- Batches Tab -->
            <Tabs.Content value="waves" class="space-y-6">
                {#if $wavesCount === 0}
                    <AdminCard>
                        <div class="p-8 text-center text-muted-foreground">
                            <BarChart3 class="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p class="text-lg font-medium mb-2">No batches configured</p>
                            <p class="text-sm">Batches will be created automatically when the bundle is published</p>
                        </div>
                    </AdminCard>
                {:else}
                    <WaveComponent 
                        bundleId={bundle.id}
                        loading={false}
                        selectedWaveId={selectedWave?.id}
                        waves={$derivedWaves}
                        on:selectWave={(event) => selectedWave = event.detail.wave}
                        on:wavesStopped={async () => {
                            // Refresh the page data to get updated wave statuses
                            try {
                                await invalidate('app:bundle');
                            } catch (error) {
                                console.error('Failed to refresh bundle data:', error);
                            }
                        }}
                    />
                    
                    <BundleDeviceProgressComponent
                        bundleId={bundle.id}
                        selectedWave={selectedWave}
                        reloadToken={$deviceProgressReloadToken}
                    />
                {/if}
            </Tabs.Content>
        </Tabs.Root>
    </div>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={$state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    on:close={() => state.update((s) => ({ ...s, confirmationOpen: false }))}
/>

