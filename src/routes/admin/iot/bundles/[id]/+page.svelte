<script lang="ts">
    import { goto } from '$app/navigation';
    import { invalidate } from '$app/navigation';
    import { page } from '$app/stores';
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
    import BundleAppsComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_apps/BundleAppsComponent.svelte";
    import BundleDeviceComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_device/BundleDeviceComponent.svelte";
    import WaveComponent from "$lib/components/ui_components_sveltekit/bundles/waves/WaveComponent.svelte";
    import BundleDeviceProgressComponent from "$lib/components/ui_components_sveltekit/bundles/bundle_device_progress/BundleDeviceProgressComponent.svelte";
    import { subscribeBundleWave } from '$lib/bundles/realtime';
    import { onMount, onDestroy } from 'svelte';
    import { sseStore } from '$lib/stores/sse-store';

    export let data: any;
    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    const dataPage = data
    


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
    let deviceStatusVersion = 0; // Version counter to trigger reactive updates
    
    // Real-time device status tracking
    let deviceConnectionStates = new Map<string, boolean>(); // deviceId -> connected
    
    $: {
        deviceStatusVersion; // Reference to trigger recomputation
        totalDevicesCount = data?.bundleDevices?.length || 0;
        
        // Calculate online count from real-time states if available, otherwise fallback to static data
        if (deviceConnectionStates.size > 0) {
            onlineDevicesCount = Array.from(deviceConnectionStates.values()).filter(connected => connected).length;
            console.log('[AdminBundleDetail] Using real-time device states:', {
                deviceConnectionStates: Object.fromEntries(deviceConnectionStates),
                onlineDevicesCount,
                totalDevicesCount
            });
        } else {
            onlineDevicesCount = data?.bundleDevices?.filter((d: any) => d.device?.connected)?.length || 0;
            console.log('[AdminBundleDetail] Using static device data:', {
                onlineDevicesCount,
                totalDevicesCount,
                bundleDevices: data?.bundleDevices?.map((d: any) => ({ id: d.device?.id, connected: d.device?.connected }))
            });
        }
        
        offlineDevicesCount = totalDevicesCount - onlineDevicesCount;
    }
    
    let activeTab = "info";

    // Live update: listen for bundle:waveStatus and update in-memory wave stats
    let unsubscribeRealtime: (() => void) | null = null;
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
    
    // Reactive subscription to bundle changes
    $: if (bundle?.id) {
        console.log('[AdminBundleDetail] Bundle changed, updating SSE subscription for bundle:', bundle.id);
        console.log('[AdminBundleDetail] Available waves:', bundle?.waves?.map((w: any) => ({ id: w.id, name: w.name, status: w.status })));
        console.log('[AdminBundleDetail] Previous subscription exists:', !!unsubscribeRealtime);
        
        // Clean up previous subscription
        if (unsubscribeRealtime) {
            console.log('[AdminBundleDetail] Cleaning up previous subscription');
            unsubscribeRealtime();
            unsubscribeRealtime = null;
        }
        
        // Subscribe to new bundle
        console.log('[AdminBundleDetail] Creating new subscription for bundle:', bundle.id);
        unsubscribeRealtime = subscribeBundleWave(bundle.id, (payload) => {
            console.log('[AdminBundleDetail] Wave update received:', payload);
            
            const waveId = payload.waveId;
            const waveStatus = payload.status;
            const devicesTotal = payload.devicesTotal;
            const devicesCompleted = payload.devicesCompleted;
            const devicesFailed = payload.devicesFailed;
            const progress = payload.progress;
            
            console.log('[AdminBundleDetail] Processing wave update:', {
                waveId,
                waveStatus,
                devicesTotal,
                devicesCompleted,
                devicesFailed,
                progress,
                selectedWaveId: selectedWave?.id
            });
            
            if (waveId && (bundle?.waves || []).some((w: any) => w.id === waveId)) {
                console.log('[AdminBundleDetail] Wave found in bundle, updating stats');
                
                const oldStats = waveStats[waveId];
                waveStats[waveId] = {
                    devicesTotal: devicesTotal ?? (waveStats[waveId]?.devicesTotal ?? 0),
                    devicesCompleted: devicesCompleted ?? (waveStats[waveId]?.devicesCompleted ?? 0),
                    devicesFailed: devicesFailed ?? (waveStats[waveId]?.devicesFailed ?? 0),
                    progress: progress ?? (waveStats[waveId]?.progress ?? 0)
                };
                
                console.log('[AdminBundleDetail] Wave stats updated:', {
                    waveId,
                    oldStats,
                    newStats: waveStats[waveId]
                });
                
                wavesVersion = wavesVersion + 1;
                console.log('[AdminBundleDetail] wavesVersion incremented to:', wavesVersion);
                
                if (selectedWave?.id && selectedWave.id === waveId) {
                    deviceProgressReloadToken = deviceProgressReloadToken + 1;
                    console.log('[AdminBundleDetail] Selected wave updated, deviceProgressReloadToken incremented to:', deviceProgressReloadToken);
                }
                
                if (waveStatus) {
                    const waveIndex = (bundle?.waves || []).findIndex((w: any) => w.id === waveId);
                    console.log('[AdminBundleDetail] Updating wave status in bundle, waveIndex:', waveIndex);
                    
                    if (waveIndex !== -1) {
                        const oldStatus = bundle.waves[waveIndex].status;
                        bundle = {
                            ...bundle,
                            waves: bundle.waves.map((w: any, idx: number) => 
                                idx === waveIndex ? { ...w, status: waveStatus } : w
                            )
                        };
                        console.log('[AdminBundleDetail] Wave status updated:', {
                            waveId,
                            oldStatus,
                            newStatus: waveStatus
                        });
                    }
                }
            } else {
                console.log('[AdminBundleDetail] Wave not found in bundle or invalid waveId:', {
                    waveId,
                    availableWaveIds: bundle?.waves?.map((w: any) => w.id)
                });
            }
            
            try { 
                console.log('[AdminBundleDetail] Calling invalidate(app:bundle)');
                invalidate('app:bundle'); 
                console.log('[AdminBundleDetail] invalidate(app:bundle) completed');
            } catch (e) {
                console.error('[AdminBundleDetail] Error calling invalidate:', e);
            }
        });
        
        console.log('[AdminBundleDetail] SSE subscription setup completed');
    }
    
    // Establish SSE connection for real-time updates
    onMount(() => {
        console.log('[AdminBundleDetail] onMount - Establishing SSE connection');
        try {
            sseStore.connect(`/api/sse`, { withCredentials: true });
            console.log('[AdminBundleDetail] SSE connection established');
        } catch (e) {
            console.warn('[AdminBundleDetail] SSE connect failed (may already be connected):', e);
        }
        
        // Initialize device connection states from static data
        if (data?.bundleDevices) {
            data.bundleDevices.forEach((d: any) => {
                if (d.device?.id) {
                    deviceConnectionStates.set(d.device.id, !!d.device.connected);
                }
            });
            deviceStatusVersion++; // Trigger reactive update
            console.log('[AdminBundleDetail] Initialized device connection states:', deviceConnectionStates);
        }
        
        // Listen for device connection events
        const unsubscribeDeviceConnections = sseStore.on('*', (msg: any) => {
            console.log('[AdminBundleDetail] Received SSE message for device status:', msg);
            const raw = msg?.data ?? msg;
            const evtType = raw?.type || msg?.event || raw?.payload?.type;
            const evt = raw?.payload?.action === 'device:connection' ? { ...raw.payload, type: 'device:connection' } : raw;
            
            if (evtType !== 'device:connection' && evt?.type !== 'device:connection') {
                return;
            }
            
            const c = evt as any;
            const cDeviceId = c?.deviceId || c?.payload?.deviceId;
            const connected = c?.connected ?? c?.payload?.connected ?? false;
            
            if (cDeviceId) {
                console.log('[AdminBundleDetail] Updating device connection state:', { deviceId: cDeviceId, connected });
                deviceConnectionStates.set(cDeviceId, !!connected);
                deviceStatusVersion++; // Trigger reactive update
                console.log('[AdminBundleDetail] Updated device connection states:', deviceConnectionStates);
            }
        });
        
        // Cleanup function
        return () => {
            try { unsubscribeDeviceConnections && unsubscribeDeviceConnections(); } catch {}
        };
    });
    
    onDestroy(() => { 
        console.log('[AdminBundleDetail] onDestroy - Cleaning up SSE subscription');
        try { 
            unsubscribeRealtime && unsubscribeRealtime();
            console.log('[AdminBundleDetail] SSE subscription cleaned up successfully');
        } catch (e) {
            console.error('[AdminBundleDetail] Error cleaning up SSE subscription:', e);
        } 
        unsubscribeRealtime = null;
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
            // Auto-refresh to load complete data and ensure SSE subscription works
            setTimeout(() => window.location.reload(), 100);
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
                    <p class="text-xs text-muted-foreground">Batches</p>
                    <p class="text-sm">{wavesCount} batch{wavesCount !== 1 ? 'es' : ''}</p>
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
            
            <!-- Batches Tab -->
            <Tabs.Content value="waves" class="space-y-6">
                {#if wavesCount === 0}
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

