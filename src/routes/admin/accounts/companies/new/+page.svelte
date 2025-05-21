<script lang="ts">
    import { goto } from "$app/navigation";
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
        ["Accounts", "/admin/accounts"],
        ["Companies", "/admin/accounts/companies"],
        "New Company"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/accounts/companies',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the redirect
        }
    });
    
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
        onClick: () => goto('/admin/accounts/companies'),
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
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
      <FormContainer
        method="POST"
        action="?/create"
        {enhance}
        novalidate
        errorMessage={$errorMessage}
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
                    <FormField id="name" label="Company Name" required={true} error={$errors.name}>
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
                    
                    <FormField id="accountId" label="Account" required={true} error={$errors.accountId}>
                        <EnhancedSelect
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField id="status" label="Status" required={true} error={$errors.status}>
                        <div class="flex items-center space-x-4 pt-2">
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="status" 
                                    name="status" 
                                    checked={$form.status === 'ACTIVE'}
                                    on:change={(e) => {
                                        $form.status = e.target.checked ? 'ACTIVE' : 'INACTIVE';
                                    }}
                                    aria-invalid={$errors.status ? 'true' : undefined}
                                    {...$constraints.status}
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
                    <FormField id="address" label="Address" error={$errors.address}>
                        <Textarea
                            id="address"
                            name="address"
                            bind:value={$form.address}
                            placeholder="Enter company address"
                            rows="2"
                            aria-invalid={$errors.address ? 'true' : undefined}
                            {...$constraints.address}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={2}>
                    <FormField id="contactEmail" label="Contact Email" error={$errors.contactEmail}>
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
                    
                    <FormField id="contactPhone" label="Contact Phone" error={$errors.contactPhone}>
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
            </div>
        </AdminCard>
        
        <AdminCard
            title="Additional Information"
            description="Other details about the company"
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField id="description" label="Description" error={$errors.description}>
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter company description"
                            rows="3"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
            </FormContainer>
        
</AdminPageLayout>
