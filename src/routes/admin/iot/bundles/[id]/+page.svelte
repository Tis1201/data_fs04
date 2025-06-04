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

        Play

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
    import BundleDeviceComponent from "./components/bundle_device/BundleDeviceComponent.svelte";
    import WaveComponent from "./components/waves/WaveComponent.svelte";
    import BundleDeviceProgressComponent from "./components/bundle_device_progress/BundleDeviceProgressComponent.svelte";
    
    export let data;
    const { bundle } = data;

    // Selected wave for device progress view
    let selectedWave = null;
    
    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : 'Not scheduled';
    }
    
    // Delete dialog state
    const state = writable({
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
            await api_delete(`/api/admin/iot/bundles/${bundle.id}/apps/${appId}`);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        }
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle.name || "Bundle", ""]
    ];
    
    // Handle delete using api_delete utility
    function deleteBundle() {
        $state.selectedRecord = bundle;
        $state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        try {
            await api_delete(`/api/admin/iot/bundles/${$state.selectedRecord.id}`);
            toast.success("Bundle deleted successfully");
            goto("/admin/iot/bundles");
        } catch (error) {
            toast.error("Failed to delete bundle");
            console.error(error);
        } finally {
            $state.confirmationOpen = false;
            $state.selectedRecord = null;
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
    function getBundleStatusDisplay(status) {
        if (!status) return 'Unknown';
        const statusMap = {
            'DRAFT': 'Draft',
            'PUBLISHED': 'Published',
            'CANCELLED': 'Cancelled',
            'COMPLETED': 'Completed',
            'FAILED': 'Failed'
        };
        return statusMap[status] || status;
    }
    
    function getBundleStatusVariant(status) {
        if (!status) return 'outline';
        const variantMap = {
            'DRAFT': 'outline',
            'PUBLISHED': 'default',
            'CANCELLED': 'destructive',
            'COMPLETED': 'success',
            'FAILED': 'destructive'
        };
        return variantMap[status] || 'outline';
    }
    
    // Count apps and waves
    const appsCount = bundle.apps?.length || 0;
    const wavesCount = bundle.waves?.length || 0;
    
    let activeTab = "info";
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/bundles'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Edit",
        icon: Settings,
        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/edit`),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Publish",
        icon: Play,
        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/publish`),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Delete",
        icon: Trash2,
        onClick: deleteBundle,
        variant: "destructive",
        class: "h-9"
      }
    ]}
>
    <div class="w-full space-y-6">
        <!-- Bundle Status Card -->
        <AdminCard>
            <svelte:fragment slot="header">
                <h3 class="text-lg font-medium">Bundle Status</h3>
                <p class="text-sm text-muted-foreground">Current status and information about this bundle</p>
            </svelte:fragment>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Name</p>
                    <p class="text-sm font-mono break-all">{bundle.name}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Description</p>
                    <p class="text-sm">{bundle.description || 'No description provided'}</p>
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
                    <p class="text-xs text-muted-foreground">Scheduled For</p>
                    <p class="text-sm">{formatDate(bundle.scheduledAt)}</p>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Wave Size</p>
                    <p class="text-sm">{bundle.waveSize || 'Not specified'}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Waves</p>
                    <p class="text-sm">{wavesCount} wave{wavesCount !== 1 ? 's' : ''} of 10</p>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Apps</p>
                    <p class="text-sm">{appsCount} app{appsCount !== 1 ? 's' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Devices</p>
                    <p class="text-sm">{bundle.devices?.length || 0} device{(bundle.devices?.length || 0) !== 1 ? 's' : ''}</p>
                </div>
                
               

                

            </div>
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        { label: "ID", value: bundle.id },
                        // { label: "Reboot", value: bundle.reboot ? 'Yes' : 'No'},
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
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-lg font-medium">Bundle Apps</h3>
                            <p class="text-sm text-muted-foreground">Manage apps included in this bundle</p>
                        </div>
                        <Button size="sm" on:click={() => showAppSelector = true}>
                            <Plus class="h-4 w-4 mr-2" />
                            Add App
                        </Button>
                    </div>

                    <!-- App Selector Dialog -->
                    <AppSelector 
                        bundleId={bundle.id}
                        bind:open={showAppSelector}
                        on:select={handleAppSelect}
                        on:close={() => showAppSelector = false}
                    />

                    <!-- Apps List -->
                    <div class="mt-4 border rounded-md">
                        {#if bundle.apps.length === 0}
                            <div class="p-4 text-center text-muted-foreground">
                                No apps added to this bundle yet. Click "Add App" to get started.
                            </div>
                        {:else}
                            <table class="w-full">
                                <thead class="border-b">
                                    <tr class="text-left text-sm font-medium">
                                        <th class="p-3">Name</th>
                                        <th class="p-3">Version</th>
                                        <th class="p-3">Order</th>
                                        <th class="p-3">Added</th>
                                        <th class="p-3 w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each bundle.apps as app (app.id)}
                                        <tr class="border-t hover:bg-muted/50">
                                            <td class="p-3">{app.resource?.name || 'Unknown'}</td>
                                            <td class="p-3">{app.version || 'N/A'}</td>
                                            <td class="p-3">{app.order}</td>
                                            <td class="p-3">
                                                <RelativeDate date={app.createdAt} />
                                            </td>
                                            <td class="p-3">
                                                <div class="flex justify-end">
                                                    <RecordActions 
                                                        actions={[
                                                            {
                                                                label: 'Remove',
                                                                icon: Trash2,
                                                                variant: 'destructive',
                                                                onClick: () => handleDeleteApp(app.id)
                                                            }
                                                        ]}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        {/if}
                    </div>
                </AdminCard>
                
                <!-- Selected Devices -->
                <AdminCard>
                    <!-- <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Selected Devices</h3>
                        <p class="text-sm text-muted-foreground">Devices targeted by this bundle</p>
                    </svelte:fragment> -->
                    
                    <BundleDeviceComponent 
                        bundleId={data.bundle.id}
                        devices={data.bundleDevices || []}
                        loading={false}
                    />
                </AdminCard>
            </Tabs.Content>
            
            <!-- Waves Tab -->
            <Tabs.Content value="waves" class="space-y-6">
                <WaveComponent 
                    bundleId={bundle.id}
                    loading={false}
                    selectedWaveId={selectedWave?.id}
                    on:selectWave={(event) => selectedWave = event.detail.wave}
                />
                
                <BundleDeviceProgressComponent
                    selectedWave={selectedWave}
                    loading={false}
                />
            </Tabs.Content>
        </Tabs.Root>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    on:close={() => state.confirmationOpen = false}
/>
