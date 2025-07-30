<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, Users, ArrowLeft, UserPlus, UserMinus, User, Search, Trash } from "lucide-svelte";
  import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
  import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
  import UserSelection from './UserSelection.svelte';
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  
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
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = `Edit Group: ${data.group.name}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Accounts", "/admin/accounts"],
    ["Groups", "/admin/accounts/groups"],
    data.group.name,
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
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  
  // Create a form handler with standardized error handling
  const { form, errors, enhance, submitting, message } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Group updated successfully!");
        goto('/admin/accounts/groups');
      } else if (result.type === 'error') {
        toast.error("Failed to update group");
      }
    }
  });
  
  // Create a form handler for adding users to the group
  const { form: addUserForm, errors: addUserErrors, enhance: addUserEnhance, submitting: addUserSubmitting, message: addUserMessage } = superForm(data.addUserForm, {
    resetForm: true,
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success(result.data?.text || "User added to group successfully!");
        // Close the form
        showAddUserForm = false;
        // Refresh the page to show the updated group members
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
        // Refresh the page to show the updated group members
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to remove user from group");
      }
    } catch (error) {
      toast.error("An error occurred while removing the user");
      console.error(error);
    }
  }
  
  // Format account options for the select dropdown
  const accountOptions = data.accounts.map(account => ({
    value: account.id,
    label: account.name
  }));
  
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
        disabled: $submitting
      },
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/accounts/groups'),
        variant: "outline"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateGroup"]');
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
    action="?/updateGroup" 
    {enhance} 
    novalidate
    errorMessage={$message}
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
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter group name" 
              aria-invalid={$errors.name ? 'true' : undefined}
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
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={1}>
          <FormField 
            id="description" 
            label="Description" 
            error={$errors.description}
          >
            <Textarea 
              id="description" 
              name="description" 
              bind:value={$form.description} 
              placeholder="Enter group description" 
              class="w-full h-24"
              aria-invalid={$errors.description ? 'true' : undefined}
            />
          </FormField>
        </FormRow>
        
        <!-- Permissions field removed as requested -->
      </div>
    </AdminCard>
  </FormContainer>
  
  <!-- User Management Section -->  
  <AdminCard
    title="Group Members"
    description="Manage users in this group"
    icon={User}
    compact={true}
  >

            <div class="mt-4 border rounded-md p-4 bg-card">
              <p class="text-sm text-muted-foreground mb-4">Select a user to add to this group.</p>
              
              <FormContainer 
                method="POST" 
                action="?/addUser" 
                enhance={addUserEnhance} 
                novalidate
                errorMessage={$addUserMessage}
              >
              <div class="space-y-4">
                <FormField 
                  id="membershipId" 
                  label="User" 
                  error={$addUserErrors.membershipId}
                >
                  <div class="space-y-3">
                  <UserSelection
                    users={availableUsers}
                    selectedUser={$addUserForm.membershipId}
                    onSelect={(userId) => { 
                      console.log('Selected user ID:', userId);
                      $addUserForm.membershipId = userId; 
                    }}
                    error={$addUserErrors.membershipId}
                    loading={loading}
                    placeholder="Search users..."
                  />
                  </div>
                  
                  <input type="hidden" name="membershipId" value={$addUserForm.membershipId} />
                  
                  {#if $addUserErrors.membershipId}
                    <p class="text-sm font-medium text-destructive mt-1">{$addUserErrors.membershipId}</p>
                  {/if}
                </FormField>
                
                <div class="flex justify-end space-x-2 mt-4">
                  <Button type="button" variant="outline" on:click={handleDialogClose}>Cancel</Button>
                  <Button type="submit" disabled={!$addUserForm.membershipId || $addUserSubmitting}>
                    {$addUserSubmitting ? 'Adding...' : 'Add User'}
                  </Button>
                </div>
              </div>
            </FormContainer>
            </div>
          
      
      <Separator />
      
      <!-- User List -->
      {#if data.group.members.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          <p>No users in this group yet.</p>
          <p class="text-sm mt-2">Click the "Add User" button to add users to this group.</p>
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
