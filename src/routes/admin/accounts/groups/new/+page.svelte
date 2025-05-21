<script lang="ts">
    import { goto } from "$app/navigation";
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
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/accounts/groups',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the redirect
        }
    });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/groups'),
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
    loading={$submitting}
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
        errorMessage={$errorMessage}
    >
        <AdminCard
            title="Group Information"
            description="Create a new group in the system"
            icon={Users}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField id="name" label="Group Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="Enter group name"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            {...$constraints.name}
                        />
                    </FormField>
                    
                    <FormField id="accountId" label="Account" error={$errors.accountId}>
                        <EnhancedSelect
                            id="accountId"
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            aria-invalid={$errors.accountId ? 'true' : undefined}
                            {...$constraints.accountId}
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
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
                    <FormField id="description" label="Description" error={$errors.description}>
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter group description"
                            rows="3"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField id="permissions" label="Permissions" error={$errors.permissions}>
                        <Textarea
                            id="permissions"
                            name="permissions"
                            bind:value={$form.permissions}
                            placeholder="Enter permissions as a valid JSON object"
                            rows="3"
                            aria-invalid={$errors.permissions ? 'true' : undefined}
                            {...$constraints.permissions}
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            Enter permissions as a valid JSON object. Default is an empty object.
                        </p>
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>
    </div>
</AdminPageLayout>
