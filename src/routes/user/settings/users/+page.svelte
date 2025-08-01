<script lang="ts">
    import {goto, invalidateAll} from "$app/navigation";
    import {Key, KeyRound, Mail, Pencil, Shield, Trash, User, UserCheck, UserPlus, UserX} from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import {Button} from "$lib/components/ui/button";
    import {Badge} from "$lib/components/ui/badge";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import PasswordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte";
    import ResetPasswordDialog from "$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import {toast} from "svelte-sonner";
    import {canPerformAdminActions} from '$lib/utils/permissions';

    import type {PageData} from "./$types";

    export let data: PageData;
    
    // Define page metadata
    const pageTitle = "Team Members";
    const pageDescription = `Manage team members in ${data.currentAccount?.name || 'your account'} (${data.users?.length || 0} members)`;
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Team Members", ""]
    ] as [string, string][];

    // State for dialogs
    let state = {
        selectedRecord: null as any | null,
        confirmationOpen: false
    };

    // User to be toggled (for status change)
    let userToToggle: any | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // State for password update dialog
    let passwordUpdateDialogOpen = false;
    let userToUpdatePassword: any | null = null;
    
    // State for reset password dialog
    let resetPasswordDialogOpen = false;
    let userToResetPassword: any | null = null;
    
    // Get status badge class
    function getStatusClass(status: string) {
        switch(status.toLowerCase()) {
            case 'active': return 'bg-green-500';
            case 'inactive': return 'bg-gray-400';
            case 'suspended': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    }
    
    // Get role badge variant - now using account roles
    function getRoleVariant(role: string) {
        switch(role.toUpperCase()) {
            case 'OWNER': return 'default';
            case 'ADMIN': return 'secondary';
            case 'MEMBER': return 'outline';
            default: return 'outline';
        }
    }
    
    // Format last active time
    function formatLastActive(date: Date | string | null) {
        if (!date) return 'Never';
        return date;
    }

    // Function to open delete confirmation dialog
    function confirmDelete(user: any) {
        state.selectedRecord = user;
        userToDelete = user; // Store the user separately
        state.confirmationOpen = true;
    }
    
    // Store the user to be deleted separately to avoid state clearing issues
    let userToDelete: any | null = null;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(user: any) {
        userToToggle = user;
        statusToggleDialogOpen = true;
    }
    
    // Function to open password update dialog
    function openPasswordUpdateDialog(user: any) {
        userToUpdatePassword = user;
        passwordUpdateDialogOpen = true;
    }

    // Function to open reset password dialog
    function openResetPasswordDialog(user: any) {
        userToResetPassword = user;
        resetPasswordDialogOpen = true;
    }

    // Generate action items for each user
    function getActionItems(user: any): any[] {
        const actions: any[] = [];

        // View/Edit Profile - always available
        actions.push({
            label: "View Profile",
            icon: Pencil,
            onClick: () => goto(`/user/settings/users/${user.id}`)
        });

        // Admin/Owner only actions
        if (canPerformAdminActions(data.currentAccount)) {
            actions.push({
                label: "View Sessions",
                icon: Key,
                onClick: () => goto(`/user/settings/users/${user.id}/sessions`)
            });

            actions.push({
                label: "Update Password",
                icon: KeyRound,
                onClick: () => openPasswordUpdateDialog(user)
            });

            actions.push({
                label: "Reset Password",
                icon: KeyRound,
                onClick: () => openResetPasswordDialog(user)
            });

            actions.push({
                label: isTogglingStatus && userToToggle?.id === user.id 
                    ? "Updating..." 
                    : (user.status === 'ACTIVE' ? "Deactivate" : "Activate"),
                icon: isTogglingStatus && userToToggle?.id === user.id 
                    ? null 
                    : (user.status === 'ACTIVE' ? UserX : UserCheck),
                onClick: () => prepareToggleStatus(user),
                disabled: isTogglingStatus
            });

            actions.push({
                label: "Remove User",
                icon: Trash,
                onClick: () => confirmDelete(user)
            });
        }

        return actions;
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={canPerformAdminActions(data.currentAccount) ? [
        {
            label: "Add User",
            icon: UserPlus,
            onClick: () => goto('/user/settings/users/new')
        }
    ] : []}
>
    <UserCard 
        title="Team Members"
        description={`Manage team members in ${data.currentAccount?.name || 'your account'} (${data.users?.length || 0} members)`}
        icon={Shield}
    >
        <div class="space-y-4">
            <!-- Account info -->
            {#if data.currentAccount}
                <div class="bg-muted/30 rounded-lg p-4 border">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-medium">Current Account</h3>
                            <p class="text-sm text-muted-foreground">{data.currentAccount.name}</p>
                        </div>
                        <Badge variant="outline">
                            Your role: {data.currentAccount.userRole}
                        </Badge>
                    </div>
                </div>
            {/if}

            <!-- Users table -->
            <div class="rounded-md border overflow-hidden">
                {#if data.users && data.users.length > 0}
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-muted/50">
                                    <th class="text-left p-3 font-medium">User</th>
                                    <th class="text-left p-3 font-medium">Email</th>
                                    <th class="text-left p-3 font-medium">Account Role</th>
                                    <th class="text-left p-3 font-medium">System Role</th>
                                    <th class="text-left p-3 font-medium">Status</th>
                                    <th class="text-left p-3 font-medium">Joined</th>
                                    <th class="text-left p-3 font-medium">Sessions</th>
                                    <th class="text-right p-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                {#each data.users as user}
                                    <tr class="hover:bg-muted/50">
                                        <td class="p-3 whitespace-nowrap">
                                            <div class="flex items-center">
                                                <div class="p-2 rounded-full bg-muted mr-3">
                                                    <User class="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p class="font-medium">{user.name || 'Unnamed User'}</p>
                                                    <p class="text-xs text-muted-foreground">ID: {user.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="p-3 whitespace-nowrap">
                                            <div class="flex items-center">
                                                <Mail class="h-4 w-4 mr-2 text-muted-foreground" />
                                                {user.email}
                                            </div>
                                        </td>
                                        <td class="p-3 whitespace-nowrap">
                                            <Badge variant={getRoleVariant(user.role || 'MEMBER')}>
                                                {user.role || 'MEMBER'}
                                            </Badge>
                                        </td>
                                        <td class="p-3 whitespace-nowrap">
                                            <Badge variant="outline" class="text-xs">
                                                {user.systemRole || 'USER'}
                                            </Badge>
                                        </td>
                                        <td class="p-3 whitespace-nowrap">
                                            <div class="flex items-center">
                                                <span class={`h-2 w-2 rounded-full mr-2 ${getStatusClass(user.status || 'inactive')}`}></span>
                                                <span>{(user.status || 'inactive').charAt(0).toUpperCase() + (user.status || 'inactive').slice(1)}</span>
                                            </div>
                                        </td>
                                        <td class="p-3 whitespace-nowrap text-muted-foreground">
                                            {#if user.joinedAt}
                                                <RelativeDate date={user.joinedAt} format="relative" />
                                            {:else}
                                                Unknown
                                            {/if}
                                        </td>
                                        <td class="p-3 whitespace-nowrap text-muted-foreground">
                                            {user.activeSessionsCount || 0}
                                        </td>
                                        <td class="p-3 whitespace-nowrap text-right">
                                            <RecordActions items={getActionItems(user)} />
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <div class="text-center p-8 text-muted-foreground">
                        <User class="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p class="font-medium">No team members found</p>
                        <p class="text-sm mt-1">No users are currently members of this account</p>
                        <Button class="mt-4" on:click={() => goto('/user/settings/users/new')}>
                            <UserPlus class="h-4 w-4 mr-2" />
                            Invite Team Member
                        </Button>
                    </div>
                {/if}
            </div>
            
            <!-- Statistics -->
            {#if data.users && data.users.length > 0}
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-muted/50 rounded-lg p-4">
                        <p class="text-sm text-muted-foreground">Total Members</p>
                        <p class="text-2xl font-bold">{data.users.length}</p>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-4">
                        <p class="text-sm text-muted-foreground">Active Members</p>
                        <p class="text-2xl font-bold text-green-600">
                            {data.users.filter(u => u.status === 'ACTIVE').length}
                        </p>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-4">
                        <p class="text-sm text-muted-foreground">Admins</p>
                        <p class="text-2xl font-bold text-blue-600">
                            {data.users.filter(u => u.role === 'ADMIN').length}
                        </p>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-4">
                        <p class="text-sm text-muted-foreground">Active Sessions</p>
                        <p class="text-2xl font-bold">
                            {data.users.reduce((sum, u) => sum + (u.activeSessionsCount || 0), 0)}
                        </p>
                    </div>
                </div>
            {/if}
            
            <!-- Help text -->
            <p class="text-sm text-muted-foreground">
                These are users who are members of {data.currentAccount?.name || 'your current account'}. 
                <a href="/user/help/permissions" class="text-primary hover:underline">Learn about account permissions</a>
            </p>
        </div>
    </UserCard>

    <!-- Password Update Dialog -->
    <PasswordUpdateDialog
        bind:open={passwordUpdateDialogOpen}
        bind:user={userToUpdatePassword}
        action="?/updatePassword"
        onSuccess={() => {
            passwordUpdateDialogOpen = false;
            userToUpdatePassword = null;
        }}
    />
    
    <!-- Reset Password Dialog -->
    <ResetPasswordDialog
        bind:open={resetPasswordDialogOpen}
        user={userToResetPassword}
        action="?/resetPassword"
        onSuccess={() => {
            resetPasswordDialogOpen = false;
            userToResetPassword = null;
            invalidateAll();
        }}
    />
    
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        actionName="removeFromAccount"
        useFormSubmission={false}
        onConfirm={async () => {
            // Handle user removal from account
            if (userToDelete) {
                try {
                    const formData = new FormData();
                    formData.append('userId', userToDelete.id);
                    
                    const response = await fetch('?/removeFromAccount', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    console.log("result", result);
                    console.log("result.type", result.type);
                    console.log("userToDelete", userToDelete);
                    if (result.type === 'success') {
                        console.log("result.type", result.type);
                        toast.success(`${userToDelete.name || userToDelete.email} removed from account`);
                        state.confirmationOpen = false;
                        state.selectedRecord = null;
                        userToDelete = null;
                        invalidateAll();
                    } else {
                        toast.error(result.message || 'Failed to remove user from account');
                    }
                } catch (error) {
                    console.log("error", error);
                    toast.error('Failed to remove user from account');
                }
            }
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/updateUserStatus"
        bind:record={userToToggle}
        bind:isProcessing={isTogglingStatus}
        title={userToToggle ? (userToToggle.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User') : null}
        description={userToToggle ? `Are you sure you want to ${userToToggle.status === 'ACTIVE' ? 'deactivate' : 'activate'} ${userToToggle.name || userToToggle.email}?` : null}
        confirmText={userToToggle ? (userToToggle.status === 'ACTIVE' ? 'Deactivate' : 'Activate') : null}
        onSuccess={(result) => {
            if (userToToggle) {
                const newStatus = userToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                userToToggle = null;
                statusToggleDialogOpen = false;
                invalidateAll();
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update user status: ${result.data?.error || 'Unknown error'}`);
            userToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="userId" value={userToToggle?.id || ''} />
        <input type="hidden" name="status" value={userToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
</UserPageLayout>
