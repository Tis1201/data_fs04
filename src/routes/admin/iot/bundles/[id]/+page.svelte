<script lang="ts">
    import { goto } from '$app/navigation';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { writable } from 'svelte/store';
    import { toast } from 'svelte-sonner';
    import {
        ArrowLeft,
        Save,
        Trash2,
        Package,
        Calendar,
        Layers,
        Settings,
        BarChart3,
        Activity,
        Plus,
        Play,
        Smartphone,
        Wifi,
        WifiOff,
        Info,
        Clock,
        User,
        Globe,
        Copy
    } from 'lucide-svelte';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';

    // Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { AdminCard } from "$lib/components/admin";

    // UI Components
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import * as Tabs from "$lib/components/ui/tabs";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";

    // Local Components
    import AppSelector from "./components/app_select/AppSelector.svelte";
    import BundleAppsComponent from "./components/bundle_apps/BundleAppsComponent.svelte";
    import BundleDeviceComponent from "./components/bundle_device/BundleDeviceComponent.svelte";
    import WaveComponent from "./components/waves/WaveComponent.svelte";
    import BundleDeviceProgressComponent from "./components/bundle_device_progress/BundleDeviceProgressComponent.svelte";
    import { sseStore } from '$lib/stores/sse-store';
    import { onMount, onDestroy } from 'svelte';

    export let data: any;
    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    // Selected wave for device progress view
    let selectedWave: any = null;
    
    // Format date for display
    function formatDate(date: any) {
        return date ? new Date(date).toLocaleString() : 'Not scheduled';
    }
    
    // Delete dialog state
    const state = writable<{ confirmationOpen: boolean; selectedRecord: any | null; title: string; message: string; confirmButtonText: string; cancelButtonText: string; }>({
        confirmationOpen: false,
        selectedRecord: null,
        title: "Delete Bundle",
        message: "Are you sure you want to delete this bundle? This action cannot be undone.",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel"
    });
    
    const title = `Bundle: ${bundle.name || bundle.id}`;
    
    // State for app selector
    let showAppSelector = false;
    let addingApp = false;
    
    // Function to handle app selection
    async function handleAppSelect(event: CustomEvent<{id: string; name: string; autoOpen: boolean}>) {
        const app = event.detail;
        if (!app) return;
        
        addingApp = true;
        
        try {
            // Calculate the next order number
            const nextOrder = bundle.apps.length > 0 
                ? Math.max(...bundle.apps.map((a: any) => a.order)) + 1 
                : 1;
                
            await api_post(`/api/admin/iot/bundles/${bundle.id}/apps`, {
                resourceId: app.id,
                order: nextOrder,
                autoOpen: app.autoOpen
            });
            
            toast.success(`${app.name} added to bundle successfully`);
            await invalidate('app:bundle');
            showAppSelector = false;
            
        } catch (error) {
            toast.error("Failed to add app to bundle");
            console.error(error);
        } finally {
            addingApp = false;
        }
    }
    
    // Function to handle app deletion
    async function handleDeleteApp(appId: string) {
        try {
            await api_delete(`/api/admin/iot/bundles/${bundle.id}/apps/${appId}`, appId);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        }
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle.name || "Bundle", ""]
    ];
    
    // Handle delete using api_delete utility
    function deleteBundle() {
        state.update((s) => ({ ...s, selectedRecord: bundle, confirmationOpen: true }));
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        try {
            const current = $state;
            if (!current.selectedRecord) return;
            await api_delete(`/api/admin/iot/bundles/${current.selectedRecord.id}`, current.selectedRecord.id);
            toast.success("Bundle deleted successfully");
            goto("/admin/iot/bundles");
        } catch (error) {
            toast.error("Failed to delete bundle");
            console.error(error);
        } finally {
            state.update((s) => ({ ...s, confirmationOpen: false, selectedRecord: null }));
        }
    }
    
    // OS options for the dropdown
    const osOptions = [
        { value: 'ANDROID', label: 'Android' },
        { value: 'IOS', label: 'iOS' },
        { value: 'WINDOWS', label: 'Windows' },
        { value: 'LINUX', label: 'Linux' },
        { value: 'MACOS', label: 'macOS' }
    ];
    
    // Update strategy options
    const updateStrategyOptions = [
        { value: 'IMMEDIATE', label: 'Immediate' },
        { value: 'ON_REBOOT', label: 'On Reboot' }
    ];
    
    // Format bundle status
    function getBundleStatusDisplay(status: any) {
        if (!status) return 'Unknown';
        const statusMap: Record<string, string> = {
            'DRAFT': 'Draft',
            'PUBLISHED': 'Published',
            'CANCELLED': 'Cancelled',
            'COMPLETED': 'Completed',
            'FAILED': 'Failed',
            'IN_PROGRESS': 'In Progress'
        };
        return statusMap[status] || status;
    }
    
    function getBundleStatusVariant(status: any): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
        if (!status) return 'outline';
        const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
            'DRAFT': 'outline',
            // Published = secondary (neutral), In Progress = default (primary)
            'PUBLISHED': 'secondary',
            'CANCELLED': 'destructive',
            'COMPLETED': 'success',
            'FAILED': 'destructive',
            'IN_PROGRESS': 'default'
        };
        return variantMap[status] || 'outline';
    }
    
    // Count apps and waves (reactive)
    let appsCount = 0;
    let wavesCount = 0;
    $: appsCount = (bundle?.apps?.length) || 0;
    $: wavesCount = (bundle?.waves?.length) || 0;
    
    // Device status counts (reactive)
    let onlineDevicesCount = 0;
    let offlineDevicesCount = 0;
    let totalDevicesCount = 0;
    $: totalDevicesCount = data?.bundleDevices?.length || 0;
    $: onlineDevicesCount = data?.bundleDevices?.filter((d: any) => d.device?.connected)?.length || 0;
    $: offlineDevicesCount = totalDevicesCount - onlineDevicesCount;
    
    let activeTab = "info";

    // Live update: listen for device:bundleStatus and update in-memory wave stats
    let unsubBundleRealtime: (() => void) | null = null;
    let unsubConnected: (() => void) | null = null;
    let waveStats: Record<string, { devicesTotal: number; devicesCompleted: number; devicesFailed: number; progress: number }> = {};
    let wavesVersion = 0;
    let derivedWaves: Array<{
        id: string;
        name: string;
        status: string;
        startTime?: string | null;
        endTime?: string | null;
        devicesTotal?: number | null;
        devicesCompleted?: number | null;
        devicesFailed?: number | null;
        progress?: number | null;
    }> = [];
    // Trigger device list reloads in child component when a matching wave update arrives
    let deviceProgressReloadToken = 0;
    
    // Track subscriptions to prevent duplicates
    let subscribedDevices = new Set<string>();
    let subscribedBundle = false;
    
    onMount(() => {
        // Ensure SSE is connected (only once)
        try { 
            sseStore.connect('/api/sse', { withCredentials: true }); 
        } catch {}
        
        // Subscribe this connection to all device channels used by this bundle
        let lastSubscribedConnectionId: string | null = null;
        const deviceIds: string[] = Array.isArray(data?.bundleDevices)
          ? Array.from(new Set((data.bundleDevices as any[]).map((bd: any) => bd.deviceId)))
          : [];
          
        // Subscribe to connected events
        unsubConnected = sseStore.on('connected', (msg: any) => {
            const connId = msg?.data?.connectionId;
            if (!connId || connId === lastSubscribedConnectionId) return;
            
            // Subscribe to each device channel for live bundle events (only if not already subscribed)
            const devicePromises = deviceIds
                .filter(id => !subscribedDevices.has(id))
                .map((id) => fetch(`/api/sse/subscribe/device/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ connectionId: connId })
                }).then(() => {
                    subscribedDevices.add(id);
                    return null;
                }).catch(() => null));
                
            // Subscribe to bundle channel (only if not already subscribed)
            const bundlePromise = subscribedBundle ? Promise.resolve(null) : 
                fetch(`/api/sse/subscribe/bundle/${bundle.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ connectionId: connId })
                }).then(() => {
                    subscribedBundle = true;
                    return null;
                }).catch(() => null);
                
            Promise.all([...devicePromises, bundlePromise]).then(() => {
                lastSubscribedConnectionId = connId;
            }).catch(() => {});
        });
        
        // Subscribe to all events
        unsubBundleRealtime = sseStore.on('*', async (msg: any) => {
            const evt = msg?.data ?? msg;
            const evtType = evt?.type || msg?.event || evt?.payload?.type;
            const data = evt?.payload?.action === 'bundleStatus' ? { ...evt.payload, type: 'device:bundleStatus' } : evt;
            if (evtType === 'device:bundleStatus' || data?.type === 'device:bundleStatus') {
                const waveId = data?.waveId as string | undefined;
                const devicesTotal = typeof data?.devicesTotal === 'number' ? data.devicesTotal : undefined;
                const devicesCompleted = typeof data?.devicesCompleted === 'number' ? data.devicesCompleted : undefined;
                const devicesFailed = typeof data?.devicesFailed === 'number' ? data.devicesFailed : undefined;
                const progress = typeof data?.progress === 'number'
                  ? data.progress
                  : (devicesTotal && ((devicesCompleted ?? 0) + (devicesFailed ?? 0)) > 0)
                    ? Math.round(((devicesCompleted ?? 0) + (devicesFailed ?? 0)) / devicesTotal * 100)
                    : 0;
                if (waveId && (bundle?.waves || []).some((w: any) => w.id === waveId)) {
                    waveStats[waveId] = {
                        devicesTotal: devicesTotal ?? (waveStats[waveId]?.devicesTotal ?? 0),
                        devicesCompleted: devicesCompleted ?? (waveStats[waveId]?.devicesCompleted ?? 0),
                        devicesFailed: devicesFailed ?? (waveStats[waveId]?.devicesFailed ?? 0),
                        progress
                    };
                    // bump version to trigger reactive recompute
                    wavesVersion = wavesVersion + 1;
                    // If the selected wave matches, ask device list to reload
                    if (selectedWave?.id && selectedWave.id === waveId) {
                        deviceProgressReloadToken = deviceProgressReloadToken + 1;
                    }
                    // If this wave appears finished (completed+failed >= total), refresh server data so bundle/wave statuses update
                    const stats = waveStats[waveId];
                    if (
                      typeof stats?.devicesTotal === 'number' &&
                      (stats.devicesCompleted + stats.devicesFailed) >= stats.devicesTotal &&
                      stats.devicesTotal > 0
                    ) {
                      try { await invalidate('app:bundle'); } catch {}
                    }
                }
            }
            // Also catch device-level timeout/offline events routed as generic device:bundleStatus without aggregates
            if (data?.action === 'bundleStatus' && !data?.devicesTotal && selectedWave?.id) {
                // Force a quick refresh of the selected wave's device table
                deviceProgressReloadToken = deviceProgressReloadToken + 1;
            }
            // Listen for bundle status terminal updates to refresh quickly (optional improvement)
            if (evtType === 'bundle:status' || data?.type === 'bundle:status') {
                try { await invalidate('app:bundles'); } catch {}
                try { await invalidate('app:bundle'); } catch {}
            }
            
            // Listen for wave status changes to refresh bundle data
            if (evtType === 'device:bundleStatus' && data?.action === 'bundleStatus') {
                // If we receive a wave status update, refresh the bundle data to get updated wave statuses
                try { await invalidate('app:bundle'); } catch {}
            }
            
            // Listen for wave status updates (like auto-start)
            if (evtType === 'bundle:waveStatus' || data?.type === 'bundle:waveStatus') {
                const waveId = data?.waveId as string | undefined;
                const waveStatus = data?.status as string | undefined;
                if (waveId && waveStatus && (bundle?.waves || []).some((w: any) => w.id === waveId)) {
                    // Update the wave status in real-time
                    const waveIndex = (bundle?.waves || []).findIndex((w: any) => w.id === waveId);
                    if (waveIndex !== -1) {
                        // Update the bundle waves array to reflect the new status
                        bundle = {
                            ...bundle,
                            waves: bundle.waves.map((w: any, idx: number) => 
                                idx === waveIndex ? { ...w, status: waveStatus } : w
                            )
                        };
                    }
                }
                // Refresh bundle data when wave status changes
                try { await invalidate('app:bundle'); } catch {}
            }
        });
    });
    
    onDestroy(() => { 
        try { 
            unsubBundleRealtime && unsubBundleRealtime(); 
            unsubConnected && unsubConnected();
        } catch {} 
        unsubBundleRealtime = null; 
        unsubConnected = null;
        
        // Clean up subscriptions on server
        const connectionId = sseStore.connectionId;
        if (connectionId) {
            // Unsubscribe from all device channels
            subscribedDevices.forEach(deviceId => {
                fetch(`/api/sse/unsubscribe/device/${deviceId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ connectionId })
                }).catch(() => {});
            });
            
            // Unsubscribe from bundle channel
            if (subscribedBundle) {
                fetch(`/api/sse/unsubscribe/bundle/${bundle.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ connectionId })
                }).catch(() => {});
            }
        }
        
        // Clean up local tracking
        subscribedDevices.clear();
        subscribedBundle = false;
    });

    // Derive waves passed to WaveComponent from server bundle data and live waveStats
    $: {
        // reference wavesVersion to ensure recompute when SSE updates arrive
        wavesVersion;
        const waves = (bundle?.waves || []) as any[];
        derivedWaves = waves.map((w) => {
            const stats = waveStats[w.id] || {} as any;
            const devicesTotal = stats.devicesTotal ?? w.devicesTotal ?? 0;
            const devicesCompleted = stats.devicesCompleted ?? w.devicesCompleted ?? 0;
            const devicesFailed = stats.devicesFailed ?? w.devicesFailed ?? 0;
            const progress = stats.progress ?? (
                devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0
            );
            
            // Compute wave status based on real-time stats
            let computedStatus = w.status;
            if (devicesTotal > 0 && (devicesCompleted + devicesFailed) >= devicesTotal) {
                // Wave is complete - determine if it succeeded or failed
                if (devicesFailed > 0) {
                    computedStatus = 'FAILED';
                } else {
                    computedStatus = 'COMPLETED';
                }
            } else if (devicesTotal > 0 && (devicesCompleted + devicesFailed) > 0) {
                // Wave is in progress
                computedStatus = 'IN_PROGRESS';
            }
            
            return {
                id: w.id,
                name: w.name,
                status: computedStatus,
                startTime: w.startTime ?? null,
                endTime: w.endTime ?? null,
                devicesTotal,
                devicesCompleted,
                devicesFailed,
                progress
            };
        });
    }

    // Get OS display name
    function getOSDisplay(os: any) {
        const osMap: Record<string, string> = {
            'ANDROID': 'Android',
            'IOS': 'iOS', 
            'WINDOWS': 'Windows',
            'LINUX': 'Linux',
            'MACOS': 'macOS'
        };
        return osMap[os] || os;
    }

    // Get update strategy display
    function getUpdateStrategyDisplay(strategy: any) {
        const strategyMap: Record<string, string> = {
            'IMMEDIATE': 'Immediate',
            'ON_REBOOT': 'On Reboot'
        };
        return strategyMap[strategy] || strategy;
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/bundles'),
        variant: "outline"
      },
      {
        label: "Edit",
        icon: Settings,
        onClick: () => {
          if (bundle.status !== 'DRAFT') return;
          goto(`/admin/iot/bundles/${bundle.id}/edit`)
        },
        variant: bundle.status === 'DRAFT' ? 'default' : 'outline',
        disabled: bundle.status !== 'DRAFT',
        title: bundle.status !== 'DRAFT' ? 'Not editable: bundle already published' : undefined
      },
      {
        label: "Publish",
        icon: Play,
        onClick: async () => {
          try {
            await api_post(`/api/admin/iot/bundles/${bundle.id}/publish`);
            toast.success('Bundle published');
            await invalidate('app:bundle');
          } catch (e) {
            toast.error('Failed to publish bundle');
          }
        },
        variant: "outline",
        disabled: bundle.status !== 'DRAFT',
        title: bundle.status !== 'DRAFT' ? 'Cannot publish: bundle already published' : undefined
      },
      {
        label: "Duplicate",
        icon: Copy,
        onClick: async () => {
          try {
            const response = await api_post(`/api/admin/iot/bundles/${bundle.id}/duplicate`);
            toast.success('Bundle duplicated successfully');
            // Navigate to the new bundle
            goto(`/admin/iot/bundles/${response.data.id}`);
          } catch (e) {
            toast.error('Failed to duplicate bundle');
          }
        },
        variant: "outline",
        title: "Create a copy of this bundle with same apps and devices"
      },
      {
        label: "Delete",
        icon: Trash2,
        onClick: deleteBundle,
        variant: "destructive"
      }
    ]}
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
                            {getBundleStatusDisplay(bundle.status)}
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
                
                <!-- Update Strategy removed -->

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
                    <p class="text-sm">{appsCount} app{appsCount !== 1 ? 's' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Waves</p>
                    <p class="text-sm">{wavesCount} wave{wavesCount !== 1 ? 's' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Device Status</p>
                    <div class="flex items-center gap-2">
                        {#if totalDevicesCount > 0}
                            <div class="flex items-center gap-1">
                                <div class="w-2 h-2 rounded-full {onlineDevicesCount > 0 ? 'bg-green-500' : 'bg-gray-400'}"></div>
                                <span class="text-sm">{onlineDevicesCount}/{totalDevicesCount} online</span>
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
                    <div class="flex items-center gap-2">
                        <Calendar class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm text-muted-foreground">Scheduled for:</span>
                        <span class="text-sm font-medium">{formatDate(bundle.scheduledAt)}</span>
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
        <Tabs.Root bind:value={activeTab} class="space-y-6">
            <Tabs.List class="grid w-full grid-cols-2">
                <Tabs.Trigger value="info">
                    <Package class="h-4 w-4 mr-2" />
                    Bundle Info
                </Tabs.Trigger>
                <Tabs.Trigger value="waves">
                    <BarChart3 class="h-4 w-4 mr-2" />
                    Waves
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
                    <BundleAppsComponent bundleId={bundle.id} apps={bundle.apps} />
                </AdminCard>
                
                <!-- Bundle Devices -->
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Bundle Devices</h3>
                        <p class="text-sm text-muted-foreground">Devices targeted by this bundle</p>
                    </svelte:fragment>
                    
                    <!-- Device Status Summary -->
                    {#if totalDevicesCount > 0}
                        <div class="mb-4 p-4 bg-muted/50 rounded-lg">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="flex items-center gap-2">
                                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span class="text-sm font-medium">{onlineDevicesCount} Online</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <div class="w-3 h-3 rounded-full bg-gray-400"></div>
                                        <span class="text-sm font-medium">{offlineDevicesCount} Offline</span>
                                    </div>
                                </div>
                                <div class="text-sm text-muted-foreground">
                                    {totalDevicesCount > 0 ? Math.round((onlineDevicesCount / totalDevicesCount) * 100) : 0}% online
                                </div>
                            </div>
                        </div>
                    {/if}
                    
                    <BundleDeviceComponent 
                        bundleId={data.bundle.id}
                        devices={data.bundleDevices || []}
                        loading={false}
                    />
                </AdminCard>
            </Tabs.Content>
            
            <!-- Waves Tab -->
            <Tabs.Content value="waves" class="space-y-6">
                {#if wavesCount === 0}
                    <AdminCard>
                        <div class="p-8 text-center text-muted-foreground">
                            <BarChart3 class="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p class="text-lg font-medium mb-2">No waves configured</p>
                            <p class="text-sm">Waves will be created automatically when the bundle is published</p>
                        </div>
                    </AdminCard>
                {:else}
                    <WaveComponent 
                        bundleId={bundle.id}
                        loading={false}
                        selectedWaveId={selectedWave?.id}
                        waves={derivedWaves}
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
                        reloadToken={deviceProgressReloadToken}
                    />
                {/if}
            </Tabs.Content>
        </Tabs.Root>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={$state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    on:close={() => state.update((s) => ({ ...s, confirmationOpen: false }))}
/>
