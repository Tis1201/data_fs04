<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, Users, ArrowLeft } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  
  // Import custom form components
  import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = `Edit Group: ${data.group.name}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts"],
    ["Groups", "/admin/accounts/groups"],
    data.group.name,
  ];
  
  // Import superForm directly
  import { superForm } from 'sveltekit-superforms/client';
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, message } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Group updated successfully!");
        goto('/admin/accounts/groups');
      } else if (result.type === 'error') {
        toast.error("Failed to update group");
      }
    }
  });
  
  // Format account options for the select dropdown
  const accountOptions = data.accounts.map(account => ({
    value: account.id,
    label: account.name
  }));
</script>

<div class="w-full space-y-6">
<!-- Using FormContainer's built-in error handling -->
<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/groups'),
        variant: "outline"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateGroup"]');
          if (form) form.requestSubmit();
        }
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <FormContainer 
    method="POST" 
    action="?/updateGroup" 
    {enhance} 
    novalidate
    errorMessage={$message}
  >
    <AdminCard
      title="Group Information"
      description="Edit group details"
      icon={Users}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Group Name" 
            error={$errors.name}
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter group name" 
              aria-invalid={$errors.name ? 'true' : undefined}
            />
          </FormField>
          
          <FormField 
            id="accountId" 
            label="Account" 
            error={$errors.accountId}
          >
            <EnhancedSelect
              name="accountId"
              options={accountOptions}
              bind:value={$form.accountId}
              placeholder="Select an account"
              aria-invalid={$errors.accountId ? 'true' : undefined}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={1}>
          <FormField 
            id="description" 
            label="Description" 
            error={$errors.description}
          >
            <Textarea 
              id="description" 
              name="description" 
              bind:value={$form.description} 
              placeholder="Enter group description" 
              class="w-full h-24"
              aria-invalid={$errors.description ? 'true' : undefined}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={1}>
          <FormField 
            id="permissions" 
            label="Permissions" 
            error={$errors.permissions}
          >
            <Textarea 
              id="permissions" 
              name="permissions" 
              bind:value={$form.permissions} 
              placeholder="Enter permissions as a valid JSON object" 
              class="w-full h-24 font-mono"
              aria-invalid={$errors.permissions ? 'true' : undefined}
            />
            <p class="text-xs text-muted-foreground mt-1">
              Enter permissions as a valid JSON object. Default is an empty object.
            </p>
          </FormField>
        </FormRow>
      </div>
    </AdminCard>
  </FormContainer>
</AdminPageLayout>
</div>
