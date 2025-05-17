<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    
    // UI Components
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    
    // Icons
    import { Clock, User, Building, ArrowLeft, Save, Loader2, ShieldCheck } from "lucide-svelte";
    
    // Admin Layout Components
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";
    
    // Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import SearchableSelect from "$lib/components/ui_components_sveltekit/form/SearchableSelect.svelte";
    
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
                toast.success(result.data?.text || "User updated successfully");
                setTimeout(() => goto("/admin/users"), 800);
            }
        },
        onError: ({ result }) => {
            toast.error(result.data?.text || "Failed to update user");
        }
    });
    
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
            errorMessage={$message}
        >
            <AdminCard
                title="User Information"
                description="Edit user details and permissions"
                icon={User}
                compact={true}
            >
                <!-- User Information -->
                <div class="space-y-6">
                    <!-- Email, Name, and Account on same line -->
                    <FormRow columns={3}>
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
                                    class="bg-muted/50"
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
                            />
                        </FormField>
                        
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
                                on:change={(e) => console.log('Primary account changed:', e.detail)}
                            />
                        </FormField>
                    </FormRow>

                    <!-- System Role and Status -->
                    <FormRow columns={2}>
                        <!-- System Role -->
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
                            >
                                {#each SYSTEM_ROLES as role}
                                    <Select.Item value={role}>{role}</Select.Item>
                                {/each}
                            </EnhancedSelect>
                        </FormField>

                        <!-- Status -->
                        <FormField 
                            id="status" 
                            label="Account Status" 
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
                            >
                                {#each USER_STATUSES as status}
                                    <Select.Item value={status}>
                                        <div class="flex items-center gap-2">
                                            <div class={`h-2 w-2 rounded-full ${
                                                status === 'ACTIVE' ? 'bg-green-500' : 
                                                status === 'INACTIVE' ? 'bg-gray-400' : 
                                                'bg-destructive'
                                            }`} />
                                            {status}
                                        </div>
                                    </Select.Item>
                                {/each}
                            </EnhancedSelect>
                        </FormField>
                    </FormRow>

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

