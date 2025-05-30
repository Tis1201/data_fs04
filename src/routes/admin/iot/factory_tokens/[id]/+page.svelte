<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Save, Trash2, Key, Calendar } from 'lucide-svelte';
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
    import * as Select from "$lib/components/ui/select";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    
    export let data;
    const { factoryToken, signingKeys } = data;
    
    // Create form handler
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/iot/factory_tokens',
        validateOnInput: true,
        onSuccess: (result) => {
            toast.success(result.data?.message || 'Factory token updated successfully');
        }
    });
    
    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : 'Not available';
    }
    
    // Format date for datetime-local input
    function formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        // Format as YYYY-MM-DDThh:mm
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0') + 'T' + 
            String(d.getHours()).padStart(2, '0') + ':' + 
            String(d.getMinutes()).padStart(2, '0');
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Factory Tokens", "/admin/iot/factory_tokens"],
        factoryToken.name || factoryToken.hardwareModel
    ];
    
    // Delete dialog state
    const state = writable({
        confirmationOpen: false,
        selectedRecord: null
    });
    
    // Handle delete using api_delete utility
    function deleteFactoryToken() {
        $state.selectedRecord = factoryToken;
        $state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        try {
            await api_delete('/admin/iot/factory_tokens', factoryToken.id);
            toast.success('Factory token deleted successfully');
            goto('/admin/iot/factory_tokens');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete factory token');
        }
    }
    
    const title = factoryToken.name || `Token: ${factoryToken.hardwareModel}`;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/factory_tokens'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Delete",
        icon: Trash2,
        onClick: deleteFactoryToken,
        variant: "destructive",
        class: "h-9"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateToken"]');
          if (form) form.requestSubmit();
        },
        class: "h-9",
        disabled: $submitting
      }
    ]}
    compact={true}
    contentSpacing="space-y-6"
