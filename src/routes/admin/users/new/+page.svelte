<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Save, User, Copy, Check, Link } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import EnhancedPasswordInput from "$lib/components/ui_components_sveltekit/form/EnhancedPasswordInput.svelte";
  import InvitationLinkDialog from "$lib/components/ui_components_sveltekit/dialog/InvitationLinkDialog.svelte";
  
  // Import the correct AdminPageLayout component with actionButtons support
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  
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
    "New User",
  ];

  // Import the reusable form handler
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";

  // Get the server-generated password from the page data
  let generatedPassword = data.generatedPassword || "";
  
  // Invitation dialog state
  let showInvitationDialog = false;
  let createdUserId = "";
  let createdUserEmail = "";
  let invitationToken = "";
  let invitationTokenExpiry = new Date();

  // Create a form handler with standardized error handling and Sonner notifications
  const {
    form,
    errors,
    enhance,
    submitting,
    constraints,
    errorMessage,
    successMessage,
  } = createFormHandler(data.form, {
    // Don't automatically redirect, we'll handle it after showing the dialog
    validateOnInput: true,
    onSuccess: (result) => {
      // Always prevent automatic redirect
      const redirectFlag = false;
      
      // Check if server returned user data
      if (result?.data) {
        // Store the generated password if available
        if (result.data.generatedPassword) {
          generatedPassword = result.data.generatedPassword;
        }
        
        // Store user data for the invitation dialog
        if (result.data.user && result.data.invitationToken) {
          createdUserId = result.data.user.id;
          createdUserEmail = result.data.user.email;
          
          // Use the server-generated invitation token
          invitationToken = result.data.invitationToken.token;
          invitationTokenExpiry = new Date(result.data.invitationToken.expiresAt);
          
          // Show the invitation dialog
          showInvitationDialog = true;
          
          // Return success message with redirect flag
          return {
            text: "User created successfully",
            redirect: redirectFlag
          };
        }
      }
      
      // Even if we don't show the dialog, prevent redirect
      return {
        text: "User created successfully",
        redirect: redirectFlag
      };
    },
    onError: (error) => ({
      text: error?.message || "Failed to create user",
    }),
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
      onClick: () => goto("/admin/users"),
      variant: "outline",
      class: "h-9",
    },
    {
      label: "Save",
      icon: Save,
      onClick: () => {
        const form = document.querySelector('form[action="?/create"]');
        if (form) form.requestSubmit();
      },
      class: "h-9",
    },
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
    errorMessage={$errorMessage?.text ? { text: $errorMessage.text } : null}
    successMessage={$successMessage?.text
      ? { text: $successMessage.text }
      : null}
    showToasts={true}
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
              aria-invalid={$errors.email ? "true" : undefined}
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
              aria-invalid={$errors.name ? "true" : undefined}
              {...$constraints.name}
            />
          </FormField>
        </FormRow>

        <FormRow columns={2}>
          <FormField id="password" label="Password" error={$errors.password}>
            <EnhancedPasswordInput
              id="password"
              name="password"
              bind:value={$form.password}
              placeholder="Enter password"
              aria-invalid={$errors.password ? "true" : undefined}
              showCopy={true}
              {...$constraints.password}
            />
            <p class="text-xs text-muted-foreground mt-1">A secure password has been generated</p>
          </FormField>

          <FormField id="role" label="Role" error={$errors.role}>
            <EnhancedSelect
              name="role"
              options={roleOptions}
              bind:value={$form.role}
              aria-invalid={$errors.role ? "true" : undefined}
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
              aria-invalid={$errors.status ? "true" : undefined}
              {...$constraints.status}
            />
          </FormField>
        </FormRow>
      </div>
    </AdminCard>
  </FormContainer>
</AdminPageLayout>

<!-- Invitation Link Dialog -->
<InvitationLinkDialog
  bind:open={showInvitationDialog}
  userId={createdUserId}
  userEmail={createdUserEmail}
  invitationToken={invitationToken}
  expiresAt={invitationTokenExpiry}
  onClose={() => {
    // Redirect to users list after closing the dialog
    goto('/admin/users');
  }}
/>
