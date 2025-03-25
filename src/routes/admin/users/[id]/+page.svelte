<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Clock } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";
    import { SYSTEM_ROLES, USER_STATUSES } from "./schema";

    export let data: PageData;
    const { user } = data;
    const title = "Edit User";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        user?.email || "Edit User",
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

    const { form, errors, enhance, submitting } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success("User updated successfully");
                try {
                    await goto("/admin/users");
                } catch (error) {
                    console.error("Navigation error:", error);
                    toast.error("Failed to redirect. Please try again.");
                }
            }
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        <!-- User Info Card -->
        <FormCard
            {title}
            description="Edit details for this user account"
            loading={$submitting}
            footerSlot={user}
        >
            <FormContainer {enhance} action="?/save">
                <!-- Two-column layout for shorter fields -->
                <FormRow columns={2}>
                    <!-- Email -->
                    <FormField
                        id="email"
                        label="Email"
                        error={$errors.email}
                    >
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            bind:value={$form.email}
                            placeholder="Enter email address"
                        />
                    </FormField>

                    <!-- Name -->
                    <FormField
                        id="name"
                        label="Name"
                        error={$errors.name}
                    >
                        <Input
                            id="name"
                            name="name"
                            bind:value={$form.name}
                            placeholder="Enter full name"
                        />
                    </FormField>
                </FormRow>

                <!-- System Role -->
                <FormField id="systemRole" label="System Role" error={$errors.systemRole}>
                    <EnhancedSelect
                        value={$form.systemRole}
                        name="systemRole"
                        placeholder="Select a system role"
                        labelText="System Role"
                        portal={null}
                        on:change={(e) => ($form.systemRole = e.detail)}
                    >
                        {#each SYSTEM_ROLES as role}
                            <Select.Item value={role}>{role}</Select.Item>
                        {/each}
                    </EnhancedSelect>
                </FormField>

                <!-- Status -->
                <FormField id="status" label="Status" error={$errors.status}>
                    <EnhancedSelect
                        value={$form.status}
                        name="status"
                        placeholder="Select status"
                        labelText="Status"
                        portal={null}
                        on:change={(e) => ($form.status = e.detail)}
                    >
                        {#each USER_STATUSES as status}
                            <Select.Item value={status}>{status}</Select.Item>
                        {/each}
                    </EnhancedSelect>
                </FormField>
                
                <!-- Roles String (Additional Roles) -->
                <FormField id="rolesString" label="Additional Roles" error={$errors.rolesString} description="Comma-separated list of additional roles">
                    <Input
                        id="rolesString"
                        name="rolesString"
                        bind:value={$form.rolesString}
                        placeholder="role1,role2,role3"
                    />
                </FormField>

                <!-- Submit Button -->
                <FormRow columns={1} alignItems="end">
                    <FormActions>
                        <Button
                            variant="outline"
                            type="button"
                            on:click={() => goto('/admin/users')}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Save Changes</Button>
                    </FormActions>
                </FormRow>
            </FormContainer>

            <svelte:fragment slot="footer">
                {#if user}
                    <div class="mt-4 pt-3 border-t border-muted">
                        <div class="flex items-center text-xs text-muted-foreground">
                            <Clock size={12} class="mr-1.5" />
                            <div class="flex items-center">
                                <span class="font-medium">ID:</span>
                                <span class="ml-1">{user.id}</span>
                                <span class="mx-2">•</span>
                            </div>
                            <div class="flex items-center">
                                <span class="font-medium">Created:</span>
                                <span class="ml-1">
                                    <RelativeDate 
                                        date={user.createdAt} 
                                        format="relative" 
                                        showTooltip={true} 
                                        useHoverCard={true} 
                                        iconSize={0}
                                    />
                                </span>
                                <span class="mx-2">•</span>
                            </div>
                            <div class="flex items-center">
                                <span class="font-medium">Updated:</span>
                                <span class="ml-1">
                                    <RelativeDate 
                                        date={user.updatedAt} 
                                        format="relative" 
                                        showTooltip={true} 
                                        useHoverCard={true} 
                                        iconSize={0}
                                    />
                                </span>
                            </div>
                        </div>
                    </div>
                {/if}
            </svelte:fragment>
        </FormCard>
    </PageContent>
</PageContainer>
