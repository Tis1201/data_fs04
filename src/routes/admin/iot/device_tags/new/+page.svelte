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
  const title = "Create Device Tag";
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["IoT", "/admin/iot"],
    ["Device Tags", "/admin/iot/device_tags"],
    "Create Device Tag",
  ];
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.deviceTagForm, {
    successRedirect: '/admin/iot/device_tags',
    validateOnInput: true,
    onSuccess: () => {
      // Toast is handled by the redirect
      toast.success("Device Tag created successfully!");
    },
    // onError: (error) => {
    //   toast.error(error?.text || "Failed to create Device Tag");
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
        onClick: () => goto('/admin/iot/device_tags'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: 'Save',
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/createTag"]');
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
        action="?/createTag"
        {enhance}
        novalidate
        errorMessage={$errorMessage}
      >
        <!-- Basic Tag Information -->
        <AdminCard
          title="Tag Information"
          description="Create a new Device Tag"
          icon={Key}
          compact={true}
        >
          <div class="space-y-6">
            <FormRow columns={2}>
              <FormField id="name" label="Tag Name" error={$errors.name}>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  bind:value={$form.name}
                  placeholder="Enter name"
                  aria-invalid={$errors.name ? 'true' : undefined}
                  disabled={$submitting}
                />
                <p class="text-xs text-muted-foreground mt-1">
                  A friendly name to help identify this Tag
                </p>
              </FormField>
              <FormField id="accountId" label="Account" error={$errors.accountId}>
                <select
                  id="accountId"
                  name="accountId"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  bind:value={$form.accountId}
                  aria-invalid={$errors.accountId ? 'true' : undefined}
                  placeholder="Select account (optional - defaults to system account)"
                  disabled={$submitting}
                >
                  <option value=''>System Account (Default)</option>
                  {#each data.accountOptions as key}
                      <option value={key.value}>{key.label}</option>
                  {/each}
                </select>
                <p class="text-xs text-muted-foreground mt-1">
                  Select the account for this tag
                </p>
              </FormField>
            </FormRow>
            <FormRow columns={1}>
              <FormField id="description" label="Description" error={$errors.description}>
              <Input
                id="description"
                name="description"
                type="text"
                bind:value={$form.description}
                placeholder="Enter description (optional)"
                aria-invalid={$errors.description ? 'true' : undefined}
                disabled={$submitting}
              />
              </FormField>
            </FormRow>
          </div>
        </AdminCard>
      </FormContainer>
    </div>
  </AdminPageLayout>
