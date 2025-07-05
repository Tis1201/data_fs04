<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, FileText, Users } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Group";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts"],
        ["Groups", "/admin/accounts/groups"],
        "New Group"
    ];
    
    // Import form utilities and schema
    import { getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps } from '$lib/utils/formHelpers';
    import { groupSchema } from './group';
    
    // Enhanced SuperForms setup - best practice approach
    const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
        superForm(data.form, {
            validators: zod(groupSchema), // Schema validation for proper typing
            ...getDetailPageFormConfig("Group"), // FormHelpers utilities for consistency
            onResult: async ({ result }) => {
                if (result.type === "success") {
                    // Redirect to groups list on success
                    await goto('/admin/accounts/groups');
                }
            }
        });
    
    // Reactive states - using formHelpers pattern
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: async () => await goto('/admin/accounts/groups'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9" // Fixed height for consistency
      }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
    <FormContainer
        method="POST"
        action="?/create"
        {enhance}
        novalidate
        {errorMessage}
        showAlerts={true}
        disabled={isLoading}
        {hasTimeout}
        {isLoading}
        delayed={$delayed}
    >
        <AdminCard
            title="Group Information"
            description="Create a new group in the system"
            icon={Users}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField 
                        id="name" 
                        label="Group Name" 
                        error={$errors.name}
                        required={true}
                        helpText="Enter a unique name for the group"
                    >
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="Enter group name"
                            {...getFieldProps($errors, 'name', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="accountId" 
                        label="Account" 
                        error={$errors.accountId}
                        required={true}
                        helpText="Select the parent account for this group"
                    >
                        <EnhancedSelect
                            id="accountId"
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                            {...getSelectProps($errors, 'accountId', isLoading)}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Group Details"
            description="Additional information about the group"
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField 
                        id="description" 
                        label="Description" 
                        error={$errors.description}
                        helpText="Optional description of the group's purpose"
                    >
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter group description"
                            rows="3"
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.description ? true : undefined}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="permissions" 
                        label="Permissions" 
                        error={$errors.permissions}
                        required={true}
                        helpText="Enter permissions as a valid JSON object. Default is an empty object."
                    >
                        <Textarea
                            id="permissions"
                            name="permissions"
                            bind:value={$form.permissions}
                            placeholder="Enter permissions as a valid JSON object"
                            rows="3"
                            class="w-full {$errors.permissions ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.permissions ? true : undefined}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>
    </div>
</AdminPageLayout>
