<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { PasswordInput } from "$lib/components/ui/password-input";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import type { PageData } from "./$types";
    import type { CreateUserSchema } from "./schema";

    export let data: PageData;
    const title = "Create User";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        "New User",
    ];

    const { form, errors, enhance, submitting } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success("User created successfully");
                try {
                    await goto("/admin/users");
                } catch (error) {
                    console.error("Navigation error:", error);
                    toast.error("Failed to redirect. Please try again.");
                }
            }
        },
        onError: ({ result }) => {
            toast.error(result.error || "Failed to create user");
        },
    });

    // Role options for the select dropdown
    const roleOptions = [
        { value: "USER", label: "User" },
        { value: "ADMIN", label: "Admin" },
    ];

    // Status options for the select dropdown
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        <FormContainer method="POST" action="?/save" {enhance}>
            <FormCard title="User Information">
                <FormRow columns={2}>
                    <FormField id="email" label="Email" error={$errors.email}>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            bind:value={$form.email}
                            placeholder="user@example.com"
                            required
                        />
                    </FormField>

                    <FormField id="name" label="Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="John Doe"
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField
                        id="password"
                        label="Password"
                        error={$errors.password}
                    >
                        <PasswordInput
                            id="password"
                            name="password"
                            bind:value={$form.password}
                            placeholder="Enter password"
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            Leave empty to use default temporary password
                        </p>
                    </FormField>

                    <FormField id="role" label="Role" error={$errors.role}>
                        <EnhancedSelect
                            name="role"
                            options={roleOptions}
                            bind:value={$form.role}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField
                        id="status"
                        label="Status"
                        error={$errors.status}
                    >
                        <EnhancedSelect
                            name="status"
                            options={statusOptions}
                            bind:value={$form.status}
                        />
                    </FormField>
                </FormRow>

                <FormActions>
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto("/admin/users")}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={$submitting}>
                        {#if $submitting}
                            <Skeleton class="h-4 w-20" />
                        {:else}
                            Create User
                        {/if}
                    </Button>
                </FormActions>
            </FormCard>
        </FormContainer>
    </PageContent>
</PageContainer>
