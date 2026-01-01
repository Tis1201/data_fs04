<script lang="ts">
    import { page } from '$app/stores';
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
    import DeviceComponent from "$lib/components/ui_components_sveltekit/device_tags/DeviceComponent.svelte";
    
    export let data;
    const { deviceTag } = data;
    
    const returnUrlParam = $page.url.searchParams.get('returnUrl');
    const returnUrl = returnUrlParam 
        ? decodeURIComponent(returnUrlParam) 
        : '/admin/iot/device_tags';
        
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: returnUrl, 
        validateOnInput: true,
        onSuccess: (result) => {
            toast.success(result.data?.message || 'Device Tag updated successfully');
        }
    });
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Device Tags", "/admin/iot/device_tags"],
    ];
    
    // Delete dialog state
    const state = writable({
        confirmationOpen: false,
        selectedRecord: null
    });
    
    // Handle delete using api_delete utility
    function deleteDeviceTag() {
        $state.selectedRecord = deviceTag;
        $state.confirmationOpen = true;
    }
    
    async function handleDeleteConfirm() {
        try {
            await api_delete('/admin/iot/device_tags', deviceTag.id);
            toast.success('Device Tag deleted successfully');
            goto(returnUrl);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete Device Tag');
        }
    }
    
    const title = deviceTag.name;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto(returnUrl),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Delete",
        icon: Trash2,
        onClick: deleteDeviceTag,
        variant: "destructive",
        class: "h-9"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateTag"]');
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
            action="?/updateTag"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <AdminCard
                title="Device Tag Details"
                description="Manage Device Tag settings"
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
                        >
                            <Input 
                                id="name" 
                                name="name" 
                                bind:value={$form.name}
                                placeholder="Enter name"
                                disabled={$submitting}
                            />
                        </FormField>
                        <FormField id="accountId" label="Account" error={$errors.accountId}>
                            <select
                                id="accountId"
                                name="accountId"
                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-invalid={$errors.accountId ? 'true' : undefined}
                                placeholder="Select account (optional - defaults to system account)"
                                disabled={true}
                            >
                                <option value=''>{deviceTag.account?.name || 'Empty'}</option>
                            </select>
                        </FormField>
                    </FormRow>
                    <FormRow columns={1}>
                        <FormField 
                            id="description" 
                            label="Description"
                            error={$errors.description}
                            required={true}
                        >
                            <Input 
                                id="description" 
                                name="description" 
                                bind:value={$form.description}
                                placeholder="Enter description"
                                disabled={$submitting}
                            />
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>

            <!-- Devices -->
            <AdminCard>
                <svelte:fragment slot="header">
                    <h3 class="text-lg font-medium">Device Tags</h3>
                    <p class="text-sm text-muted-foreground">Device Tags attached to this device</p>
                </svelte:fragment>
                
                <DeviceComponent 
                    devices={deviceTag.devices || []}
                    loading={false}
                />
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={{
        selectedRecord: $state.selectedRecord,
        confirmationOpen: $state.confirmationOpen,
        title: 'Delete Device Tag',
        message: $state.selectedRecord ? `Are you sure you want to delete Device Tag ${$state.selectedRecord.name}?` : '',
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