<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
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
    import ReadOnlyField from "$lib/components/ui_components_sveltekit/form/ReadOnlyField.svelte";
    
    export let data: PageData;
    const title = "Create API Key";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        ["API Keys", "/admin/settings/api_keys"],
        "New API Key",
    ];

    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/settings/api_keys',
        validateOnInput: true,
        debugMode: true,
        onSuccess: (result) => {
            toast.success("API key created successfully");
        }
    });

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
            
            <FormCard title="API Key Information">
                <FormRow>
                    <FormField id="apiKey" label="API Key" error={$errors.apiKey}>
                        <ReadOnlyField
                            id="apiKey"
                            name="apiKey"
                            value={$form.apiKey}
                            placeholder="API key will be generated automatically"
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField id="name" label="Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="API Key Name"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            {...$constraints.name}
                        />
                    </FormField>

                    <FormField id="description" label="Description" error={$errors.description}>
                        <Input
                            id="description"
                            name="description"
                            type="text"
                            bind:value={$form.description}
                            placeholder="Optional description"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField id="active" label="Active" error={$errors.active}>
                        <EnhancedSelect
                            name="active"
                            options={statusOptions}
                            bind:value={$form.active}
                            aria-invalid={$errors.active ? 'true' : undefined}
                            {...$constraints.active}
                        />
                    </FormField>

                    <FormField id="expiresAt" label="Expires At" error={$errors.expiresAt}>
                        <Input
                            id="expiresAt"
                            name="expiresAt"
                            type="datetime-local"
                            bind:value={$form.expiresAt}
                            aria-invalid={$errors.expiresAt ? 'true' : undefined}
                            {...$constraints.expiresAt}
                        />
                    </FormField>
                </FormRow>

                <FormActions>
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto("/admin/settings/api_keys")}
                        disabled={$submitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={$submitting} class="min-w-[120px] relative">
                        {#if $submitting}
                            <span class="absolute inset-0 flex items-center justify-center">
                                <Skeleton class="h-4 w-20" />
                            </span>
                            <span class="opacity-0">Create API Key</span>
                        {:else}
                            Create API Key
                        {/if}
                    </Button>
                </FormActions>
            </FormCard>
        </FormContainer>
    </PageContent>
</PageContainer>
