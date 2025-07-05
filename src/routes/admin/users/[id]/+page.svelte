<script lang="ts">
    import {goto} from "$app/navigation";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    import {toast} from "svelte-sonner";
    import {ArrowLeft, Save, ShieldCheck, User, Building, KeyRound} from "lucide-svelte";
    import {Input} from "$lib/components/ui/input";
    import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";

    // Import custom form components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import SearchableFormSelect from "$lib/components/ui_components_sveltekit/form/SearchableFormSelect.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import PasswordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte";
    import ResetPasswordDialog from "$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    import RelationshipSection from "$lib/components/ui_components_sveltekit/relationships/RelationshipSection.svelte";

    // Import form utilities and schema
    import {getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps} from "$lib/utils/formHelpers";
    import { userEditSchema, SYSTEM_ROLES, USER_STATUSES } from "./schema";

    import type {PageData} from "./$types";

    // Import page data
    export let data: PageData;
    const { user, meta, accounts = [], relationships, availableAccounts } = data;
    
    // Page configuration
    const entityName = "User";
    const listUrl = "/admin/users";
    const formAction = "?/update";
    
    // Page title and breadcrumbs
    const title = `Edit ${entityName}: ${user?.email || 'User Details'}`;
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", listUrl],
        user?.email || "Edit User"
    ];
    
    // Enhanced SuperForms setup - best practice approach
    const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
        superForm(data.form, {
            validators: zod(userEditSchema), // Schema validation for proper typing
            ...getDetailPageFormConfig(entityName) // FormHelpers utilities for consistency
        });

    // Reactive states - using formHelpers pattern
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    // State for password update dialog
    let passwordUpdateDialogOpen = false;
    let passwordResetConfirmOpen = false;

    // Custom action buttons (including password reset)
    $: actionButtons = [
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: async () => await goto(listUrl),
            variant: "outline" as const,
            disabled: isLoading
        },
        {
            label: "Update Password",
            icon: ShieldCheck,
            onClick: () => passwordUpdateDialogOpen = true,
            variant: "outline" as const,
            disabled: isLoading
        },
        {
            label: "Reset Password",
            icon: KeyRound,
            onClick: () => passwordResetConfirmOpen = true,
            variant: "outline" as const,
            disabled: isLoading
        },
        {
            label: isLoading ? ($delayed ? "Saving..." : "Processing...") : "Save Changes",
            icon: Save,
            onClick: () => {
                const form = document.querySelector(`form[action="${formAction}"]`);
                if (form) (form as HTMLFormElement).requestSubmit();
            },
            disabled: isLoading || !hasChanges,
            loading: isLoading
        }
    ];
    
    // Format account options for the dropdown
    const accountOptions = (accounts || []).map(account => ({
        value: account.id,
        label: account.name
    }));
    
    // Format status options for the dropdown
    const statusOptions = USER_STATUSES.map(status => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase()
    }));
</script>

<!-- Password Update Dialog -->
<PasswordUpdateDialog
    bind:open={passwordUpdateDialogOpen}
    user={user}
    action="?/updatePassword"
/>

<!-- Password Reset Dialog -->
<ResetPasswordDialog
    bind:open={passwordResetConfirmOpen}
    user={user}
    action="?/resetPassword"
    onSuccess={() => {
        // Refresh data if needed after password reset
        goto(`/admin/users/${user?.id}`, { invalidateAll: true });
    }}
/>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <FormContainer 
        method="POST" 
        action={formAction}
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
            title="User Information"
            description="Edit user details and permissions"
            icon={User}
            compact={true}
            class="relative"
        >
            <!-- User Information -->
            <div class="space-y-6">
                <!-- Row 1: Email and Full Name -->
                <FormRow columns={2}>
                    <!-- Email (Read-only) -->
                    <FormField
                        id="email"
                        label="Email Address"
                        helpText="Used as username"
                    >
                        <div class="flex items-center">
                            <Input
                                id="email"
                                value={user?.email}
                                readonly
                                disabled
                                class="bg-muted/50 w-full"
                            />
                            <input type="hidden" name="email" value={user?.email} />
                        </div>
                    </FormField>

                    <!-- Name -->
                    <FormField
                        id="name"
                        label="Full Name"
                        error={$errors.name}
                        required={true}
                        helpText="Enter the user's full name"
                    >
                        <Input
                            id="name"
                            name="name"
                            bind:value={$form.name}
                            placeholder="John Doe"
                            {...getFieldProps($errors, 'name', isLoading)}
                        />
                    </FormField>
                </FormRow>

                <!-- Row 2: Primary Account and Status -->
                <FormRow columns={2}>
                    <!-- Status -->
                    <FormField 
                        id="status" 
                        label="Status" 
                        error={$errors.status}
                        required={true}
                        helpText="Current status of the user account"
                    >
                        <div class="space-y-2">
                            <!-- Status selector -->
                            <EnhancedSelect
                                name="status"
                                options={statusOptions}
                                bind:value={$form.status}
                                placeholder="Select status"
                                {...getSelectProps($errors, 'status', isLoading)}
                            />
                        </div>
                    </FormField>

                    <FormField
                            id="systemRole"
                            label="System Role"
                            error={$errors.systemRole}
                            required={true}
                            helpText="User's system-wide role and permissions"
                    >
                        <SearchableFormSelect
                                bind:value={$form.systemRole}
                                name="systemRole"
                                id="systemRole"
                                placeholder="Select a role"
                                labelText="System Role"
                                disabled={isLoading}
                                required
                                error={$errors.systemRole}
                                searchPlaceholder="Search roles..."
                                options={SYSTEM_ROLES.map(role => ({
                                value: role,
                                label: role.charAt(0) + role.slice(1).toLowerCase()
                            }))}
                                on:change={(e) => ($form.systemRole = e.detail)}
                                triggerClass="w-full"
                                aria-invalid={$errors.systemRole ? 'true' : undefined}
                        />
                    </FormField>
                </FormRow>
            </div>
            
            <svelte:fragment slot="footer">
                {#if user}
                    <MetadataFooter
                        showBorder={false}
                        layout="compact"
                        items={[
                            {
                                label: "ID:",
                                value: user.id,
                                icon: "id"
                            },
                            {
                                label: "Created:",
                                date: user.createdAt,
                                icon: "calendar"
                            },
                            {
                                label: "Updated:",
                                date: user.updatedAt,
                                icon: "clock"
                            }
                        ]}
                    />
                {/if}
            </svelte:fragment>
        </AdminCard>
    </FormContainer>
    
    <!-- Relationship Sections -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Account Memberships Section -->
        <RelationshipSection
            title="Account Memberships"
            description="Accounts this user is a member of"
            icon={Building}
            relationships={relationships?.accounts || []}
            availableItems={availableAccounts || []}
            relationshipType="members"
            canAdd={false}
            canRemove={false}
            canCreate={false}
            viewUrl="/admin/accounts/accounts"
            addAction="?/addAccount"
            removeAction="?/removeAccount"
            loading={false}
            multiSelect={true}
            removalWarningMessage="This will remove the user from the account but will not delete the user record."
        />

        <!-- Related Companies Section -->
        <RelationshipSection
            title="Related Companies"
            description="Companies from accounts this user is a member of"
            icon={Building}
            relationships={relationships?.companies || []}
            availableItems={[]}
            relationshipType="companies"
            canAdd={false}
            canRemove={false}
            canCreate={false}
            viewUrl="/admin/accounts/companies"
            addAction=""
            removeAction=""
            loading={false}
            multiSelect={false}
        />
    </div>
</AdminPageLayout>
