<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Save, Key, Barcode, Tag } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Label } from "$lib/components/ui/label";
  
  // Import the correct AdminPageLayout component with actionButtons support
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  
  // Import form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
  
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
  
  // Initialize the form with the reusable form handler
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.factoryTokenForm, {
    validateOnInput: true,
    onSuccess: (result) => {
      if (result.data.success === true && result.data.factoryToken) {
        createdToken = result.data.factoryToken;
        toast.success("Factory token created successfully!");
      }
    },
    onError: (error) => {
      toast.error(error?.text || "Failed to create factory token");
    }
  });
  
  let createdToken: any = null;
</script>

{#if !createdToken}
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
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/createToken"]');
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
{:else}
  <!-- Success View -->
  <AdminPageLayout
    title="Factory Token Created"
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back to Factory Tokens",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/factory_tokens'),
        variant: "outline",
        class: "h-9"
      }
    ]}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
  >
    <AdminCard
      title="Token Created Successfully"
      description="The factory token has been created and is ready for use"
      icon={Key}
      compact={true}
    >
      <div class="flex flex-col items-center justify-center space-y-6 py-4">
        <div class="flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
          <Key class="h-10 w-10 text-green-600" />
        </div>
        
        <div class="text-center space-y-2">
          <h3 class="text-xl font-semibold">Factory Token Created!</h3>
          <p class="text-muted-foreground">
            The factory token has been successfully created and is ready for use.
          </p>
        </div>
        
        <div class="w-full max-w-md bg-muted/30 rounded-lg p-4 border border-muted">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-sm font-medium">Token ID:</span>
              <span class="text-sm font-mono">{createdToken.tokenId}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm font-medium">Serial Number:</span>
              <span class="text-sm">{createdToken.serialNumber}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm font-medium">Hardware Model:</span>
              <span class="text-sm">{createdToken.hardwareModel}</span>
            </div>
          </div>
        </div>
        
        <div class="flex flex-col sm:flex-row gap-4 w-full max-w-md pt-4">
          <Button
            variant="outline"
            class="w-full"
            on:click={() => createdToken = null}
          >
            Create Another Token
          </Button>
          <Button
            class="w-full"
            on:click={() => goto("/admin/iot/factory_tokens")}
          >
            View All Factory Tokens
          </Button>
        </div>
      </div>
    </AdminCard>
  </AdminPageLayout>
{/if}
