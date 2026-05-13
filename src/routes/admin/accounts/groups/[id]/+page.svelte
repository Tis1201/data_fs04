<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, Users, ArrowLeft, UserPlus, UserMinus, User, Search, Trash } from "lucide-svelte";
  import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
  import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
  import UserSelection from './UserSelection.svelte';
  import PermissionsCheckboxes from './PermissionsCheckboxes.svelte';
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import { Shield } from "lucide-svelte";
  
  // Import custom form components
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import type { PageData } from "./$types";
  import { truncateText } from "$lib/utils/text-utils";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = `Edit Group: ${truncateText(data.group.name, 40)}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts"],
    ["Groups", "/admin/accounts/groups"],
    truncateText(data.group.name, 40),
  ];

  // State for delete confirmation dialog
  let deleteState = {
    selectedRecord: null as typeof data.group | null,
    confirmationOpen: false
  };

  // Function to open delete confirmation dialog
  function confirmDelete() {
    deleteState.selectedRecord = data.group;
    deleteState.confirmationOpen = true;
  }
  
  // Import superForm directly
  import { superForm } from 'sveltekit-superforms/client';
  import { zod } from 'sveltekit-superforms/adapters';
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  import { groupSchema } from '../new/group';
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, message, delayed, timeout } = superForm(data.form, {
    validators: zod(groupSchema),
    taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
    invalidateAll: false, // Prevent automatic invalidation
    resetForm: false, // Don't reset the form after submission
    delayMs: 500,
    timeoutMs: 8000,
    
    onResult: async ({ result }) => {
      if (result.type === 'success') {
        toast.success("Group updated successfully!", {
          description: "All changes have been saved.",
          duration: 4000
        });
        
        // Manually invalidate to get fresh data without page reload
        window.location.reload();
      } else if (result.type === 'failure') {
        if (result.data?.form?.message) {
          toast.error("Validation Error", {
            description: result.data.form.message.text || "Please check your input and try again.",
            duration: 6000
          });
        } else {
          toast.error("Failed to update group", {
            description: "Please check your input and try again.",
            duration: 6000
          });
        }
      } else if (result.type === 'error') {
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
    }
  });
  
  // Create a form handler for adding users to the group
  const { form: addUserForm, errors: addUserErrors, enhance: addUserEnhance, submitting: addUserSubmitting, message: addUserMessage } = superForm(data.addUserForm, {
    resetForm: true,
    validators: false, // Disable automatic validation
    validationMethod: 'submit-only', // Only validate on submit
    taintedMessage: null,
    invalidateAll: false,
    onResult: async ({ result }) => {
      if (result.type === 'success') {
        toast.success(result.data?.text || "User added to group successfully!");
        // Close the form
        showAddUserForm = false;
        // Refresh the page to show updated data
        window.location.reload();
      } else if (result.type === 'error') {
        toast.error(result.data?.text || "Failed to add user to group");
      }
    }
  });
  
  // Function to handle user removal
  async function removeUser(membershipId: string, userName: string) {
    if (!confirm(`Are you sure you want to remove ${userName} from this group?`)) {
      return;
    }
    
    const formData = new FormData();
    formData.append('membershipId', membershipId);
    
    try {
      const response = await fetch(`?/removeUser`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message || "User removed from group successfully!");
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to remove user from group");
      }
    } catch (error) {
      toast.error("An error occurred while removing the user");
      console.error(error);
    }
  }
  
  // Loading state management
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;
  
  // Format account options for the select dropdown
  const accountOptions = data.accounts.map(account => ({
    value: account.id,
    label: account.name
  }));
  
  // Initialize permissions and groupRole from data
  // Note: We use a function to ensure we get a fresh copy when data changes from server
  // but we don't automatically reset while user is editing
  function initializePermissions(serverData: typeof data) {
    return { ...serverData.permissionMap };
  }
  
  let permissions = initializePermissions(data);
  let groupRole = data.groupRole || 'ADMIN'; // Default to ADMIN if not set
  
  // Only reset permissions when explicitly invalidated (after save)
  // Track if we're currently saving to know when to reload
  let lastDataUpdate = data;
  $: if (data !== lastDataUpdate) {
    permissions = initializePermissions(data);
    groupRole = data.groupRole || 'ADMIN';
    lastDataUpdate = data;
  }
  
  // Function to save permissions
  async function savePermissions() {
    const formData = new FormData();
    formData.append('permissions', JSON.stringify(permissions));
    formData.append('groupRole', groupRole);
    
    try {
      const response = await fetch('?/updatePermissions', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok && result?.type === 'success') {
        toast.success("Permissions updated successfully!");
        await invalidate(); // Refresh data
      } else {
        // Extract error message from result
        const errorMessage = result?.data?.error || result?.error || "Failed to update permissions";
        toast.error("Failed to update permissions", {
          description: errorMessage,
          duration: 6000
        });
      }
    } catch (error) {
      toast.error("An error occurred while updating permissions", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000
      });
    }
  }
  
  // Show add user form state
  let showAddUserForm = false;
  
  // Filter out users who are already in the group
  $: availableUsers = (data.accountMembers || []).filter(member => {
    // If the user has no group memberships for this group, they are available to add
    return member.groupMemberships.length === 0;
  });
  
  // Loading state
  let loading = false;
  
  // Handle form submission
  function handleAddUser() {
    if ($addUserForm.membershipId) {
      const form = document.querySelector('form[action="?/addUser"]');
      if (form) {
        form.requestSubmit();
        showAddUserForm = false; // Close the form after submission
      }
    }
    return false; // Return false to keep the dialog open
  }
  
  // Reset form when dialog is closed
  function handleDialogClose() {
    showAddUserForm = false;
    $addUserForm.membershipId = '';
  }
  
  // Open the form
  function handleOpenForm() {
    showAddUserForm = true;
    $addUserForm.membershipId = '';
  }
</script>

<div class="w-full space-y-6">
<!-- Using FormContainer's built-in error handling -->
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
        onClick: () => goto('/admin/accounts/groups'),
        variant: "outline",
        disabled: isLoading
      },
      {
        label: isLoading ? ($delayed ? "Saving..." : "Processing...") : "Save Changes",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateGroup"]');
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
    action="?/updateGroup" 
    {enhance} 
    novalidate
    errorMessage={$message?.type === 'error' ? $message : null}
    showAlerts={true}
    disabled={isLoading}
    {hasTimeout}
    {isLoading}
    delayed={$delayed}
  >
    <AdminCard
      title="Group Information"
      description="Edit group details"
      icon={Users}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Group Name" 
            error={$errors.name}
            required={true}
            helpText="Enter a unique name for the group"
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter group name" 
              disabled={isLoading}
              aria-invalid={$errors.name ? 'true' : undefined}
              class={$errors.name ? 'border-destructive focus:border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            id="accountId" 
            label="Account" 
            error={$errors.accountId}
            required={true}
            helpText="Select the parent account for this group"
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
        
        <FormRow columns={1}>
          <FormField 
            id="description" 
            label="Description" 
            error={$errors.description}
            helpText="Optional description of the group's purpose"
          >
            <Textarea 
              id="description" 
              name="description" 
              bind:value={$form.description} 
              placeholder="Enter group description" 
              disabled={isLoading}
              class="w-full h-24 {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
              aria-invalid={$errors.description ? 'true' : undefined}
            />
          </FormField>
        </FormRow>
        
      </div>
    </AdminCard>
  </FormContainer>
  
  <!-- Permissions Section -->
  <AdminCard
    title="Group Permissions"
    description="Configure what members of this group can access and manage"
    icon={Shield}
    compact={true}
  >
    <PermissionsCheckboxes 
      bind:permissions 
      bind:groupRole 
      disabled={isLoading}
      onSave={savePermissions}
      {isLoading}
    />
    
    <!-- Save Button - Bottom -->
    <div class="flex justify-end mt-6 pt-4 border-t">
      <Button 
        on:click={savePermissions} 
        disabled={isLoading}
        type="button"
        class="min-w-[180px]"
      >
        <Shield class="h-4 w-4 mr-2" />
        {isLoading ? 'Saving...' : 'Save Permissions'}
      </Button>
    </div>
  </AdminCard>
  
  <!-- User Management Section -->  
  <AdminCard
    title="Group Members"
    description="Manage users in this group"
    icon={User}
    compact={true}
  >
    {#if !showAddUserForm}
      <div class="mb-4 flex flex-col items-center">
        <Button 
          type="button" 
          on:click={handleOpenForm}
          disabled={availableUsers.length === 0}
          size="default"
        >
          <UserPlus class="h-4 w-4 mr-2" />
          Add User to Group
        </Button>
        {#if availableUsers.length === 0}
          <p class="text-sm text-muted-foreground mt-2 text-center">No users available to add. All users in this account are already in the group.</p>
        {/if}
      </div>
    {/if}

    {#if showAddUserForm}
      <div class="mt-4 border rounded-md p-4 bg-card">
        <p class="text-sm text-muted-foreground mb-4">Select a user to add to this group.</p>
        
        <FormContainer 
          method="POST" 
          action="?/addUser" 
          enhance={addUserEnhance} 
          novalidate
          errorMessage={$addUserMessage}
        >
        <div class="space-y-6">
          <FormField 
            id="membershipId" 
            label="User"
          >
            <UserSelection
              users={availableUsers}
              selectedUser={$addUserForm.membershipId}
              onSelect={(userId) => { 
                $addUserForm.membershipId = userId; 
              }}
              loading={loading}
              placeholder="Search users..."
            />
            
            <input type="hidden" name="membershipId" value={$addUserForm.membershipId} />
          </FormField>
          
          <div class="flex justify-center gap-3 mt-6">
            <Button type="button" variant="outline" on:click={handleDialogClose} size="lg" class="min-w-[140px]">
              Cancel
            </Button>
            <Button type="submit" disabled={!$addUserForm.membershipId || $addUserSubmitting} size="lg" class="min-w-[140px]">
              <UserPlus class="h-4 w-4 mr-2" />
              {$addUserSubmitting ? 'Adding...' : 'Add User'}
            </Button>
          </div>
        </div>
      </FormContainer>
      </div>
    {/if}
      
    <Separator class="my-4" />
      
      <!-- User List -->
      {#if data.group.members.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          <p>No users in this group yet.</p>
          {#if availableUsers.length > 0}
            <p class="text-sm mt-2">Click the "Add User to Group" button above to add users to this group.</p>
          {:else}
            <p class="text-sm mt-2">All users in this account are already in the group, or no users exist.</p>
          {/if}
        </div>
      {:else}
        <div class="space-y-2">
          {#each data.group.members as membership}
            <div class="flex items-center justify-between p-3 bg-card border rounded-md">
              <div class="flex items-center gap-3">
                <div class="bg-muted p-2 rounded-full">
                  <User class="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p class="font-medium">
                    {membership.membership.user.name || 'Unnamed User'}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {membership.membership.user.email}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                class="text-destructive hover:text-destructive hover:bg-destructive/10"
                on:click={() => removeUser(membership.membershipId, membership.membership.user.name || membership.membership.user.email)}
              >
                <UserMinus class="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          {/each}
        </div>
      {/if}
    
  </AdminCard>
</AdminPageLayout>
</div>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
  state={deleteState}
  action="?/deleteGroup"
  actionName="deleteGroup"
  onConfirm={() => {
    // Navigate back to groups list after successful deletion
    goto('/admin/accounts/groups');
  }}
/>
