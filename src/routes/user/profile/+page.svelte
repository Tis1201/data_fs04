<script lang="ts">
    import { enhance } from "$app/forms";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Pencil, User, Key, Plus, Copy, ToggleLeft, ToggleRight, Trash2, AlertCircle, RefreshCw, Save, X, Lock } from "lucide-svelte";
    import SecureKeyDisplay from "$lib/components/ui_components_sveltekit/display/SecureKeyDisplay.svelte";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { formatDistanceToNow } from 'date-fns';
    import type { PageData } from "./$types";
    import { onMount } from 'svelte';
    import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
    import { z } from 'zod';

    // Form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedPasswordInput from "$lib/components/ui_components_sveltekit/form/EnhancedPasswordInput.svelte";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";

    // Define the API key schema
    const apiKeySchema = z.object({
        name: z.string().min(1, 'Name is required'),
        description: z.string().optional()
    });

    export let data: PageData;

    const title = "My Profile";
    const pageCrumbs = [
        ["Dashboard", "/user"],
        "Profile"
    ];

    let editMode = false;
    let showPasswordFields = false;

    // API key state
    let showNewKeyDialog = false;
    let newKeyData: { id: string; key: string; name: string } | null = null;
    let apiKeys: Array<{
        id: string;
        name: string;
        displayKey: string;
        createdAt: string;
        lastUsedAt?: string;
        expiresAt?: string;
        active?: boolean;
        description?: string;
    }> = [];
    let isLoading = true;
    let error: string | null = null;

    // Delete dialog state
    let keyToDelete: string | null = null;
    let showDeleteDialog = false;

    // Create form handler with proper validation and success handling
    const {
        form,
        errors,
        enhance: formEnhance,
        submitting,
        constraints,
        errorMessage,
        successMessage,
    } = createFormHandler(data.form, {
        validateOnInput: true,
        onSuccess: (result) => {
            toast.success("Profile updated successfully!");
            editMode = false;
            showPasswordFields = false;
            return { text: "Profile updated successfully!" };
        },
        onError: (error) => ({
            text: error?.message || "Failed to update profile",
        }),
    });

    // Handle API key creation result
    function handleApiKeyResult(result) {
        console.log('API key creation result:', result);
        if (result.type === 'success') {
            // Check different possible response structures
            if (result.data?.data) {
                newKeyData = result.data.data;
                showNewKeyDialog = true;
                toast.success('API key created successfully');
                // Refresh the keys list
                apiKeys = [...apiKeys, result.data.data];
            } else if (result.data?.key) {
                newKeyData = result.data;
                showNewKeyDialog = true;
                toast.success('API key created successfully');
                // Refresh the keys list with the new structure
                apiKeys = [...apiKeys, result.data];
            }
        } else if (result.type === 'error') {
            toast.error(result.error?.message || 'Failed to create API key');
        }
    }

    // Initialize form with default values
    const { form: apiKeyForm } = superForm({
        name: '',
        description: ''
    });

    // Copy API key to clipboard
    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        toast.success('API key copied to clipboard');
    }

    // Toggle API key active status
    async function toggleApiKey(id: string, active: boolean) {
        const formData = new FormData();
        formData.append('id', id);

        try {
            const response = await fetch('?/toggleApiKey', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Update the local state to reflect the change
                apiKeys = apiKeys.map(key =>
                    key.id === id ? { ...key, active: !active } : key
                );
                toast.success(`API key ${active ? 'deactivated' : 'activated'} successfully`);
            } else {
                toast.error(result.error || 'Failed to toggle API key status');
            }
        } catch (error) {
            toast.error('An error occurred while updating the API key');
            console.error('Error toggling API key:', error);
        }
    }

    // Show delete confirmation dialog
    function confirmDeleteApiKey(id: string) {
        keyToDelete = id;
        showDeleteDialog = true;
    }

    // Delete API key
    async function deleteApiKey() {
        if (!keyToDelete) return;

        try {
            const response = await fetch('/user/profile', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ id: keyToDelete })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                apiKeys = apiKeys.filter(key => key.id !== keyToDelete);
                toast.success(result.message || 'API key deleted successfully');
            } else {
                throw new Error(result.error?.message || 'Failed to delete API key');
            }
        } catch (error) {
            console.error('Error deleting API key:', error);
            toast.error(error.message || 'Failed to delete API key');
        } finally {
            // Close the dialog in both success and error cases
            showDeleteDialog = false;
        }
    }

    // Fetch API keys
    async function fetchApiKeys() {
        isLoading = true;
        error = null;
        try {
            const response = await fetch('/user/profile', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                apiKeys = result.data || [];
            } else {
                throw new Error(result.error?.message || 'Failed to load API keys');
            }
        } catch (err) {
            console.error('Error fetching API keys:', err);
            error = err.message || 'Failed to load API keys';
        } finally {
            isLoading = false;
        }
    }

    // Load API keys when component mounts
    onMount(() => {
        fetchApiKeys();
    });

    // Action buttons for the page layout
    $: actionButtons = [
        {
            label: editMode ? 'Cancel' : 'Edit Profile',
            icon: editMode ? X : Pencil,
            onClick: () => {
                if (editMode) {
                    // Reset form data when canceling
                    $form.email = data.user.email;
                    $form.name = data.user.name || '';
                    $form.currentPassword = '';
                    $form.newPassword = '';
                    $form.confirmPassword = '';
                    showPasswordFields = false;
                }
                editMode = !editMode;
            },
            variant: editMode ? "outline" : "default"
        },
        {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: fetchApiKeys,
            variant: "outline"
        }
    ];

    function submitForm() {
        const formElement = document.querySelector('form[action="?/update"]') as HTMLFormElement;
        formElement?.requestSubmit();
    }

    function togglePasswordFields() {
        showPasswordFields = !showPasswordFields;
        if (!showPasswordFields) {
            // Clear password fields when hiding
            $form.currentPassword = '';
            $form.newPassword = '';
            $form.confirmPassword = '';
        }
    }

    // Format date for display
    function formatDate(date: string | Date): string {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<UserPageLayout
        title={title}
        crumbs={pageCrumbs}
        {actionButtons}
>
    <div class="space-y-6">
        <!-- Profile Information Card -->
        <UserCard
                title="Profile Information"
                description="View and manage your personal information"
                icon={User}
        >
            {#if editMode}
                <FormContainer
                        method="POST"
                        action="?/update"
                        enhance={formEnhance}
                        novalidate
                        errorMessage={$errorMessage?.text ? { text: $errorMessage.text } : null}
                        successMessage={$successMessage?.text ? { text: $successMessage.text } : null}
                >
                    <div class="space-y-6">
                        <FormRow columns={2}>
                            <FormField id="name" label="Full Name" error={$errors.name} required={true}>
                                <Input
                                        id="name"
                                        name="name"
                                        type="text"
                                        bind:value={$form.name}
                                        placeholder="Enter your full name"
                                        aria-invalid={$errors.name ? 'true' : undefined}
                                        disabled={$submitting}
                                        {...$constraints.name}
                                />
                            </FormField>

                            <FormField id="email" label="Email Address" error={$errors.email} required={true}>
                                <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        bind:value={$form.email}
                                        placeholder="Enter your email address"
                                        aria-invalid={$errors.email ? 'true' : undefined}
                                        disabled={$submitting}
                                        {...$constraints.email}
                                />
                            </FormField>
                        </FormRow>

                        <!-- Password Change Section -->
                        <div class="border-t pt-4">
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h4 class="text-sm font-medium">Password</h4>
                                    <p class="text-xs text-muted-foreground">Leave blank to keep current password</p>
                                </div>
                                <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        on:click={togglePasswordFields}
                                >
                                    <Lock class="h-4 w-4 mr-2" />
                                    {showPasswordFields ? 'Hide' : 'Change'} Password
                                </Button>
                            </div>

                            {#if showPasswordFields}
                                <FormRow columns={1}>
                                    <FormField id="currentPassword" label="Current Password" error={$errors.currentPassword} required={true}>
                                        <EnhancedPasswordInput
                                                id="currentPassword"
                                                name="currentPassword"
                                                bind:value={$form.currentPassword}
                                                placeholder="Enter your current password"
                                                aria-invalid={$errors.currentPassword ? 'true' : undefined}
                                                disabled={$submitting}
                                                {...$constraints.currentPassword}
                                        />
                                    </FormField>
                                </FormRow>

                                <FormRow columns={2}>
                                    <FormField id="newPassword" label="New Password" error={$errors.newPassword} required={true}>
                                        <EnhancedPasswordInput
                                                id="newPassword"
                                                name="newPassword"
                                                bind:value={$form.newPassword}
                                                placeholder="Enter new password"
                                                aria-invalid={$errors.newPassword ? 'true' : undefined}
                                                disabled={$submitting}
                                                showStrength={true}
                                                {...$constraints.newPassword}
                                        />
                                    </FormField>

                                    <FormField id="confirmPassword" label="Confirm New Password" error={$errors.confirmPassword} required={true}>
                                        <EnhancedPasswordInput
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                bind:value={$form.confirmPassword}
                                                placeholder="Confirm new password"
                                                aria-invalid={$errors.confirmPassword ? 'true' : undefined}
                                                disabled={$submitting}
                                                {...$constraints.confirmPassword}
                                        />
                                    </FormField>
                                </FormRow>
                            {/if}
                        </div>

                        <!-- Form Actions -->
                        <div class="flex justify-end gap-2 border-t pt-4">
                            <Button
                                    type="button"
                                    variant="outline"
                                    on:click={() => {
                                    editMode = false;
                                    showPasswordFields = false;
                                }}
                                    disabled={$submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                    type="submit"
                                    disabled={$submitting}
                            >
                                <Save class="h-4 w-4 mr-2" />
                                {$submitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </FormContainer>
            {:else}
                <!-- Read-only view -->
                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <Label for="name-display">Full Name</Label>
                            <p class="text-sm font-medium">{data.user.name || 'Not set'}</p>
                        </div>

                        <div class="space-y-2">
                            <Label for="email-display">Email Address</Label>
                            <p class="text-sm font-medium">{data.user.email}</p>
                        </div>

                        <div class="space-y-2">
                            <Label for="role-display">User Role</Label>
                            <p class="text-sm font-medium capitalize">{data.user.systemRole.toLowerCase()}</p>
                        </div>

                        <div class="space-y-2">
                            <Label for="status-display">Account Status</Label>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {
                                data.user.status === 'ACTIVE'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                            }">
                                {data.user.status}
                            </span>
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-muted-foreground">
                            <div>
                                <span class="font-medium">Account Created:</span>
                                <p>{formatDate(data.user.createdAt)}</p>
                            </div>
                            <div>
                                <span class="font-medium">Last Updated:</span>
                                <p>{formatDate(data.user.updatedAt)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </UserCard>

        <!-- API Keys Section -->
        <Card class="w-full">
            <CardHeader>
                <div class="flex items-center justify-between">
                    <div>
                        <CardTitle class="flex items-center gap-2">
                            <Key class="w-5 h-5" />
                            API Keys
                        </CardTitle>
                        <CardDescription>Manage your API keys for accessing the API</CardDescription>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button
                                type="button"
                                class="whitespace-nowrap"
                                on:click={async () => {
                                try {
                                    const response = await fetch('/user/profile', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Accept': 'application/json'
                                        },
                                        // Include session cookie for authentication
                                        credentials: 'same-origin',
                                        body: JSON.stringify({
                                            name: `API Key ${new Date().toLocaleString()}`,
                                            description: ''
                                        })
                                    });

                                    const result = await response.json();

                                    if (!response.ok) {
                                        throw new Error(result.error?.message || 'Failed to create API key');
                                    }

                                    if (result.success && result.data) {
                                        const newKey = result.data;
                                        // Update the local state with the new key
                                        apiKeys = [newKey, ...apiKeys];
                                        newKeyData = newKey;
                                        showNewKeyDialog = true;
                                        toast.success(result.message || 'API key created successfully');
                                    } else {
                                        throw new Error(result.error?.message || 'Failed to create API key');
                                    }
                                } catch (error) {
                                    console.error('Error creating API key:', error);
                                    toast.error(error.message || 'An unexpected error occurred');
                                }
                            }}
                        >
                            <Plus class="w-4 h-4 mr-2" />
                            Create API Key
                        </Button>
                    </div>
            </CardHeader>
            <CardContent>
                {#if isLoading}
                    <div class="flex justify-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                {:else if error}
                    <div class="text-center py-8 text-destructive">
                        <p>{error}</p>
                        <Button variant="ghost" on:click={fetchApiKeys} class="mt-2">
                            <RefreshCw class="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                {:else if apiKeys.length === 0}
                    <div class="text-center py-8 text-muted-foreground">
                        <p>No API keys found. Create your first API key to get started.</p>
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each apiKeys as key}
                            <div class="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">{key.name}</span>
                                        <Badge variant={key.active ? 'default' : 'secondary'}>
                                            {key.active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p class="text-sm text-muted-foreground">
                                        Created {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                                        {key.lastUsedAt && ` • Last used ${formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}`}
                                    </p>
                                    {#if key.description}
                                        <p class="text-sm text-muted-foreground">{key.description}</p>
                                    {/if}

                                    <div class="mt-1 w-full">
                                        <SecureKeyDisplay
                                                apiKey={key.key}
                                                createdAt={key.createdAt}
                                                showVisibilityToggle={true}
                                                showCopyButton={true}
                                                className="py-1 w-full max-w-none"
                                                buttonClass="h-8 w-8 p-1 hover:bg-muted rounded"
                                        />
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Button
                                            variant="ghost"
                                            size="sm"
                                            on:click={() => toggleApiKey(key.id, key.active)}
                                    >
                                        {#if key.active}
                                            <ToggleLeft class="w-4 h-4 mr-2" />
                                        {:else}
                                            <ToggleRight class="w-4 h-4 mr-2" />
                                        {/if}
                                        {key.active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button
                                            variant="ghost"
                                            size="sm"
                                            on:click={() => confirmDeleteApiKey(key.id)}
                                    >
                                        <Trash2 class="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>
    </div>
</UserPageLayout>

<!-- Delete API Key Confirmation Dialog -->
<ConfirmationDialog
        bind:open={showDeleteDialog}
        title="Delete API Key"
        description="Are you sure you want to delete this API key? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteApiKey}
/>
