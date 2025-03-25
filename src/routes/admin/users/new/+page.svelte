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
    import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
    import { Card, CardContent } from "$lib/components/ui/card";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
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

    import { derived } from 'svelte/store';
    
    // Use a local variable for error display
    import { writable } from 'svelte/store';
    const errorMessage = writable(null);
    
    const { form, errors, enhance, submitting, constraints } = superForm(data.form, {
        // Use tainted to track if form has been modified
        taintedMessage: false,
        // Validate on blur for better UX
        validationMethod: 'oninput',
        // Don't show errors until the user has interacted with a field
        delayMs: 300,
        // Set a reasonable timeout for server requests
        timeoutMs: 8000,
        // Enable debug mode to see more information in the console
        debugForm: true,
        // Add custom transform to debug the form submission
        transform({ formData, cancel }) {
            console.log('Form submission data:', Object.fromEntries(formData));
            return { formData };
        },
        onResult: async ({ result }) => {
            console.log('Form submission result:', result);
            
            if (result.type === "success") {
                toast.success("User created successfully");
                try {
                    await goto("/admin/users");
                } catch (error) {
                    console.error("Navigation error:", error);
                    $errorMessage = { type: 'error', text: 'Failed to redirect. Please try again.' };
                }
            } else if (result.type === "failure") {
                // Handle server errors that aren't field validation errors
                console.log('Server failure:', result);
                
                // Check if the server returned a message object directly
                if (result.data?.message) {
                    console.log('Server returned message object:', result.data.message);
                    // Force a new object to trigger reactivity
                    const serverMessage = result.data.message;
                    $errorMessage = {
                        type: serverMessage.type || 'error',
                        text: serverMessage.text || 'An error occurred',
                        details: serverMessage.details || '',
                        code: serverMessage.code || '',
                        requestId: serverMessage.requestId || '',
                        timestamp: serverMessage.timestamp || ''
                    };
                    console.log('Set message directly from server:', $errorMessage);
                }
                // Check for form-level errors from Zod validation
                else if (result.data?.form?.$errors?._errors?.length > 0) {
                    // Handle Zod form-level errors
                    const formErrors = result.data.form.$errors._errors;
                    const errorMessage = formErrors[0] || "An error occurred while creating the user";
                    
                    // Extract metadata if available
                    const meta = result.data.form.$meta || {};
                    console.log('Form error metadata:', meta);
                    
                    $errorMessage = { 
                        type: 'error', 
                        text: errorMessage,
                        details: meta.details,
                        code: result.data.form.$id,
                        requestId: meta.requestId,
                        timestamp: meta.timestamp
                    };
                    
                    console.log('Set message from form errors:', $errorMessage);
                } else {
                    // Fallback error handling
                    console.log('Using fallback error handling');
                    const errorMessage = "An error occurred while processing your request";
                    $errorMessage = { type: 'error', text: errorMessage };
                    console.log('Set fallback message:', $errorMessage);
                }
            }
        },
        onUpdate({ form }) {
            // Clear field errors when user fixes them
            if (form.valid) {
                toast.dismiss();
            }
        },
        onError({ result }) {
            // Handle any other errors including network errors
            console.error('Form submission error:', result);
            
            if (typeof result.error === 'object' && result.error !== null) {
                // Handle structured error object
                $errorMessage = { 
                    type: 'error', 
                    text: result.error.message || "Server error occurred. Please try again.",
                    details: result.error.details,
                    code: result.error.code,
                    requestId: result.error.requestId,
                    timestamp: result.error.timestamp
                };
            } else {
                // Handle string error or undefined
                const errorMessage = typeof result.error === 'string' ? result.error : 
                    "Server error occurred. Please try again.";
                $errorMessage = { type: 'error', text: errorMessage };
            }
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
        <FormContainer method="POST" action="?/save" {enhance} novalidate on:submit={() => {
            
        }}>
            <!-- Error display using the reusable component with matching width -->
            {#if $errorMessage}
                    <ErrorAlert message={$errorMessage} className="max-w-5xl" />
                
                    <!-- Debug message state (hidden in production) -->
                    <div class="hidden">
                        <p>Debug message state:</p>
                        <pre>{JSON.stringify($errorMessage, null, 2)}</pre>
                    </div>
                
            {/if}
            
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
