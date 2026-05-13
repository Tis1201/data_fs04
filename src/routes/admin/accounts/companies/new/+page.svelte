<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, FileText } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Label } from "$lib/components/ui/label";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Company";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", ""],
        ["Companies", "/admin/accounts/companies"],
        "New Company"
    ];
    
    // Import form utilities and schema
    import { getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps } from '$lib/utils/formHelpers';
    import { companySchema } from './company';
    
    // Enhanced SuperForms setup - best practice approach
    const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
        superForm(data.form, {
            validators: zod(companySchema), // Schema validation for proper typing
            validationMethod: 'oninput', // Validate on every input change
            ...getDetailPageFormConfig("Company"), // FormHelpers utilities for consistency
            onResult: async ({ result }) => {
                if (result.type === "success") {
                    // Redirect to companies list on success
                    await goto('/admin/accounts/companies');
                }
            }
        });
    
    // Reactive states - using formHelpers pattern
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;
    
    // Status options for the radio group
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
        { value: "PENDING", label: "Pending" }
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: async () => await goto('/admin/accounts/companies'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9" // Fixed height for consistency
      }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
      <FormContainer
        method="POST"
        action="?/create"
        {enhance}
        novalidate
        {errorMessage}
        showAlerts={true}
        disabled={isLoading}
        {hasTimeout}
        {isLoading}
        delayed={$delayed}
        class="w-full space-y-6"
      >
        <AdminCard
            title="Company Information"
            description="Create a new company in the system"
            icon={FileText}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField 
                        id="name" 
                        label="Company Name" 
                        required={true} 
                        error={$errors.name}
                        helpText="Enter the official company name"
                    >
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="Enter company name"
                            {...getFieldProps($errors, 'name', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="accountId" 
                        label="Account" 
                        required={true} 
                        error={$errors.accountId}
                        helpText="Select the parent account for this company"
                    >
                        <EnhancedSelect
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                            {...getSelectProps($errors, 'accountId', isLoading)}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="status" 
                        label="Status" 
                        required={true} 
                        error={$errors.status}
                        helpText="Set the initial status for the company"
                    >
                        <div class="flex items-center space-x-4 pt-2">
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="status" 
                                    name="status" 
                                    checked={$form.status === 'ACTIVE'}
                                    on:change={(e) => {
                                        $form.status = e.target.checked ? 'ACTIVE' : 'INACTIVE';
                                    }}
                                    disabled={isLoading}
                                    aria-invalid={$errors.status ? true : undefined}
                                    value="ACTIVE"
                                />
                                <label for="status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    Active
                                </label>
                            </div>
                            <div class="text-xs text-muted-foreground">
                                {$form.status === 'ACTIVE' ? 'Company will be active and ready for use' : 'Company will be created in inactive state'}
                            </div>
                        </div>
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Contact Information"
            description="Contact details for the company"
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField 
                        id="address" 
                        label="Address" 
                        error={$errors.address}
                        helpText="Physical address of the company"
                    >
                        <Textarea
                            id="address"
                            name="address"
                            bind:value={$form.address}
                            placeholder="Enter company address"
                            rows="2"
                            class="w-full {$errors.address ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.address ? true : undefined}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={2}>
                    <FormField 
                        id="contactEmail" 
                        label="Contact Email" 
                        required={true} 
                        error={$errors.contactEmail}
                        helpText="Primary email for company communications"
                    >
                        <Input
                            id="contactEmail"
                            name="contactEmail"
                            type="email"
                            bind:value={$form.contactEmail}
                            placeholder="contact@example.com"
                            {...getFieldProps($errors, 'contactEmail', isLoading)}
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
                            {...getFieldProps($errors, 'contactPhone', isLoading)}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Additional Information"
            description="Other details about the company"
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
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
                            rows="3"
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.description ? true : undefined}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
            </FormContainer>
        
</AdminPageLayout>
