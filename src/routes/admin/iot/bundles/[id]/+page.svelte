<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Save, Trash2, Package, Calendar, Layers, Settings } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import { api_delete } from '$lib/utils/ApiUtils';
    import { writable } from 'svelte/store';
    
    // Import layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    
    // Import form components
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
    import EnhancedTimePicker from "$lib/components/ui_components_sveltekit/form/EnhancedTimePicker.svelte";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    // No form handler needed for view-only page
    import { Separator } from "$lib/components/ui/separator";
    
    export let data;
    const { bundle, accounts } = data;
    
    // No form handler needed for view-only page
    
    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : 'Not scheduled';
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        bundle.name || `Bundle ${bundle.id}`
    ];
    
    // Delete dialog state
    const state = writable({
        confirmationOpen: false,
        selectedRecord: null,
        title: "Delete Bundle",
        message: "Are you sure you want to delete this bundle? This action cannot be undone.",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel"
    });
    
    // Handle delete using api_delete utility
    function deleteBundle() {
        $state.selectedRecord = bundle;
        $state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        try {
            await api_delete('/admin/iot/bundles', bundle.id);
            toast.success('Bundle deleted successfully');
            goto('/admin/iot/bundles');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete bundle');
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
    
    const title = `Bundle: ${bundle.name || bundle.id}`;
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
                
                <!-- <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Account</p>
                    <p class="text-sm">{bundle.account?.name || 'Not assigned'}</p>
                </div> -->
                
                <!-- <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">OS & Version</p>
                    <p class="text-sm">{bundle.os} {bundle.version}</p>
                </div> -->
                
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
                    <p class="text-sm">{appsCount} app{appsCount !== 1 ? 's' : ''}</p>
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

        <AdminCard>
            <svelte:fragment slot="header">
                <h3 class="text-lg font-medium">Bundle Apps</h3>
                <!-- <p class="text-sm text-muted-foreground">Selected Apps</p> -->
            </svelte:fragment>
        </AdminCard>

        <AdminCard>
            <svelte:fragment slot="header">
                <h3 class="text-lg font-medium">Selected Devices</h3>
                <!-- <p class="text-sm text-muted-foreground">Selected Apps</p> -->
            </svelte:fragment>
        </AdminCard>

        <!--  -->
        
        
    </div>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    {state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
/>
