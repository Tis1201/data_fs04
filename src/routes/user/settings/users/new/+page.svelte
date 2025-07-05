<script lang="ts">
  import {goto} from "$app/navigation";
  import {superForm} from 'sveltekit-superforms/client';
  import {toast} from "svelte-sonner";
  import {ArrowLeft, Save, User} from "lucide-svelte";
  import {Input} from "$lib/components/ui/input";
  import EnhancedPasswordInput from "$lib/components/ui_components_sveltekit/form/EnhancedPasswordInput.svelte";

  // Import user layout components
  import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
  import UserCard from "$lib/components/user/layout/UserCard.svelte";

  // Import form components
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";

  import type {PageData} from "./$types";

  export let data: PageData;
  const title = "Add New User";

  // Define breadcrumbs for this page
  const pageCrumbs = [
    ["Dashboard", "/user/dashboard"],
    ["Settings", "/user/settings"],
    ["Users", "/user/settings/users"],
    ["Add User", ""],
  ] as [string, string][];

  // Enhanced SuperForms setup - best practice approach
  const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
    superForm(data.form, {
      onResult: async ({ result }) => {
        if (result.type === "success") {
          toast.success("User added successfully!");
          // Redirect to users list on success
          await goto('/user/settings/users');
        } else if (result.type === "failure") {
          // Show error toast
          const errorData = result.data;
          if (errorData && typeof errorData === 'object' && 'text' in errorData) {
            toast.error(errorData.text || "Failed to add user");
          } else {
            toast.error("Failed to add user");
          }
        }
      }
    });
  
  // Reactive states - using formHelpers pattern
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;
  $: hasChanges = $tainted;

  // Account role options for the select dropdown
  const accountRoleOptions = [
    { value: "MEMBER", label: "Member" },
    { value: "ADMIN", label: "Admin" },
  ];

  // Status options for the select dropdown
  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ];
</script>

<UserPageLayout
  {title}
  crumbs={pageCrumbs}
  actionButtons={[
    {
      label: "Cancel",
      icon: ArrowLeft,
      onClick: () => goto("/user/settings/users"),
      variant: "outline",
    },
    {
      label: "Save",
      icon: Save,
      onClick: () => {
        const form = document.querySelector('form[action="?/create"]');
        if (form && form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      },
    },
  ]}
  loading={isLoading}
  showCreateButton={false}
  compact={true}
  contentSpacing="space-y-4"
>
  <form
    method="POST"
    action="?/create"
    use:enhance
    class="w-full space-y-6"
  >
    <!-- Show error message if there's a general error -->
    {#if $message && $message.type === 'error'}
      <div class="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
        <p class="text-sm font-medium">{$message.text}</p>
        {#if $message.details}
          <p class="text-xs mt-1">{$message.details}</p>
        {/if}
      </div>
    {/if}

    <UserCard
      title="User Information"
      description="Add a new user to your account with the required permissions"
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
            <p class="text-xs text-muted-foreground mt-1">A secure password has been generated</p>
          </FormField>

          <FormField id="accountRole" label="Account Role" error={$errors.accountRole}>
            <EnhancedSelect
              name="accountRole"
              options={accountRoleOptions}
              bind:value={$form.accountRole}
              aria-invalid={$errors.accountRole ? "true" : undefined}
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </FormField>
        </FormRow>
      </div>
    </UserCard>
  </form>
</UserPageLayout> 
