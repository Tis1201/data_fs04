<script lang="ts">
    import { goto, invalidate } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Webhook, Copy, Trash } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { browser } from "$app/environment";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    
    // Import Admin Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { webhookSchema } from '../new/webhook';
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = `Edit Webhook: ${data.webhook.name}`;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Webhook Endpoints", "/admin/settings/webhook"],
        data.webhook.name,
    ];

    // Use standard SuperForms approach with comprehensive error handling
    const { form, errors, enhance, submitting, message, delayed, timeout } = superForm(data.form, {
        validators: zod(webhookSchema), // Add client-side validation
        taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
        invalidateAll: false, // Prevent automatic invalidation
        resetForm: false, // Don't reset the form after submission
        validationMethod: 'oninput', // Validate on every input change
        delayMs: 500, // Show loading state after 500ms
        timeoutMs: 8000, // Timeout after 8 seconds
        
        onResult: async ({ result }) => {
            if (result.type === "success") {
                // Show success message
                toast.success("Webhook updated successfully!", {
                    description: "All changes have been saved.",
                    duration: 4000
                });
                
                // Manually invalidate to get fresh data
                await invalidate();
            } else if (result.type === "failure") {
                // Handle form validation errors
                if (result.data?.form?.message) {
                    toast.error("Validation Error", {
                        description: result.data.form.message.text || "Please check your input and try again.",
                        duration: 6000
                    });
                } else {
                    toast.error("Failed to update webhook", {
                        description: "Please check your input and try again.",
                        duration: 6000
                    });
                }
            } else if (result.type === "error") {
                // Handle server errors
                toast.error("Server Error", {
                    description: "An unexpected error occurred. Please try again later.",
                    duration: 6000
                });
            }
        },
        
        onError: ({ result }) => {
            console.error("Form submission error:", result);
            toast.error("Connection Error", {
                description: "Unable to connect to the server. Please check your connection and try again.",
                duration: 6000
            });
        },
        
        onSubmit: ({ formData, cancel }) => {
            // Optional: Add pre-submission validation or data manipulation
            console.log("Form submitting with data:", Object.fromEntries(formData));
        },
        
        onUpdate: ({ form }) => {
            // Clear previous error messages when user starts typing
            if (form.valid) {
                // Optional: Clear any persistent error messages
            }
        }
    });

    // Enhanced message handling for FormContainer (only errors, success uses toast)
    $: errorMessage = $message?.type === 'error' ? { 
        text: $message.text || 'An error occurred',
        details: $message.details,
        code: $message.code 
    } : null;
    
    // Loading state management
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    
    // State for delete confirmation dialog
    let deleteState = {
        selectedRecord: null as typeof data.webhook | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete() {
        deleteState.selectedRecord = data.webhook;
        deleteState.confirmationOpen = true;
    }
    
    // Generate the full URL for display
    let fullEndpointUrl = "";
    $: if (browser && data.webhook.postfix) {
        const origin = window.location.origin;
        fullEndpointUrl = `${origin}/api/webhook/${data.webhook.postfix}`;
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
            label: "Delete",
            icon: Trash,
            onClick: confirmDelete,
            variant: "destructive",
            disabled: isLoading
        },
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings/webhook'),
            variant: "outline",
            disabled: isLoading
        },
        {
            label: isLoading ? ($delayed ? "Saving..." : "Processing...") : "Save Changes",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/update"]');
                if (form) form.requestSubmit();
            },
            disabled: isLoading,
            loading: isLoading
        }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <FormContainer 
        method="POST" 
        action="?/update" 
        {enhance} 
        novalidate 
        {errorMessage}
        showAlerts={true}
        disabled={isLoading}
        {hasTimeout}
        {isLoading}
        delayed={$delayed}
        class="w-full space-y-6"
    >
        <AdminCard
            title="Webhook Information"
            description="Update webhook endpoint details"
            icon={Webhook}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField id="name" label="Name" error={$errors.name} required={true}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="My Webhook"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            disabled={isLoading}
                            class={$errors.name ? 'border-destructive focus:border-destructive' : ''}
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
                            {browser ? fullEndpointUrl : `/api/webhook/${data.webhook.postfix}`}
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            This is your webhook endpoint URL. It cannot be changed.
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
                            disabled={isLoading}
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
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
                                    disabled={isLoading}
                                    aria-invalid={$errors.status ? 'true' : undefined}
                                />
                                <label for="status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    Active
                                </label>
                            </div>
                            <div class="text-xs text-muted-foreground">
                                {$form.status === 'ACTIVE' ? 'Webhook is active and receiving requests' : 'Webhook is inactive'}
                            </div>
                        </div>
                        <!-- Hidden input to ensure status is submitted -->
                        <input type="hidden" name="status" value={$form.status} />
                        <input type="hidden" name="active" value={$form.active} />
                    </FormField>
                </FormRow>
                
                <!-- Webhook Metadata -->
                <div class="pt-4 border-t">
                    <h4 class="text-sm font-medium mb-2">Metadata</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-muted-foreground">Created:</span>
                            <span class="ml-2">{new Date(data.webhook.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                            <span class="text-muted-foreground">Updated:</span>
                            <span class="ml-2">{new Date(data.webhook.updatedAt).toLocaleString()}</span>
                        </div>
                        <div>
                            <span class="text-muted-foreground">ID:</span>
                            <span class="ml-2 font-mono text-xs">{data.webhook.id}</span>
                        </div>
                        <div>
                            <span class="text-muted-foreground">Postfix:</span>
                            <span class="ml-2 font-mono text-xs">{data.webhook.postfix}</span>
                        </div>
                    </div>
                </div>
            </div>
        </AdminCard>
    </FormContainer>
</AdminPageLayout>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    state={deleteState}
    action="?/deleteWebhook"
    actionName="deleteWebhook"
    onConfirm={() => {
        // Navigate back to webhooks list after successful deletion
        goto('/admin/settings/webhook');
    }}
/>

