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
  
  // State for storing JWT after successful submission
  let createdLicense = null;
  let showDownloadSection = false;

  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
    validateOnInput: true,
    dataType: 'json', // Use JSON data type for consistency with server-side
    onSuccess: (result) => {
      toast.success('License created successfully!');
      
      // Store the license data if available
      if (result.data?.license) {
        createdLicense = result.data.license;
        showDownloadSection = true;
      } else {
        // If no license data, redirect after a delay
        setTimeout(() => {
          goto('/admin/billing/licenses');
        }, 1000);
      }
    }
  });
  
  // Function to download JWT as a file
  function downloadJWT() {
    if (!createdLicense?.jwt) return;
    
    const element = document.createElement('a');
    const file = new Blob([createdLicense.jwt], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `license_${createdLicense.id}.jwt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // Algorithm options
  const algoOptions = [
    { value: 'RS256', label: 'RS256' },
    { value: 'HS256', label: 'HS256' }
  ];
  
  // Device options state
  let deviceOptions = [];
  
  // Handle account change to update device options
  async function handleAccountChange(accountId: string) {
    if (!accountId) {
      deviceOptions = [];
      $form.deviceId = '';
      return;
    }
    
    try {
      // Fetch devices for the selected account
      const response = await fetch(`/api/licenses/devices?accountId=${accountId}`);
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
//   $: if ($form.accountId) {
//     handleAccountChange($form.accountId);
//   }
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
    {#if showDownloadSection && createdLicense}
      <AdminCard title="License Created Successfully" description="Your license has been created and is ready for download" icon={ShieldCheck}>
        <div class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
            <div class="flex items-center">
              <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <p class="font-medium">License created successfully!</p>
            </div>
            <p class="mt-1 ml-7 text-sm">You can download the JWT token below or copy it directly.</p>
          </div>
          <div class="p-4 border rounded-md bg-muted/50">
            <div class="mb-2">
              <span class="font-semibold">License ID:</span> {createdLicense.id}
            </div>
            {#if createdLicense.description}
              <div class="mb-2">
                <span class="font-semibold">Description:</span> {createdLicense.description}
              </div>
            {/if}
            <div class="mb-2">
              <span class="font-semibold">Account:</span> {createdLicense.accountId || 'None'}
            </div>
            <div class="mb-2">
              <span class="font-semibold">Device:</span> {createdLicense.deviceId || 'Any device'}
            </div>
            <div class="mb-2">
              <span class="font-semibold">Expires:</span> {new Date(createdLicense.expiresAt).toLocaleString()}
            </div>
            <div class="mb-4">
              <span class="font-semibold">Algorithm:</span> {createdLicense.algorithm}
            </div>
            
            <div class="flex flex-col space-y-2">
              <div class="font-semibold">JWT Token:</div>
              <div class="p-2 bg-muted rounded-md overflow-x-auto">
                <code class="text-xs break-all">{createdLicense.jwt}</code>
              </div>
              <button 
                type="button" 
                class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-fit"
                on:click={downloadJWT}
              >
                <KeyRound class="mr-2 h-4 w-4" />
                Download JWT
              </button>
            </div>
          </div>
          
          <div class="flex justify-between mt-6">
            <button 
              type="button" 
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              on:click={() => goto('/admin/billing/licenses')}
            >
              <ArrowLeft class="mr-2 h-4 w-4" />
              Back to Licenses
            </button>
            <button 
              type="button" 
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              on:click={() => {
                createdLicense = null;
                showDownloadSection = false;
                $form = data.form.data;
              }}
            >
              Create Another License
            </button>
          </div>
        </div>
      </AdminCard>
    {:else}
      <FormContainer
        method="POST"
        action="?/create"
        enhance={enhance}
        novalidate
        enctype="application/json"
        errorMessage={$errorMessage}
        successMessage={createdLicense ? { text: 'License created successfully!' } : null}
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
                <select
                  id="accountId"
                  name="accountId"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  bind:value={$form.accountId}
                  aria-invalid={$errors.accountId ? 'true' : undefined}
                  placeholder="Select account (optional - defaults to system account)"
                  disabled={$submitting}
                  on:change={(e) => handleAccountChange(e.target.value)}
                >
                  <option value=''>System Account (Default)</option>
                  {#each data.accountOptions as key}
                      <option value={key.value}>{key.label}</option>
                  {/each}
                </select>
                <!-- <EnhancedSelect
                  id="accountId"
                  name="accountId"
                  bind:value={$form.accountId}
                  placeholder="Select account (optional - defaults to system account)"
                  aria-invalid={$errors.accountId ? 'true' : undefined}
                  options={[{ value: '', label: 'System Account (Default)' }, ...data.accountOptions]}
                  disabled={$submitting}
                /> -->
                <p class="text-xs text-muted-foreground mt-1">
                  Select the account for this license
                </p>
              </FormField>
              
              <FormField id="deviceId" label="Device" error={$errors.deviceId}>
                <!-- <EnhancedSelect
                    id="deviceId"
                    name="deviceId"
                    bind:value={$form.deviceId}
                    placeholder="Select a device (optional)"
                    aria-invalid={$errors.deviceId ? 'true' : undefined}
                    options={deviceOptions}
                    disabled={$submitting || !$form.accountId}
                    searchable={true}
                /> -->
                <select
                  id="deviceId"
                  name="deviceId"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  bind:value={$form.deviceId}
                  aria-invalid={$errors.deviceId ? 'true' : undefined}
                  placeholder="Select a device"
                  disabled={$submitting}
                >
                  {#each deviceOptions as key}
                      <option value={key.value}>{key.label}</option>
                  {/each}
                </select>
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

          <FormRow columns={1}>
            <FormField id="description" label="Description" error={$errors.description}>
              <Textarea
                id="description"
                name="description"
                bind:value={$form.description}
                placeholder="Optional description for this license"
                rows={4}
                aria-invalid={$errors.description ? 'true' : undefined}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Provide an optional description for this license
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
    {/if}
  </div>
</AdminPageLayout>
