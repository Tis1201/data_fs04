<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Save, KeyRound, ShieldCheck } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  
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
    successRedirect: '/admin/billing/licenses',
    validateOnInput: true,
    onSuccess: () => {
      toast.success("License created successfully!");
    },
  });

  const algoOptions = [
    { value: 'RS256', label: 'RS256' },
    { value: 'HS256', label: 'HS256' }
  ];
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
      errorMessage={$errorMessage}
    >
      <!-- License Information -->
      <AdminCard
        title="License Details"
        description="Issue a new license"
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
              <Input
                id="deviceId"
                name="deviceId"
                type="text"
                bind:value={$form.deviceId}
                placeholder="Optional device binding"
                aria-invalid={$errors.deviceId ? 'true' : undefined}
                disabled={$submitting}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Optional: bind license to a specific device
              </p>
            </FormField>
          </FormRow>

          <FormRow columns={2}>
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
              />
              <p class="text-xs text-muted-foreground mt-1">
                Date when this license will expire
              </p>
            </FormField>
            
            <FormField id="algorithm" label="Algorithm" error={$errors.algorithm} required={true}>
              <EnhancedSelect
                id="algorithm"
                name="algorithm"
                bind:value={$form.algorithm}
                aria-invalid={$errors.algorithm ? 'true' : undefined}
                options={algoOptions}
                disabled={$submitting}
              />
            </FormField>
          </FormRow>

          <FormRow columns={2}>
            <FormField id="keyId" label="Key ID (kid)" error={$errors.keyId} required={true}>
              <Input
                id="keyId"
                name="keyId"
                type="text"
                bind:value={$form.keyId}
                placeholder="Key identifier"
                aria-invalid={$errors.keyId ? 'true' : undefined}
                disabled={$submitting}
              />
            </FormField>
          </FormRow>

          <FormRow columns={1}>
            <FormField id="jwt" label="JWT" error={$errors.jwt} required={true}>
              <Textarea
                id="jwt"
                name="jwt"
                bind:value={$form.jwt}
                rows={4}
                placeholder="Paste the signed JWT"
                aria-invalid={$errors.jwt ? 'true' : undefined}
                disabled={$submitting}
              />
            </FormField>
          </FormRow>
        </div>
      </AdminCard>
    </FormContainer>
  </div>
</AdminPageLayout>
