<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { PasswordInput } from "$lib/components/ui/password-input";
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
    
    export let data: PageData;
    const title = "Create User";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        "New User",
    ];

    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/users',
        validateOnInput: true,
        debugMode: true,
        onSuccess: (result) => {
            toast.success("User created successfully");
        }
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
        <FormContainer 
            method="POST" 
            action="?/save" 
            {enhance} 
            novalidate 
            errorMessage={$errorMessage}
        >
            
            <FormCard title="User Information">
                <FormRow columns={2}>
                        <FormField id="email" label="Email" error={$errors.email}>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                bind:value={$form.email}
                                placeholder="user@example.com"
                                aria-invalid={$errors.email ? 'true' : undefined}
                                {...$constraints.email}
                            />
                        </FormField>

                        <FormField id="name" label="Name" error={$errors.name}>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                bind:value={$form.name}
                                placeholder="John Doe"
                                aria-invalid={$errors.name ? 'true' : undefined}
                                {...$constraints.name}
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
                            aria-invalid={$errors.password ? 'true' : undefined}
                            {...$constraints.password}
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
                            aria-invalid={$errors.role ? 'true' : undefined}
                            {...$constraints.role}
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
                            aria-invalid={$errors.status ? 'true' : undefined}
                            {...$constraints.status}
                        />
                    </FormField>
                </FormRow>

                <FormActions>
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto("/admin/users")}
                        disabled={$submitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={$submitting} class="min-w-[120px] relative">
                        {#if $submitting}
                            <span class="absolute inset-0 flex items-center justify-center">
                                <Skeleton class="h-4 w-20" />
                            </span>
                            <span class="opacity-0">Create User</span>
                        {:else}
                            Create User
                        {/if}
                    </Button>
                </FormActions>
            </FormCard>
        </FormContainer>
    </PageContent>
</PageContainer>
