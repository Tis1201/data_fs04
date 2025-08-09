<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Save, KeyRound, ShieldCheck } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { onMount } from "svelte";
  
  // Import the correct AdminPageLayout component with actionButtons support
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  
  // Import form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
  
  // Import the reusable form handler
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = "Add License";
  const pageCrumbs = [
    ["Dashboard", "/admin"],
    ["Billing", "/admin/billing"],
    ["Licenses", "/admin/billing/licenses"],
    "Add License",
  ];
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
    validateOnInput: true,
    dataType: 'json', // Use JSON data type for consistency with server-side
    onSuccess: (result) => {
      toast.success('License created successfully!');
      
      // Check if we have a redirect URL in the response
      if (result.data?.redirect) {
        // Wait a moment for the toast to be visible before redirecting
        setTimeout(() => {
          goto(result.data.redirect);
        }, 1000);
      } else {
        // Fallback to default redirect
        setTimeout(() => {
          goto('/admin/billing/licenses');
        }, 1000);
      }
    }
  });

  // Algorithm options
  const algoOptions = [
    { value: 'RS256', label: 'RS256' },
    { value: 'HS256', label: 'HS256' }
  ];
  
  // Device options state
  let deviceOptions = data.deviceOptions || [];
  
  // Handle account change to update device options
  async function handleAccountChange(accountId: string) {
    if (!accountId) {
      deviceOptions = [];
      $form.deviceId = '';
      return;
    }
    
    try {
      // Fetch devices for the selected account
      const response = await fetch(`/admin/billing/licenses/new?accountId=${accountId}`);
      if (response.ok) {
        const result = await response.json();
        deviceOptions = result.deviceOptions || [];
        // Clear device selection when account changes
        $form.deviceId = '';
      } else {
        console.error('Failed to fetch devices for account');
        deviceOptions = [];
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      deviceOptions = [];
    }
  }
  
  // Watch for account changes
  $: if ($form.accountId) {
    handleAccountChange($form.accountId);
  }
</script>

<AdminPageLayout
  {title}
  crumbs={pageCrumbs}
  actionButtons={[
    {
      label: "Cancel",
      icon: ArrowLeft,
      onClick: () => goto('/admin/billing/licenses'),
      variant: "outline",
      class: "h-9" // Fixed height for consistency
    },
    {
      label: 'Save',
      icon: Save,
      onClick: () => {
        const form = document.querySelector('form[action="?/create"]');
        if (form) form.requestSubmit();
      },
      class: "h-9", // Fixed height for consistency
      disabled: $submitting
    }
  ]}
  compact={true}
  contentSpacing="space-y-4"
>
  <div class="w-full space-y-6">
    <FormContainer
      method="POST"
      action="?/create"
      {enhance}
      novalidate
      enctype="application/json"
      errorMessage={$errorMessage}
    >
      <!-- License Information -->
      <AdminCard
        title="License Details"
        description="Issue a new license (technical details are handled automatically)"
        icon={ShieldCheck}
        compact={true}
      >
        <div class="space-y-6">
          <FormRow columns={2}>
            <FormField id="accountId" label="Account" error={$errors.accountId}>
              <EnhancedSelect
                id="accountId"
                name="accountId"
                bind:value={$form.accountId}
                placeholder="Select account (optional - defaults to system account)"
                aria-invalid={$errors.accountId ? 'true' : undefined}
                options={[{ value: '', label: 'System Account (Default)' }, ...data.accountOptions]}
                disabled={$submitting}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Select the account for this license
              </p>
            </FormField>
            
            <FormField id="deviceId" label="Device ID" error={$errors.deviceId}>
              <EnhancedSelect
                id="deviceId"
                name="deviceId"
                bind:value={$form.deviceId}
                placeholder="Select a device (optional)"
                aria-invalid={$errors.deviceId ? 'true' : undefined}
                options={deviceOptions}
                disabled={$submitting || !$form.accountId}
                searchable={true}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Optional: bind license to a specific device (requires account selection)
              </p>
            </FormField>
          </FormRow>

          <FormRow columns={1}>
            <FormField id="expiresAt" label="Expires At" error={$errors.expiresAt} required={true}>
              <EnhancedDatePicker
                form={$form}
                field="expiresAt"
                id="expiresAt"
                name="expiresAt"
                disabled={$submitting}
                timelineOptions="future"
                defaultTimeline="future"
                placeholder="Select expiration date"
                valueAsString={true}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Date when this license will expire
              </p>
            </FormField>
          </FormRow>
          
          <!-- Hidden fields for server-side generation -->
          <input type="hidden" name="algorithm" bind:value={$form.algorithm} />
          <input type="hidden" name="keyId" bind:value={$form.keyId} />
          <!-- JWT is optional in the schema now -->
        </div>
      </AdminCard>
    </FormContainer>
  </div>
</AdminPageLayout>
