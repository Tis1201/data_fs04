<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, CheckCircle } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  
  // Import custom form components
  import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
  import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
  import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
  import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = "Add Account";
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts/accounts"],
    "Add Account",
  ];
  
  // Import the reusable form handler
  import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
    validateOnInput: true,
    debugMode: false,
    successRedirect: '/admin/accounts/accounts',  // Redirect to accounts list
    onSuccess: (result) => {
      toast.success("Account created successfully!");
      // The successRedirect will handle navigation
    },
    onError: (error) => {
      toast.error(error?.text || "Failed to create account");
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
  
  let previousName = '';
</script>

<PageContainer crumbs={pageCrumbs}>
  <PageHeader title={title}>
    <svelte:fragment slot="action">
      <ActionButton
        label="Back to Accounts"
        icon={ArrowLeft}
        href="/admin/accounts/accounts"
        variant="outline"
      />
    </svelte:fragment>
  </PageHeader>

  <PageContent>
    <FormContainer 
      method="POST" 
      action="?/createAccount" 
      {enhance} 
      novalidate 
      errorMessage={$errorMessage}
    >
      <FormCard title="Account Information">
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
        
        <FormActions>
          <Button 
            type="button" 
            variant="outline" 
            on:click={() => goto('/admin/accounts/accounts')}
            disabled={$submitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={$submitting} 
            class="min-w-[120px] relative"
          >
            {#if $submitting}
              <span class="absolute inset-0 flex items-center justify-center">
                <Skeleton class="h-4 w-20" />
              </span>
              <span class="opacity-0">Create Account</span>
            {:else}
              Create Account
            {/if}
          </Button>
        </FormActions>
      </FormCard>
    </FormContainer>
  </PageContent>
</PageContainer>
