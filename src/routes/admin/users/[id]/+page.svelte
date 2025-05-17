<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    
    // UI Components
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select/index.js";
    
    // Icons
    import { Clock, User, Building, ArrowLeft, Save, Loader2, ShieldCheck } from "lucide-svelte";
    
    // Admin Layout Components
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";
    
    // Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    // Other Components
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    
    import type { PageData } from "./$types";
    import { SYSTEM_ROLES, USER_STATUSES } from "./schema";

    // Import page data
    export let data: PageData;
    const { user, meta, accounts = [] } = data;
    
    // Page title and breadcrumbs
    const title = `Edit User: ${user?.email || 'User Details'}`;
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        user?.email || "Edit User"
    ];
    
    // Get status badge variant based on status value
    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'INACTIVE': return 'secondary';
            case 'SUSPENDED': return 'destructive';
            default: return 'outline';
        }
    };

    // Format account options for the dropdown
    const accountOptions = (accounts || []).map(account => ({
        value: account.id,
        label: account.name
    }));

    // Initialize form with superForm
    const { form, errors, enhance, submitting, message } = superForm(data.form, {
        taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
        onResult: ({ result }) => {
            if (result.type === "success") {
                // Redirect after a short delay
                setTimeout(() => goto("/admin/users"), 1500);
            }
        }
    });
    
    // Track success message for FormContainer
    $: successMessage = $message?.type === 'success' ? { text: $message.text } : null;
    
    // Function to handle password reset
    const handleResetPassword = () => {
        // This would typically send an email to the user with a password reset link
        toast.info("Password reset email sent to user");
    };
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/users'),
            variant: "outline"
        },
        {
            label: "Reset Password",
            icon: ShieldCheck,
            onClick: handleResetPassword,
            variant: "outline"
        },
        {
            label: "Save",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/save"]');
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
            action="?/save" 
            {enhance} 
            novalidate
            errorMessage={$message?.type === 'error' ? { text: $message.text } : null}
            {successMessage}
            showToasts={true}
        >
            <AdminCard
                title="User Information"
                description="Edit user details and permissions"
                icon={User}
                compact={true}
            >
                <!-- User Information -->
                <div class="space-y-6">
                    <!-- Row 1: Email and Full Name -->
                    <FormRow columns={2}>
                        <!-- Email (Read-only) -->
                        <FormField
                            id="email"
                            label="Email Address"
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
                            <p class="text-xs text-muted-foreground mt-1">Used as username</p>
                        </FormField>

                        <!-- Name -->
                        <FormField
                            id="name"
                            label="Full Name"
                            error={$errors.name}
                        >
                            <Input
                                id="name"
                                name="name"
                                bind:value={$form.name}
                                placeholder="John Doe"
                                disabled={$submitting}
                                class="w-full"
                            />
                        </FormField>
                    </FormRow>

                    <!-- Row 2: Primary Account and Status -->
                    <FormRow columns={2}>
                        <!-- Primary Account Assignment -->
                        <FormField
                            id="primaryAccountId"
                            label="Primary Account"
                            error={$errors.primaryAccountId}
                        >
                            <EnhancedSelect
                                bind:value={$form.primaryAccountId}
                                name="primaryAccountId"
                                placeholder="Select primary account"
                                options={[{value: "", label: "None"}, ...accountOptions]}
                                disabled={$submitting}
                                required={false}
                                class="w-full"
                            />
                        </FormField>

                        <!-- Status -->
                        <FormField 
                            id="status" 
                            label="Status" 
                            error={$errors.status}
                            required
                        >
                            <EnhancedSelect
                                value={$form.status}
                                name="status"
                                placeholder="Select status"
                                labelText="Status"
                                disabled={$submitting}
                                on:change={(e) => ($form.status = e.detail)}
                                class="w-full"
                            >
                                {#each USER_STATUSES as status}
                                    <Select.Item value={status}>
                                        <div class="flex items-center">
                                            <span class="inline-block w-2 h-2 rounded-full mr-2" 
                                                  class:bg-green-500={status === 'ACTIVE'}
                                                  class:bg-gray-400={status === 'INACTIVE'}
                                                  class:bg-red-500={status === 'SUSPENDED'}
                                            ></span>
                                            {status.charAt(0) + status.slice(1).toLowerCase()}
                                        </div>
                                    </Select.Item>
                                {/each}
                            </EnhancedSelect>
                        </FormField>
                    </FormRow>

                    <!-- Row 3: System Role (full width) -->
                    <div class="w-full">
                        <FormField 
                            id="systemRole" 
                            label="System Role" 
                            error={$errors.systemRole}
                            required
                        >
                            <EnhancedSelect
                                value={$form.systemRole}
                                name="systemRole"
                                placeholder="Select a role"
                                labelText="System Role"
                                disabled={$submitting}
                                on:change={(e) => ($form.systemRole = e.detail)}
                                class="w-full"
                            >
                                {#each SYSTEM_ROLES as role}
                                    <Select.Item value={role}>
                                        <div class="flex items-center">
                                            {role}
                                        </div>
                                    </Select.Item>
                                {/each}
                            </EnhancedSelect>
                        </FormField>
                    </div>

                </div>
            </AdminCard>
        </FormContainer>
        
        {#if user}
            <AdminCard
                title="User Metadata"
                description="System information"
                icon={Clock}
                compact={true}
            >
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div class="p-3 bg-muted/50 rounded-md">
                        <div class="font-medium mb-1">User ID</div>
                        <div class="font-mono text-xs text-muted-foreground break-all">{user.id}</div>
                    </div>
                    <div class="p-3 bg-muted/50 rounded-md">
                        <div class="font-medium mb-1">Created</div>
                        <RelativeDate 
                            date={user.createdAt} 
                            format="relative" 
                            showTooltip={true} 
                            useHoverCard={true} 
                            iconSize={0}
                        />
                    </div>
                    <div class="p-3 bg-muted/50 rounded-md">
                        <div class="font-medium mb-1">Last Updated</div>
                        <RelativeDate 
                            date={user.updatedAt} 
                            format="relative" 
                            showTooltip={true} 
                            useHoverCard={true} 
                            iconSize={0}
                        />
                    </div>
                </div>
            </AdminCard>
        {/if}
    </AdminPageLayout>