>
    <div class="w-full space-y-6">
        <FormContainer
            method="POST"
            action="?/updateToken"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <AdminCard
                title="Factory Token Details"
                description="Manage factory token settings"
                icon={Key}
                compact={true}
            >
                <!-- Basic Information -->
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField 
                            id="name" 
                            label="Name" 
                            error={$errors.name}
                            description="A friendly name to help identify this token"
                        >
                            <Input 
                                id="name" 
                                name="name" 
                                bind:value={$form.name}
                                placeholder="Enter token name"
                                disabled={$submitting}
                            />
                        </FormField>
                        
                        <FormField 
                            id="factory_signing_key_id" 
                            label="Signing Key"
                            error={$errors.factory_signing_key_id}
                            required={true}
                            description="Select a JWT signing key for this token"
                        >
                            <EnhancedSelect
                                name="factory_signing_key_id"
                                id="factory_signing_key_id"
                                bind:value={$form.factory_signing_key_id}
                                placeholder="Select a signing key"
                                required={true}
                                disabled={$submitting}
                            >
                                {#each signingKeys as key}
                                    <Select.Item value={key.id}>
                                        <div class="flex items-center">
                                            <span>{key.keyId}</span>
                                            {#if key.isPrimary}
                                                <span class="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                    Primary
                                                </span>
                                            {/if}
                                        </div>
                                    </Select.Item>
                                {/each}
                            </EnhancedSelect>

                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField 
                            id="hardwareModel" 
                            label="Hardware Model" 
                            error={$errors.hardwareModel}
                            required={true}
                        >
                            <Input 
                                id="hardwareModel" 
                                name="hardwareModel" 
                                bind:value={$form.hardwareModel}
                                placeholder="Enter hardware model"
                                disabled={$submitting}
                            />
                        </FormField>
                        
                        <FormField 
                            id="firmwareVersion" 
                            label="Firmware Version"
                            error={$errors.firmwareVersion}
                            required={true}
                        >
                            <Input 
                                id="firmwareVersion" 
                                name="firmwareVersion" 
                                bind:value={$form.firmwareVersion}
                                placeholder="Enter firmware version"
                                disabled={$submitting}
                            />
                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField 
                            id="batchNumber" 
                            label="Batch Number"
                            error={$errors.batchNumber}
                        >
                            <Input 
                                id="batchNumber" 
                                name="batchNumber" 
                                bind:value={$form.batchNumber}
                                placeholder="Enter batch number"
                                disabled={$submitting}
                            />
                        </FormField>
                        
                        <FormField 
                            id="expiresAt" 
                            label="Expiration Date"
                            error={$errors.expiresAt}
                            required={true}
                        >
                            <Input 
                                id="expiresAt" 
                                name="expiresAt" 
                                type="datetime-local"
                                value={formatDateForInput($form.expiresAt)}
                                on:input={(e) => $form.expiresAt = new Date(e.currentTarget.value)}
                                disabled={$submitting}
                            />
                        </FormField>
                    </FormRow>

                    <FormRow>
                        <FormField 
                            id="notes" 
                            label="Notes"
                            error={$errors.notes}
                            description="Additional information about this token"
                        >
                            <Textarea 
                                id="notes" 
                                name="notes" 
                                bind:value={$form.notes}
                                placeholder="Enter notes"
                                disabled={$submitting}
                                rows={3}
                            />
                        </FormField>
                    </FormRow>
                </div>

                <!-- Usage Status Section -->
                {#if factoryToken.isUsed}
                    <div class="mt-8 pt-6 border-t border-border">
                        <h3 class="text-lg font-medium mb-4">Token Usage</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="p-4 bg-muted/50 rounded-md">
                                <div class="text-sm font-medium text-muted-foreground mb-1">Used At</div>
                                <div>{formatDate(factoryToken.usedAt)}</div>
                            </div>
                            
                            <div class="p-4 bg-muted/50 rounded-md">
                                <div class="text-sm font-medium text-muted-foreground mb-1">IP Address</div>
                                <div>{factoryToken.usedByIp || 'Not recorded'}</div>
                            </div>
                            
                            {#if factoryToken.device}
                                <div class="p-4 bg-muted/50 rounded-md md:col-span-2">
                                    <div class="text-sm font-medium text-muted-foreground mb-1">Associated Device</div>
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="font-medium">{factoryToken.device.name || factoryToken.device.id.substring(0, 8) + '...'}</div>
                                            <div class="text-sm text-muted-foreground">{factoryToken.device.hardwareModel} - {factoryToken.device.firmwareVersion}</div>
                                        </div>
                                        <a href="/admin/iot/devices/{factoryToken.device.id}" class="text-primary text-sm hover:underline">View Device</a>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
                
                <svelte:fragment slot="footer">
                    <MetadataFooter
                        items={[
                            { label: "Created", date: factoryToken.issuedAt, icon: 'calendar' },
                            { label: "Last Updated", date: factoryToken.updatedAt, icon: 'clock' },
                            { label: "Issued By", value: factoryToken.issuedBy || 'System', icon: 'user' },
                            { label: "Token ID", value: factoryToken.id.substring(0, 8) + '...', icon: 'tag' },
                            { label: "Used", value: factoryToken.isUsed ? 'Yes' : 'No', icon: factoryToken.isUsed ? 'check' : 'x' }
                        ]}
                    />
                </svelte:fragment>
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={{
        selectedRecord: $state.selectedRecord,
        confirmationOpen: $state.confirmationOpen,
        title: 'Delete Factory Token',
        message: $state.selectedRecord ? `Are you sure you want to delete factory token ${$state.selectedRecord.name || $state.selectedRecord.hardwareModel}?` : '',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
    }}
    useFormSubmission={false}
    onConfirm={handleDeleteConfirm}
    on:close={() => {
        $state.confirmationOpen = false;
        $state.selectedRecord = null;
    }}
/>

