<script lang="ts">
    import { page } from "$app/stores";
    import { goto, invalidateAll } from "$app/navigation";
    import { ArrowLeft, User, Mail, Shield, Calendar, Activity, Settings, UserCheck, KeyRound, Save, Building } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import PasswordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte";
    import ResetPasswordDialog from "$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { toast } from "svelte-sonner";
    import { enhance } from '$app/forms';
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import { canPerformAdminActions } from '$lib/utils/permissions';
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    
    
    // Define page metadata
    const pageTitle = `${data.user?.name || data.user?.email || 'User'} - Profile`;
    const pageDescription = `View and manage profile for ${data.user?.name || data.user?.email}`;
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Team Members", "/user/settings/users"],
        [`${data.user?.name || data.user?.email || 'User'}`, ""]
    ] as [string, string][];
    
    // Get status badge class
    function getStatusClass(status: string) {
        switch(status.toLowerCase()) {
            case 'active': return 'bg-green-500';
            case 'inactive': return 'bg-gray-400';
            case 'suspended': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    }
    
    // Get role badge variant
    function getRoleVariant(role: string) {
        switch(role.toUpperCase()) {
            case 'OWNER': return 'default';
            case 'ADMIN': return 'secondary';
            case 'MEMBER': return 'outline';
            default: return 'outline';
        }
    }

    // Check if current user can edit email (only themselves)
    function canEditEmail(): boolean {
        // Only allow self-editing of email, not admin editing other users
        return data.canEdit && data.user?.id === data.currentUserId;
    }

    // Editing states
    let isEditingProfile = false;
    let isEditingRole = false;
    let isLoading = false;
    
    
    // Dialog states
    let passwordUpdateDialogOpen = false;
    let passwordResetConfirmOpen = false;

    // Form data
    let formData = {
        name: data.user?.name || '',
        email: data.user?.email || '',
        accountRole: data.user?.accountRole || 'MEMBER'
    };
    

    // Role options
    const roleOptions = [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MEMBER', label: 'Member' }
    ];

    function startEditingProfile() {
        isEditingProfile = true;
        formData = {
            name: data.user?.name || '',
            email: data.user?.email || '',
            accountRole: data.user?.accountRole || 'MEMBER'
        };
    }

    function startEditingRole() {
        isEditingRole = true;
        formData.accountRole = data.user?.accountRole || 'MEMBER';
    }

    function cancelEditing() {
        isEditingProfile = false;
        isEditingRole = false;
        formData = {
            name: data.user?.name || '',
            email: data.user?.email || '',
            accountRole: data.user?.accountRole || 'MEMBER'
        };
    }

    // Action buttons
    $: actionButtons = [
        {
            label: "Back to Team",
            icon: ArrowLeft,
            onClick: () => goto('/user/settings/users')
        }
    ];
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    {actionButtons}
>
    <div class="space-y-6">
        <!-- Account Context -->
        <UserCard 
            title="Account Context"
            description="Current account and your permissions"
            icon={Building}
            compact={true}
        >
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-medium">{data.currentAccount?.name}</h3>
                    <p class="text-sm text-muted-foreground">Current Account</p>
                </div>
                <Badge variant="outline">
                    Your role: {data.currentAccount?.userRole}
                </Badge>
            </div>
        </UserCard>

        <!-- User Profile Card -->
        <UserCard 
            title="User Profile"
            description="Manage user information and account permissions"
            icon={User}
            compact={true}
        >
            <div class="space-y-6">
                <!-- Profile Information Form -->
                {#if isEditingProfile && data.canEdit}
                    <FormContainer
                        action="?/updateProfile"
                        bind:isLoading
                        enhance={({ formData, cancel }) => {
                            return async ({ result }) => {
                                if (result.type === 'success') {
                                    isEditingProfile = false;
                                    invalidateAll();
                                }
                            };
                        }}
                    >
                        <FormRow columns={2}>
                            <!-- Email -->
                            <FormField
                                id="email"
                                label="Email Address"
                                helpText={canEditEmail() ? "Your login email address" : "Email cannot be changed by admins"}
                            >
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    bind:value={formData.email}
                                    placeholder="Enter email address"
                                    readonly={!canEditEmail()}
                                    class={!canEditEmail() ? "bg-muted/50" : ""}
                                    required
                                />
                            </FormField>
                            
                            <!-- Name -->
                            <FormField
                                id="name"
                                label="Full Name"
                                helpText="User's display name"
                                required={true}
                            >
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    bind:value={formData.name}
                                    placeholder="Enter full name"
                                    required
                                />
                            </FormField>
                        </FormRow>
                        
                        <div class="flex gap-3 pt-4 border-t">
                            <Button type="submit" disabled={isLoading} class="flex items-center gap-2">
                                <Save class="h-4 w-4" />
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                on:click={cancelEditing}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </FormContainer>
                {:else}
                    <!-- Display Mode -->
                    <FormRow columns={2}>
                        <!-- Email Display -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">Email Address</Label>
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-full bg-muted">
                                    <Mail class="h-4 w-4" />
                                </div>
                                <div>
                                    <p class="font-medium">{data.user?.email}</p>
                                    <p class="text-xs text-muted-foreground">Login email</p>
                                </div>
                            </div>
                        </div>

                        <!-- Name Display -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">Full Name</Label>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <div class="p-2 rounded-full bg-muted">
                                        <User class="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p class="font-medium">{data.user?.name || 'Unnamed User'}</p>
                                        <p class="text-xs text-muted-foreground">Display name</p>
                                    </div>
                                </div>
                                {#if data.canEdit}
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        on:click={startEditingProfile}
                                        class="flex items-center gap-2"
                                    >
                                        <Settings class="h-4 w-4" />
                                        Edit Profile
                                    </Button>
                                {/if}
                            </div>
                        </div>
                    </FormRow>
                {/if}
            </div>

            <svelte:fragment slot="footer">
                {#if data.user}
                    <MetadataFooter
                        showBorder={false}
                        layout="compact"
                        items={[
                            {
                                label: "User ID:",
                                value: data.user.id,
                                icon: "id"
                            },
                            {
                                label: "Joined Account:",
                                date: data.user.joinedAt,
                                icon: "calendar"
                            },
                            {
                                label: "Last Updated:",
                                date: data.user.updatedAt,
                                icon: "clock"
                            }
                        ]}
                    />
                {/if}
            </svelte:fragment>
        </UserCard>

        <!-- Account Role & Status Card -->
        <UserCard 
            title="Account Role & Status"
            description="User's role and status in this account"
            icon={Shield}
            compact={true}
        >
            <div class="space-y-6">
                {#if isEditingRole && canPerformAdminActions(data.currentAccount)}
                    <!-- Role Editing Form -->
                    <FormContainer
                        action="?/updateAccountRole"
                        bind:isLoading
                        enhance={({ formData, cancel }) => {
                            return async ({ result }) => {
                                if (result.type === 'success') {
                                    isEditingRole = false;
                                    invalidateAll();
                                } else if (result.type === 'failure') {
                                    // FormContainer will handle error display
                                }
                            };
                        }}
                    >
                        <FormRow>
                            <FormField id="role" label="Account Role">
                                <EnhancedSelect
                                    id="role"
                                    name="role"
                                    bind:value={formData.accountRole}
                                    options={roleOptions}
                                    placeholder="Select role"
                                    disabled={isLoading}
                                />
                            </FormField>
                        </FormRow>
                        
                        <div class="flex items-center gap-2 pt-4">
                            <Button 
                                type="submit" 
                                disabled={isLoading || !formData.accountRole || formData.accountRole === data.user?.accountRole}
                                size="sm"
                            >
                                {isLoading ? 'Updating...' : 'Update Role'}
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                on:click={() => {
                                    isEditingRole = false;
                                    formData.accountRole = data.user?.accountRole || 'MEMBER';
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </FormContainer>
                {:else}
                    <!-- Display Mode -->
                    <FormRow columns={2}>
                        <!-- Account Role -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">Account Role</Label>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <div class="p-2 rounded-full bg-muted">
                                        <Shield class="h-4 w-4" />
                                    </div>
                                    <div>
                                        <Badge variant={getRoleVariant(data.user?.accountRole || 'MEMBER')}>
                                            {data.user?.accountRole || 'MEMBER'}
                                        </Badge>
                                        <p class="text-xs text-muted-foreground mt-1">
                                            Role in {data.currentAccount?.name}
                                        </p>
                                    </div>
                                </div>
                                {#if canPerformAdminActions(data.currentAccount)}
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        on:click={startEditingRole}
                                        class="flex items-center gap-2"
                                    >
                                        <Settings class="h-4 w-4" />
                                        Edit Role
                                    </Button>
                                {/if}
                            </div>
                        </div>

                        <!-- Account Status -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">Account Status</Label>
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-full bg-muted">
                                    <UserCheck class="h-4 w-4" />
                                </div>
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <div class={`w-2 h-2 rounded-full ${getStatusClass(data.user?.status || 'ACTIVE')}`}></div>
                                        <span class="text-sm font-medium">{data.user?.status || 'ACTIVE'}</span>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {data.user?.status === 'ACTIVE' ? 'Active member' : 'Inactive member'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FormRow>
                {/if}
            </div>
        </UserCard>

        <!-- Admin Actions Card -->
        {#if canPerformAdminActions(data.currentAccount)}
            <UserCard 
                title="Admin Actions"
                description="Administrative actions for this user"
                icon={Settings}
                compact={true}
            >
                <div class="flex flex-wrap gap-3">
                    <Button 
                        variant="outline"
                        on:click={() => goto(`/user/settings/users/${data.user?.id}/sessions`)}
                        class="flex items-center gap-2"
                    >
                        <Activity class="h-4 w-4" />
                        View Sessions
                    </Button>
                    
                    <Button 
                        variant="outline"
                        on:click={() => passwordUpdateDialogOpen = true}
                        class="flex items-center gap-2"
                    >
                        <KeyRound class="h-4 w-4" />
                        Update Password
                    </Button>
                    
                    <Button 
                        variant="outline"
                        on:click={() => passwordResetConfirmOpen = true}
                        class="flex items-center gap-2"
                    >
                        <KeyRound class="h-4 w-4" />
                        Reset Password
                    </Button>
                </div>
            </UserCard>
        {/if}
    </div>
</UserPageLayout>

<!-- Password Update Dialog -->
<PasswordUpdateDialog 
    bind:open={passwordUpdateDialogOpen} 
    user={data.user}
    action="?/updatePassword"
/>

<!-- Password Reset Dialog -->
<ResetPasswordDialog
    bind:open={passwordResetConfirmOpen}
    user={data.user}
    action="?/resetPassword"
    onSuccess={() => {
        // Refresh data if needed after password reset
        goto(`/user/settings/users/${data.user?.id}`, { invalidateAll: true });
    }}
/>
