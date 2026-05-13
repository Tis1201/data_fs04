<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Webhook, Copy } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { browser } from "$app/environment";
    
    // Import Admin Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Webhook Endpoint";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Webhook Endpoints", "/admin/settings/webhook"],
        "New Webhook",
    ];

    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/settings/webhook',
        validationMethod: 'oninput',
        onSuccess: (result) => {
            toast.success("Webhook created successfully");
        }
    });

    // Status options for the select dropdown
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
    ];
    
    // Get the sample postfix from the server data
    const { samplePostfix } = data;
    
    // Generate the full URL for display
    let fullEndpointUrl = "";
    $: if (browser) {
        const origin = window.location.origin;
        fullEndpointUrl = `${origin}/api/webhook/${samplePostfix}`;
    }
    
    // Copy URL to clipboard
    let copied = false;
    async function copyToClipboard() {
        if (browser) {
            await navigator.clipboard.writeText(fullEndpointUrl);
            copied = true;
            toast.success("Endpoint URL copied to clipboard");
            setTimeout(() => {
                copied = false;
            }, 2000);
        }
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings/webhook'),
            variant: "outline",
            class: "h-9"
        },
        {
            label: "Save",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/create"]');
                if (form) form.requestSubmit();
            },
            class: "h-9",
            disabled: $submitting
        }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <FormContainer 
        method="POST" 
        action="?/create" 
        {enhance} 
        novalidate 
        errorMessage={$errorMessage}
        showAlerts={true}
        disabled={$submitting}
        class="w-full space-y-6"
    >
        <AdminCard
            title="Webhook Information"
            description="Create a new webhook endpoint"
            icon={Webhook}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField id="name" label="Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="My Webhook"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            {...$constraints.name}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium">Endpoint URL</h4>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                class="h-8 px-2 text-xs" 
                                on:click={copyToClipboard}
                            >
                                {#if copied}
                                    <span class="text-green-600 font-medium">Copied!</span>
                                {:else}
                                    <Copy class="h-3.5 w-3.5 mr-1" /> Copy
                                {/if}
                            </Button>
                        </div>
                        <div class="bg-background border rounded-md p-2 font-mono text-xs break-all">
                            {browser ? fullEndpointUrl : `/api/webhook/${samplePostfix}`}
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            A unique endpoint URL will be automatically generated when you create the webhook.
                            This is just a preview of what it will look like.
                        </p>
                    </div>
                </FormRow>

                <FormRow columns={1}>
                    <FormField id="description" label="Description" error={$errors.description}>
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Describe the purpose of this webhook"
                            rows="3"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={1}>
                    <FormField id="status" label="Status" error={$errors.status}>
                        <div class="flex items-center space-x-4 pt-2">
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="status" 
                                    name="status" 
                                    checked={$form.status === 'ACTIVE'}
                                    onCheckedChange={(checked) => {
                                        $form.status = checked ? 'ACTIVE' : 'INACTIVE';
                                        $form.active = checked;
                                        // Force reactive update
                                        $form = $form;
                                    }}
                                    disabled={$submitting}
                                    aria-invalid={$errors.status ? 'true' : undefined}
                                />
                                <label for="status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    Active
                                </label>
                            </div>
                            <div class="text-xs text-muted-foreground">
                                {$form.status === 'ACTIVE' ? 'Webhook will be active and ready to receive requests' : 'Webhook will be created in inactive state'}
                            </div>
                        </div>
                        <!-- Hidden inputs to ensure status is submitted -->
                        <input type="hidden" name="status" value={$form.status} />
                        <input type="hidden" name="active" value={$form.active} />
                    </FormField>

                    <!-- <FormField id="expiresAt" label="Expiration Date (Optional)" error={$errors.expiresAt}>
                        <DatePicker
                            id="expiresAt"
                            name="expiresAt"
                            bind:value={$form.expiresAt}
                            placeholder="Select expiration date"
                            aria-invalid={$errors.expiresAt ? 'true' : undefined}
                            {...$constraints.expiresAt}
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            If set, the webhook will automatically become inactive after this date.
                        </p>
                    </FormField> -->
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>
</AdminPageLayout>
