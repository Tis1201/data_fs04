<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, FileText, ArrowLeft, Building, Trash } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import { superForm } from 'sveltekit-superforms/client';
  import { zod } from 'sveltekit-superforms/adapters';
  import { z } from 'zod';
  import { validatePhoneNumber, getPhoneValidationMessage } from '$lib/utils/validation/phone';
  import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
  
  // Import custom form components
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import RelationshipSection from "$lib/components/ui_components_sveltekit/relationships/RelationshipSection.svelte";
  import { Users } from "lucide-svelte";
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

  // State for delete confirmation dialog
  let deleteState = {
    selectedRecord: null as typeof data.company | null,
    confirmationOpen: false
  };

  // Function to open delete confirmation dialog
  function confirmDelete() {
    deleteState.selectedRecord = data.company;
    deleteState.confirmationOpen = true;
  }
  
  // Define the same schema as the server for client-side validation
  const companySchema = z.object({
    name: z.string()
      .min(2, { message: "Name must be at least 2 characters" })
      .max(100, { message: "Name must be less than 100 characters" }),
    status: z.enum(["ACTIVE", "INACTIVE", "PENDING"]).default("ACTIVE"),
    address: z.string().optional(),
    contactEmail: z.string()
      .min(1, { message: "Contact email is required" })
      .email({ message: "Invalid email address" }),
    contactPhone: z.string()
      .refine(validatePhoneNumber, { message: getPhoneValidationMessage() })
      .optional(),
    description: z.string().optional(),
    accountId: z.string().min(1, { message: "Account is required" })
  });
  
  // Use standard SuperForms approach with comprehensive error handling
  const { form, errors, enhance, submitting, message, delayed, timeout } = superForm(data.form, {
    validators: zod(companySchema), // Add client-side validation
    taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
    invalidateAll: false, // Prevent automatic invalidation
    resetForm: false, // Don't reset the form after submission
    validationMethod: 'oninput', // Validate on every input change
    delayMs: 500, // Show loading state after 500ms
    timeoutMs: 8000, // Timeout after 8 seconds
    
    onResult: async ({ result }) => {
      if (result.type === "success") {
        // Show success message
        toast.success("Company updated successfully!", {
          description: "All changes have been saved.",
          duration: 4000
        });
        
        // Manually invalidate to get fresh data
        await invalidate();
      } else if (result.type === "failure") {
        // Handle form validation errors
        if (result.data?.form?.message) {
          toast.error("Validation Error", {
            description: result.data.form.message.text || "Please check your input and try again.",
            duration: 6000
          });
        } else {
          toast.error("Failed to update company", {
            description: "Please check your input and try again.",
            duration: 6000
          });
        }
      } else if (result.type === "error") {
        // Handle server errors
        toast.error("Server Error", {
          description: "An unexpected error occurred. Please try again later.",
          duration: 6000
        });
      }
    },
    
    onError: ({ result }) => {
      console.error("Form submission error:", result);
      toast.error("Connection Error", {
        description: "Unable to connect to the server. Please check your connection and try again.",
        duration: 6000
      });
    },
    
    onSubmit: ({ formData, cancel }) => {
      // Optional: Add pre-submission validation or data manipulation
      console.log("Form submitting with data:", Object.fromEntries(formData));
    },
    
    onUpdate: ({ form }) => {
      // Clear previous error messages when user starts typing
      if (form.valid) {
        // Optional: Clear any persistent error messages
      }
    }
  });

  // Enhanced message handling for FormContainer (only errors, success uses toast)
  $: errorMessage = $message?.type === 'error' ? { 
    text: $message.text || 'An error occurred',
    details: $message.details,
    code: $message.code 
  } : null;
  
  // Loading state management
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;
  
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
        label: "Delete",
        icon: Trash,
        onClick: confirmDelete,
        variant: "destructive",
        disabled: isLoading
      },
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/companies'),
        variant: "outline",
        disabled: isLoading
      },
      {
        label: isLoading ? ($delayed ? "Saving..." : "Processing...") : "Save Changes",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateCompany"]');
          if (form) form.requestSubmit();
        },
        disabled: isLoading,
        loading: isLoading
      }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <FormContainer 
    method="POST" 
    action="?/updateCompany" 
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
      title="Company Information"
      description="Edit company details"
      icon={Building}
      compact={true}
      class="relative"
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Company Name" 
            error={$errors.name}
            required={true}
            helpText="Enter the official company name"
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter company name" 
              disabled={isLoading}
              aria-invalid={$errors.name ? 'true' : undefined}
              class={$errors.name ? 'border-destructive focus:border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            id="status" 
            label="Status" 
            error={$errors.status}
            required={true}
            helpText="Current operational status of the company"
          >
            <EnhancedSelect
              name="status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "PENDING", label: "Pending" }
              ]}
              bind:value={$form.status}
              disabled={isLoading}
              placeholder="Select status"
              aria-invalid={$errors.status ? 'true' : undefined}
              className={$errors.status ? 'border-destructive' : ''}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="contactEmail" 
            label="Contact Email" 
            error={$errors.contactEmail}
            required={true}
            helpText="Primary email for company communications"
          >
            <Input 
              id="contactEmail" 
              name="contactEmail" 
              type="email" 
              bind:value={$form.contactEmail} 
              placeholder="contact@example.com" 
              disabled={isLoading}
              aria-invalid={$errors.contactEmail ? 'true' : undefined}
              class={$errors.contactEmail ? 'border-destructive focus:border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            id="contactPhone" 
            label="Contact Phone" 
            error={$errors.contactPhone}
            helpText="Primary phone number for company contact"
          >
            <Input 
              id="contactPhone" 
              name="contactPhone" 
              type="tel" 
              bind:value={$form.contactPhone} 
              placeholder="+1 (555) 123-4567" 
              disabled={isLoading}
              aria-invalid={$errors.contactPhone ? 'true' : undefined}
              class={$errors.contactPhone ? 'border-destructive focus:border-destructive' : ''}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="address" 
            label="Address" 
            error={$errors.address}
            helpText="Physical address of the company"
          >
            <Input 
              id="address" 
              name="address" 
              type="text" 
              bind:value={$form.address} 
              placeholder="Company address" 
              disabled={isLoading}
              aria-invalid={$errors.address ? 'true' : undefined}
              class={$errors.address ? 'border-destructive focus:border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            id="accountId" 
            label="Account" 
            error={$errors.accountId}
            required={true}
            helpText="Parent account this company belongs to"
          >
            <EnhancedSelect
              name="accountId"
              options={accountOptions}
              bind:value={$form.accountId}
              placeholder="Select an account"
              disabled={isLoading}
              aria-invalid={$errors.accountId ? 'true' : undefined}
              className={$errors.accountId ? 'border-destructive' : ''}
            />
          </FormField>
        </FormRow>
        
        <FormField 
          id="description" 
          label="Description" 
          error={$errors.description}
          helpText="Optional description of the company's business or purpose"
        >
          <Textarea 
            id="description" 
            name="description" 
            bind:value={$form.description} 
            placeholder="Enter company description" 
            disabled={isLoading}
            class="w-full h-24 {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
            aria-invalid={$errors.description ? 'true' : undefined}
          />
        </FormField>
      </div>
    </AdminCard>
  </FormContainer>
  
  <!-- Account Members Section -->
  <RelationshipSection
    title="Account Members"
    description="Users who are members of the same account as this company"
    icon={Users}
    relationships={data.members}
    availableItems={[]} 
    relationshipType="members"
    canAdd={false}
    canRemove={true}
    viewUrl="/admin/users"
    addAction=""
    removeAction="?/removeMember"
    loading={false}
    multiSelect={true}
  />
</AdminPageLayout>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
  state={deleteState}
  action="?/deleteCompany"
  actionName="deleteCompany"
  onConfirm={() => {
    // Navigate back to companies list after successful deletion
    goto('/admin/accounts/companies');
  }}
/>
