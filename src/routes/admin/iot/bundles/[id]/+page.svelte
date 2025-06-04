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
        Plus
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
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    
    // Local Components
    import AppSelector from "./components/app_select/AppSelector.svelte";
    
    export let data;
    const { bundle } = data;
    
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
                    <p class="text-xs text-muted-foreground">Bundle ID</p>
                    <p class="text-sm font-mono break-all">{bundle.id}</p>
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
                    <p class="text-xs text-muted-foreground">Account</p>
                    <p class="text-sm">{bundle.account?.name || 'Not assigned'}</p>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">OS & Version</p>
                    <p class="text-sm">{bundle.os} {bundle.version}</p>
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
                    <p class="text-xs text-muted-foreground">Apps</p>
                    <p class="text-sm">{appsCount} app{appsCount !== 1 ? 's' : ''}</p>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Devices</p>
                    <p class="text-sm">{bundle.devices?.length || 0} device{(bundle.devices?.length || 0) !== 1 ? 's' : ''}</p>
                </div>
                
                <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Waves</p>
                    <p class="text-sm">{wavesCount} wave{wavesCount !== 1 ? 's' : ''}</p>
                </div>

            </div>
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
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
                <!-- Bundle Details -->
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Bundle Details</h3>
                        <p class="text-sm text-muted-foreground">Basic information</p>
                    </svelte:fragment>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Name</p>
                                <p class="text-sm">{bundle.name}</p>
                            </div>
                            
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Description</p>
                                <p class="text-sm">{bundle.description || 'No description'}</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Wave Size</p>
                                <p class="text-sm">{bundle.waveSize || 'Not specified'}</p>
                            </div>
                            
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Update Strategy</p>
                                <p class="text-sm">{bundle.updateStrategy || 'Not specified'}</p>
                            </div>
                        </div>
                        
                        <div class="p-3 rounded-md bg-muted/50">
                            <h4 class="text-sm font-medium mb-2">Device Behavior</h4>
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <Label>Reboot Device</Label>
                                    <div>{bundle.reboot ? 'Yes' : 'No'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="p-3 rounded-md bg-muted/50">
                            <h4 class="text-sm font-medium mb-2">Scheduling</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Schedule Date</p>
                                    <p class="text-sm">{formatDate(bundle.scheduledAt)}</p>
                                </div>
                                
                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Schedule Time</p>
                                    <p class="text-sm">{bundle.scheduledTime || 'Not specified'}</p>
                                </div>
                                
                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Timezone</p>
                                    <p class="text-sm">{bundle.scheduledAtTimezone || 'Not specified'}</p>
                                </div>
                                
                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Start If Missed</p>
                                    <p class="text-sm">{bundle.scheduledAtStartIfMissed ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </AdminCard>
                
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
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Selected Devices</h3>
                        <p class="text-sm text-muted-foreground">Devices targeted by this bundle</p>
                    </svelte:fragment>
                    
                    <!-- Device list would go here -->
                    <div class="py-4 text-center text-muted-foreground">
                        No devices selected yet
                    </div>
                </AdminCard>
            </Tabs.Content>
            
            <!-- Waves Tab -->
            <Tabs.Content value="waves" class="space-y-6">
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Deployment Waves</h3>
                        <p class="text-sm text-muted-foreground">{wavesCount} wave{wavesCount !== 1 ? 's' : ''} configured</p>
                    </svelte:fragment>
                    
                    <!-- Waves progress visualization would go here -->
                    <div class="py-4 text-center text-muted-foreground" class:hidden={wavesCount > 0}>
                        No waves configured for this bundle yet
                    </div>
                </AdminCard>
                
                <AdminCard>
                    <svelte:fragment slot="header">
                        <h3 class="text-lg font-medium">Deployment Progress</h3>
                        <p class="text-sm text-muted-foreground">Overall deployment status</p>
                    </svelte:fragment>
                    
                    <!-- Progress metrics and charts would go here -->
                    <div class="py-4 text-center text-muted-foreground">
                        No deployment data available yet
                    </div>
                </AdminCard>
            </Tabs.Content>
        </Tabs.Root>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    onClose={() => state.confirmationOpen = false}
/>
