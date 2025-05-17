<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, FileText, ArrowLeft } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Switch } from "$lib/components/ui/switch";
  import { Label } from "$lib/components/ui/label";
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  
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
  const title = `Edit Company: ${data.company.name}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts"],
    ["Companies", "/admin/accounts/companies"],
    data.company.name,
  ];
  
  // Import the reusable form handler
  import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
    validateOnInput: true,
    debugMode: false,
    dataType: 'json', // Add this to support complex validation like unions
    onSuccess: (result) => {
      toast.success("Company updated successfully!");
      goto('/admin/accounts/companies'); // Manual navigation instead of successRedirect
    },
    onError: (error) => {
      toast.error(error?.text || "Failed to update company");
    }
  });
  
  // Format account options for the select dropdown
  const accountOptions = data.accounts.map(account => ({
    value: account.id,
    label: account.name
  }));
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/companies'),
        variant: "outline"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateCompany"]');
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
    action="?/updateCompany" 
    {enhance} 
    novalidate 
    errorMessage={$errorMessage}
  >
    <AdminCard
      title="Company Information"
      description="Edit company details"
      icon={FileText}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Company Name" 
            error={$errors.name}
            required={true}
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter company name" 
              aria-invalid={$errors.name ? 'true' : undefined}
              {...$constraints.name}
            />
          </FormField>
          
          <FormField 
            id="status" 
            label="Status" 
            error={$errors.status}
          >
            <EnhancedSelect
              name="status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "PENDING", label: "Pending" }
              ]}
              bind:value={$form.status}
              aria-invalid={$errors.status ? 'true' : undefined}
              {...$constraints.status}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="contactEmail" 
            label="Contact Email" 
            error={$errors.contactEmail}
          >
            <Input 
              id="contactEmail" 
              name="contactEmail" 
              type="email" 
              bind:value={$form.contactEmail} 
              placeholder="contact@example.com" 
              aria-invalid={$errors.contactEmail ? 'true' : undefined}
              {...$constraints.contactEmail}
            />
          </FormField>
          
          <FormField 
            id="contactPhone" 
            label="Contact Phone" 
            error={$errors.contactPhone}
          >
            <Input 
              id="contactPhone" 
              name="contactPhone" 
              type="tel" 
              bind:value={$form.contactPhone} 
              placeholder="+1 (555) 123-4567" 
              aria-invalid={$errors.contactPhone ? 'true' : undefined}
              {...$constraints.contactPhone}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="address" 
            label="Address" 
            error={$errors.address}
          >
            <Input 
              id="address" 
              name="address" 
              type="text" 
              bind:value={$form.address} 
              placeholder="Company address" 
              aria-invalid={$errors.address ? 'true' : undefined}
              {...$constraints.address}
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
              {...$constraints.accountId}
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
            placeholder="Enter company description" 
            class="w-full h-24"
            aria-invalid={$errors.description ? 'true' : undefined}
            {...$constraints.description}
          />
        </FormField>
        
        <FormField 
          id="status" 
          label="Status" 
          error={$errors.status}
        >
          <EnhancedSelect
            name="status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "PENDING", label: "Pending" }
            ]}
            bind:value={$form.status}
            aria-invalid={$errors.status ? 'true' : undefined}
            {...$constraints.status}
          />
        </FormField>
      </div>
    </AdminCard>
  </FormContainer>
</AdminPageLayout>
