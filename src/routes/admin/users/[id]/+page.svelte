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

    export let data: PageData;
    const { user } = data;
    const title = "Edit User";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        user?.email || "Edit User",
    ];

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

                <!-- Role -->
                <FormField id="role" label="Role" error={$errors.role}>
                    <EnhancedSelect
                        value={$form.role}
                        name="role"
                        placeholder="Select a role"
                        labelText="Role"
                        portal={null}
                        on:change={(e) => ($form.role = e.detail)}
                    >
                        <Select.Item value="ADMIN">Admin</Select.Item>
                        <Select.Item value="USER">User</Select.Item>
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
                        <Select.Item value="ACTIVE">Active</Select.Item>
                        <Select.Item value="INACTIVE">Inactive</Select.Item>
                        <Select.Item value="SUSPENDED">Suspended</Select.Item>
                    </EnhancedSelect>
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
                    <MetadataFooter
                        items={[
                            { label: "Created", date: user.createdAt },
                            { label: "Last Updated", date: user.updatedAt },
                        ]}
                    />
                {/if}
            </svelte:fragment>
        </FormCard>
    </PageContent>
</PageContainer>
