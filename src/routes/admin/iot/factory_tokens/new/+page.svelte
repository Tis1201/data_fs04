<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Save, Key, Barcode, Tag } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Label } from "$lib/components/ui/label";
  import { writable } from 'svelte/store';
  
  // Import the correct AdminPageLayout component with actionButtons support
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  
  // Import form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
  
  // Import the reusable form handler
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = "Create Factory Token";
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["IoT", "/admin/iot"],
    ["Factory Tokens", "/admin/iot/factory_tokens"],
    "Create Factory Token",
  ];
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.factoryTokenForm, {
    successRedirect: '/admin/iot/factory_tokens',
    validateOnInput: true,
    onSuccess: () => {
      // Toast is handled by the redirect
      toast.success("Factory token created successfully!");
    },
    // onError: (error) => {
    //   toast.error(error?.text || "Failed to create factory token");
    // }
  });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/factory_tokens'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: 'Save',
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/createToken"]');
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
        action="?/createToken"
        {enhance}
        novalidate
        errorMessage={$errorMessage}
      >
        <!-- Basic Token Information -->
        <AdminCard
          title="Token Information"
          description="Create a new factory token for device registration"
          icon={Key}
          compact={true}
        >
          <div class="space-y-6">
            <FormRow columns={2}>
              <FormField id="name" label="Token Name" error={$errors.name}>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  bind:value={$form.name}
                  placeholder="Enter a descriptive name for this token (optional)"
                  aria-invalid={$errors.name ? 'true' : undefined}
                  disabled={$submitting}
                />
                <p class="text-xs text-muted-foreground mt-1">
                  A friendly name to help identify this token
                </p>
              </FormField>
              <FormField id="batchNumber" label="Batch Number" error={$errors.batchNumber}>
                <Input
                  id="batchNumber"
                  name="batchNumber"
                  type="text"
                  bind:value={$form.batchNumber}
                  placeholder="Enter batch number (optional)"
                  aria-invalid={$errors.batchNumber ? 'true' : undefined}
                  disabled={$submitting}
                />
              </FormField>
            </FormRow>
            
            <FormRow columns={2}>
              <FormField id="hardwareModel" label="Hardware Model" error={$errors.hardwareModel} required={true}>
                <Input
                  id="hardwareModel"
                  name="hardwareModel"
                  type="text"
                  bind:value={$form.hardwareModel}
                  placeholder="Enter hardware model"
                  aria-invalid={$errors.hardwareModel ? 'true' : undefined}
                  disabled={$submitting}
                />
              </FormField>
              
              <FormField id="firmwareVersion" label="Firmware Version" error={$errors.firmwareVersion} required={true}>
                <Input
                  id="firmwareVersion"
                  name="firmwareVersion"
                  type="text"
                  bind:value={$form.firmwareVersion}
                  placeholder="Enter firmware version"
                  aria-invalid={$errors.firmwareVersion ? 'true' : undefined}
                  disabled={$submitting}
                />
              </FormField>
            </FormRow>
            
            <FormRow columns={2}>
              <FormField id="factory_signing_key_id" label="Signing Key" error={$errors.factory_signing_key_id} required={true}>
                <select
                  id="factory_signing_key_id"
                  name="factory_signing_key_id"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  bind:value={$form.factory_signing_key_id}
                  aria-invalid={$errors.factory_signing_key_id ? 'true' : undefined}
                  disabled={$submitting}
                >
                  {#if data.signingKeys.length === 0}
                    <option value="" disabled>No signing keys available</option>
                  {:else}
                    {#each data.signingKeys as key}
                      <option value={key.id}>{key.keyId} {key.isPrimary ? '(Primary)' : ''}</option>
                    {/each}
                  {/if}
                </select>
                <p class="text-xs text-muted-foreground mt-1">
                  The signing key used to issue this token
                </p>
              </FormField>
              <FormField id="deviceId" label="Device" error={$errors.deviceId} required={true}>
                <select
                  id="deviceId"
                  name="deviceId"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  bind:value={$form.deviceId}
                  aria-invalid={$errors.deviceId ? 'true' : undefined}
                  disabled={$submitting}
                >
                  {#if data.devices.length === 0}
                    <option value="" disabled>No devices available</option>
                  {:else}
                    {#each data.devices as key}
                      <option value={key.id}>{key.name}</option>
                    {/each}
                  {/if}
                </select>
              </FormField>
            </FormRow>
          </div>
        </AdminCard>
        
        <!-- Token Settings -->
        <AdminCard
          title="Token Settings"
          description="Configure token expiration and additional details"
          icon={Tag}
          compact={true}
        >
          <div class="space-y-6">
            <FormRow columns={1}>
              <FormField id="expiresAt" label="Expiration Date" error={$errors.expiresAt} required={true}>
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
                  Date when this token will expire
                </p>
              </FormField>
            </FormRow>
            
            <FormRow columns={1}>
              <FormField id="notes" label="Notes" error={$errors.notes}>
                <Textarea
                  id="notes"
                  name="notes"
                  bind:value={$form.notes}
                  placeholder="Enter additional notes about this token (optional)"
                  rows={4}
                  disabled={$submitting}
                />
                <p class="text-xs text-muted-foreground mt-1">
                  Add any relevant information about this token or its intended use
                </p>
              </FormField>
            </FormRow>
          </div>
        </AdminCard>
      </FormContainer>
    </div>
  </AdminPageLayout>
