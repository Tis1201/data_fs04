<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, User } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { PasswordInput } from "$lib/components/ui/password-input";
    import { Skeleton } from "$lib/components/ui/skeleton";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create User";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        "New User"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/users',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the success message
        }
    });

    // Role options for the select dropdown
    const roleOptions = [
        { value: "USER", label: "User" },
        { value: "ADMIN", label: "Admin" },
    ];

    // Status options for the select dropdown
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/users'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9"
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
      action="?/create" 
      {enhance} 
      novalidate 
      errorMessage={$errorMessage}
    >
      <AdminCard
        title="User Information"
        description="Create a new user account with the required permissions"
        icon={User}
        compact={true}
      >
        <div class="space-y-6">
          <FormRow columns={2}>
            <FormField id="email" label="Email" error={$errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                bind:value={$form.email}
                placeholder="user@example.com"
                aria-invalid={$errors.email ? 'true' : undefined}
                {...$constraints.email}
              />
            </FormField>

            <FormField id="name" label="Name" error={$errors.name}>
              <Input
                id="name"
                name="name"
                type="text"
                bind:value={$form.name}
                placeholder="John Doe"
                aria-invalid={$errors.name ? 'true' : undefined}
                {...$constraints.name}
              />
            </FormField>
          </FormRow>


          <FormRow columns={2}>
            <FormField id="password" label="Password" error={$errors.password}>
              <PasswordInput
                id="password"
                name="password"
                bind:value={$form.password}
                placeholder="Enter password"
                aria-invalid={$errors.password ? 'true' : undefined}
                {...$constraints.password}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Leave empty to generate a secure temporary password
              </p>
            </FormField>

            <FormField id="role" label="Role" error={$errors.role}>
              <EnhancedSelect
                name="role"
                options={roleOptions}
                bind:value={$form.role}
                aria-invalid={$errors.role ? 'true' : undefined}
                {...$constraints.role}
              />
            </FormField>
          </FormRow>

          <FormRow columns={2}>
            <FormField id="status" label="Status" error={$errors.status}>
              <EnhancedSelect
                name="status"
                options={statusOptions}
                bind:value={$form.status}
                aria-invalid={$errors.status ? 'true' : undefined}
                {...$constraints.status}
              />
            </FormField>
          </FormRow>
        </div>
      </AdminCard>
    </FormContainer>
  </div>
</AdminPageLayout>
