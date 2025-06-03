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
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    import { Separator } from "$lib/components/ui/separator";
    
    export let data;
    const { bundle, accounts } = data;
    
    // Create form handler
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        validateOnInput: true,
        onSuccess: (result) => {
            toast.success(result.data?.message || 'Bundle updated successfully');
        }
    });
    
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
        label: "Delete",
        icon: Trash2,
        onClick: deleteBundle,
        variant: "outline",
        class: "h-9 text-destructive hover:bg-destructive/10"
      },
      {
        label: "Save",
        icon: Save,
        type: "submit",
        form: "bundle-form",
        disabled: $submitting,
        variant: "default",
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
                    <p class="text-xs text-muted-foreground">Waves</p>
                    <p class="text-sm">{wavesCount} wave{wavesCount !== 1 ? 's' : ''}</p>
                </div>
            </div>
        </AdminCard>
        
        <!-- Bundle Details Form -->
        <div class="w-full">
            <FormContainer
                id="bundle-form"
                method="POST"
                action="?/updateBundle"
                enhance={enhance}
                novalidate
                errorMessage={$errorMessage}
                class="w-full"
            >
            <AdminCard>
                <svelte:fragment slot="header">
                    <h3 class="text-lg font-medium">Bundle Details</h3>
                    <p class="text-sm text-muted-foreground">Update the bundle information</p>
                </svelte:fragment>
                
                {#if $errorMessage}
                    <div class="mb-4 p-3 rounded-md w-full bg-destructive/10 text-destructive">
                        <p class="text-sm font-medium">{$errorMessage.text}</p>
                        {#if $errorMessage.details}
                            <p class="text-xs">{$errorMessage.details}</p>
                        {/if}
                    </div>
                {/if}
                
                <div class="space-y-4">
                    <FormRow columns={2}>
                        <FormField id="name" label="Bundle Name" error={$errors.name} required={true}>
                            <Input
                                id="name"
                                name="name"
                                bind:value={$form.name}
                                placeholder="Enter bundle name"
                                aria-invalid={$errors.name ? 'true' : undefined}
                            />
                        </FormField>
                        
                        <FormField id="accountId" label="Account" error={$errors.accountId} required={true}>
                            <EnhancedSelect
                                id="accountId"
                                name="accountId"
                                bind:value={$form.accountId}
                                options={accounts.map(account => ({ value: account.id, label: account.name }))}
                                placeholder="Select account"
                                aria-invalid={$errors.accountId ? 'true' : undefined}
                            />
                        </FormField>
                    </FormRow>
                    
                    <FormField id="description" label="Description" error={$errors.description}>
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter bundle description"
                            rows={3}
                            aria-invalid={$errors.description ? 'true' : undefined}
                        />
                    </FormField>
                    
                    <FormRow columns={2}>
                        <FormField id="os" label="Operating System" error={$errors.os} required={true}>
                            <EnhancedSelect
                                id="os"
                                name="os"
                                bind:value={$form.os}
                                options={osOptions}
                                placeholder="Select OS"
                                aria-invalid={$errors.os ? 'true' : undefined}
                            />
                        </FormField>
                        
                        <FormField id="version" label="Version" error={$errors.version} required={true}>
                            <Input
                                id="version"
                                name="version"
                                bind:value={$form.version}
                                placeholder="e.g. 1.0.0"
                                aria-invalid={$errors.version ? 'true' : undefined}
                            />
                        </FormField>
                    </FormRow>
                    
                    <FormRow columns={2}>
                        <FormField id="waveSize" label="Wave Size" error={$errors.waveSize} required={true}>
                            <Input
                                id="waveSize"
                                name="waveSize"
                                type="number"
                                bind:value={$form.waveSize}
                                placeholder="500"
                                min="1"
                                aria-invalid={$errors.waveSize ? 'true' : undefined}
                            />
                        </FormField>
                        
                        <FormField id="updateStrategy" label="Update Strategy" error={$errors.updateStrategy}>
                            <EnhancedSelect
                                id="updateStrategy"
                                name="updateStrategy"
                                bind:value={$form.updateStrategy}
                                options={updateStrategyOptions}
                                placeholder="Select update strategy"
                                aria-invalid={$errors.updateStrategy ? 'true' : undefined}
                            />
                        </FormField>
                    </FormRow>
                    
                    <div class="p-3 rounded-md bg-muted/50">
                        <h4 class="text-sm font-medium mb-2">Device Behavior</h4>
                        <div class="space-y-3">
                            <FormField id="reboot" label="Reboot Device" error={$errors.reboot}>
                                <div class="flex items-center space-x-2">
                                    <Switch
                                        id="reboot"
                                        name="reboot"
                                        checked={$form.reboot}
                                        onCheckedChange={(checked) => $form.reboot = checked}
                                    />
                                    <Label for="reboot">Reboot device after installation</Label>
                                </div>
                            </FormField>
                        </div>
                    </div>
                    
                    <div class="p-3 rounded-md bg-muted/50">
                        <h4 class="text-sm font-medium mb-2">Scheduling</h4>
                        <div class="space-y-3">
                            <FormRow columns={2}>
                                <FormField id="scheduledAt" label="Schedule Date" error={$errors.scheduledAt}>
                                    <EnhancedDatePicker
                                        id="scheduledAt"
                                        name="scheduledAt"
                                        form={$form}
                                        field="scheduledAt"
                                        placeholder="Select date"
                                        format_string="yyyy-MM-dd"
                                        clearable={true}
                                    />
                                </FormField>
                                
                                <FormField id="scheduledTime" label="Schedule Time" error={$errors.scheduledTime}>
                                    <EnhancedTimePicker
                                        id="scheduledTime"
                                        name="scheduledTime"
                                        form={$form}
                                        field="scheduledTime"
                                        placeholder="Select time"
                                    />
                                </FormField>
                            </FormRow>
                            
                            <FormRow columns={2}>
                                <FormField id="scheduledAtTimezone" label="Timezone" error={$errors.scheduledAtTimezone}>
                                    <Input
                                        id="scheduledAtTimezone"
                                        name="scheduledAtTimezone"
                                        bind:value={$form.scheduledAtTimezone}
                                        placeholder="UTC"
                                        aria-invalid={$errors.scheduledAtTimezone ? 'true' : undefined}
                                    />
                                </FormField>
                                
                                <FormField id="scheduledAtStartIfMissed" label="Start If Missed" error={$errors.scheduledAtStartIfMissed}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="scheduledAtStartIfMissed"
                                            name="scheduledAtStartIfMissed"
                                            checked={$form.scheduledAtStartIfMissed}
                                            onCheckedChange={(checked) => $form.scheduledAtStartIfMissed = checked}
                                        />
                                        <Label for="scheduledAtStartIfMissed">Start immediately if scheduled time is missed</Label>
                                    </div>
                                </FormField>
                            </FormRow>
                        </div>
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
            </FormContainer>
        </div>
    </div>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    {state}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
/>
