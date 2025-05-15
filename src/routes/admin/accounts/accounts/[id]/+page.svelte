<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, FileText, ArrowLeft } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  
  // Import custom form components
  import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = `Edit Account: ${data.account.name}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts/accounts"],
    data.account.name,
  ];
  
  // Import the reusable form handler
  import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
    validateOnInput: true,
    debugMode: false,
    successRedirect: '/admin/accounts/accounts',  // Redirect to accounts list
    onSuccess: (result) => {
      toast.success("Account updated successfully!");
      // The successRedirect will handle navigation
    },
    onError: (error) => {
      toast.error(error?.text || "Failed to update account");
    }
  });
  
  // Status options for the select dropdown
  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" }
  ];
  
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
  
  let previousName = data.account.name;
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
          const form = document.querySelector('form[action="?/updateAccount"]');
          if (form) form.requestSubmit();
        }
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <form method="POST" action="?/updateAccount" use:enhance>
    <AdminCard
      title="Account Information"
      description="Edit account details"
      icon={FileText}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Account Name" 
            error={$errors.name}
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter account name" 
              aria-invalid={$errors.name ? 'true' : undefined}
              {...$constraints.name}
            />
          </FormField>
          
          <FormField 
            id="slug" 
            label="Slug" 
            error={$errors.slug}
          >
            <Input 
              id="slug" 
              name="slug" 
              type="text" 
              bind:value={$form.slug} 
              placeholder="account-slug" 
              aria-invalid={$errors.slug ? 'true' : undefined}
              {...$constraints.slug}
            />
            <p class="text-xs text-muted-foreground mt-1">
              The slug is used in URLs and API endpoints. Only lowercase letters, numbers, and hyphens are allowed.
            </p>
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="status" 
            label="Status" 
            error={$errors.status}
          >
            <EnhancedSelect
              name="status"
              options={statusOptions}
              bind:value={$form.status}
              aria-invalid={$errors.status ? 'true' : undefined}
              {...$constraints.status}
            />
          </FormField>
        </FormRow>
        
        <FormField 
          id="description" 
          label="Description" 
          error={$errors.description}
        >
          <Textarea 
            id="description" 
            name="description" 
            bind:value={$form.description} 
            placeholder="Enter account description" 
            class="w-full h-24"
            aria-invalid={$errors.description ? 'true' : undefined}
            {...$constraints.description}
          />
        </FormField>
      </div>
    </AdminCard>
  </form>
</AdminPageLayout>
