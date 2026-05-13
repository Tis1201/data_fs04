<script lang="ts">
  import { goto } from "$app/navigation";
  import { superForm } from 'sveltekit-superforms/client';
  import { zod } from 'sveltekit-superforms/adapters';
  import { toast } from "svelte-sonner";
  import { Save, FileText, ArrowLeft } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  
  // Import custom form components
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import type { PageData } from "./$types";

  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = "Add Account";
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", ""],
    "Add Account",
  ];
  
  // Import form utilities and schema
  import { getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps } from '$lib/utils/formHelpers';
  import { accountEditSchema, ACCOUNT_STATUS_OPTIONS } from '../schema';
  
  // Enhanced SuperForms setup - best practice approach
  const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
    superForm(data.form, {
      validators: zod(accountEditSchema),
      ...getDetailPageFormConfig("Account"),
      onResult: async ({ result }) => {
        if (result.type === "success") {
          await goto('/admin/accounts/accounts');
        }
      }
    });
  
  // Reactive states - using formHelpers pattern
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;
  $: ({ errorMessage } = processFormMessages($message));
  $: hasChanges = $tainted;
  
  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Auto-generate slug when name changes
  $: if ($form.name && (!$form.slug || $form.slug === generateSlug(previousName || ''))) {
    $form.slug = generateSlug($form.name);
    previousName = $form.name;
  }
  
  let previousName = '';
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/accounts'),
        variant: "outline"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/createAccount"]');
          if (form) form.requestSubmit();
        }
      }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <FormContainer
    method="POST"
    action="?/createAccount"
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
      title="Account Information"
      description="Create a new account in the system"
      icon={FileText}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Account Name" 
            error={$errors.name}
            required={true}
            helpText="Enter the official account name"
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter account name" 
              {...getFieldProps($errors, 'name', isLoading)}
            />
          </FormField>
          
          <FormField 
            id="slug" 
            label="Slug" 
            error={$errors.slug}
            required={true}
            helpText="The slug is used in URLs and API endpoints. Only lowercase letters, numbers, and hyphens are allowed."
          >
            <Input 
              id="slug" 
              name="slug" 
              type="text" 
              bind:value={$form.slug} 
              placeholder="account-slug" 
              {...getFieldProps($errors, 'slug', isLoading)}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="status" 
            label="Status" 
            error={$errors.status}
            required={true}
            helpText="Current operational status of the account"
          >
            <EnhancedSelect
              name="status"
              options={ACCOUNT_STATUS_OPTIONS}
              bind:value={$form.status}
              placeholder="Select status"
              {...getSelectProps($errors, 'status', isLoading)}
            />
          </FormField>
        </FormRow>
        
        <FormField 
          id="description" 
          label="Description" 
          error={$errors.description}
          helpText="Optional description of the account's purpose"
        >
          <Textarea 
            id="description" 
            name="description" 
            bind:value={$form.description} 
            placeholder="Enter account description" 
            class="w-full h-24 {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
            disabled={isLoading}
            aria-invalid={$errors.description ? true : undefined}
          />
        </FormField>
      </div>
    </AdminCard>
  </FormContainer>
</AdminPageLayout>
