<script lang="ts">
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Pencil, User, Key, Plus, Copy, ToggleLeft, ToggleRight, Trash2, AlertCircle } from "lucide-svelte";
import SecureKeyDisplay from "$lib/components/ui_components_sveltekit/display/SecureKeyDisplay.svelte";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { formatDistanceToNow } from 'date-fns';
    import type { PageData } from "./$types";
    import { enhance as formEnhance } from '$app/forms';
    import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
    
    export let data: PageData;
    
    const pageCrumbs = [
        ["User", "/user"],
        "Profile"
    ];
    
    const title = "My Profile";
    
    // Sample user data - in a real implementation, this would come from the page data
    let userData = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        role: "Standard User"
    };
    
    let editMode = false;
    
    // API key state
    let showNewKeyDialog = false;
    let newKeyData: { id: string; key: string; name: string } | null = null;
    let apiKeys = data.apiKeys || [];
    
    // Delete dialog state
    let keyToDelete: string | null = null;
    let showDeleteDialog = false;
    
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
    
    // Setup form for API key creation
    const { form, enhance } = superForm(data.form, {
        onResult: (result) => {
            handleApiKeyResult(result);
        },
        resetForm: true
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
            const formData = new FormData();
            formData.append('id', keyToDelete);
            
            const response = await fetch('?/deleteApiKey', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.type === 'success') {
                apiKeys = apiKeys.filter(key => key.id !== keyToDelete);
                toast.success('API key deleted successfully');
            } else {
                toast.error(result.error?.message || 'Failed to delete API key');
            }
            
            // Close the dialog
            showDeleteDialog = false;
        } catch (error) {
            toast.error('Failed to delete API key');
            console.error('Error deleting API key:', error);
            showDeleteDialog = false;
        }
    }
    
    // Action buttons for the page layout
    const actionButtons = [
        {
            label: editMode ? 'Cancel Edit' : 'Edit Profile',
            icon: Pencil,
            onClick: () => editMode = !editMode,
            variant: "outline"
        }
    ];
</script>

<UserPageLayout 
    title={title} 
    crumbs={pageCrumbs}
    {actionButtons}
>
    <UserCard 
        title="User Information" 
        description="View and manage your profile information"
        icon={User}
    >
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                    <Label for="name">Full Name</Label>
                    {#if editMode}
                        <Input id="name" value={userData.name} />
                    {:else}
                        <p class="text-sm font-medium">{userData.name}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="email">Email Address</Label>
                    {#if editMode}
                        <Input id="email" value={userData.email} />
                    {:else}
                        <p class="text-sm font-medium">{userData.email}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="phone">Phone Number</Label>
                    {#if editMode}
                        <Input id="phone" value={userData.phone} />
                    {:else}
                        <p class="text-sm font-medium">{userData.phone}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="role">User Role</Label>
                    <p class="text-sm font-medium">{userData.role}</p>
                </div>
            </div>
            
            {#if editMode}
                <div class="flex justify-end gap-2">
                    <Button variant="outline" on:click={() => editMode = false}>Cancel</Button>
                    <Button>Save Changes</Button>
                </div>
            {/if}
        </div>
    </UserCard>

    <!-- API Keys Section -->
    <Card class="w-full mt-6">
        <CardHeader>
            <div class="flex items-center justify-between">
                <div>
                    <CardTitle class="flex items-center gap-2">
                        <Key class="w-5 h-5" />
                        API Keys
                    </CardTitle>
                    <CardDescription>Manage your API keys for accessing the API</CardDescription>
                </div>
                <form method="POST" action="?/createApiKey" use:formEnhance={({ form }) => {
                    return async ({ result }) => {
                        if (result.type === 'success') {
                            console.log('Form success result:', result);
                            if (result.data?.data) {
                                newKeyData = result.data.data;
                                showNewKeyDialog = true;
                            } else if (result.data?.key) {
                                newKeyData = result.data;
                                showNewKeyDialog = true;
                            }
                            toast.success('API key created successfully');
                        } else {
                            toast.error('Failed to create API key');
                        }
                    };
                }}>
                    <input type="hidden" name="name" value="API Key" />
                    <Button type="submit">
                        <Plus class="w-4 h-4 mr-2" />
                        Create API Key
                    </Button>
                </form>
            </div>
        </CardHeader>
        <CardContent>
            {#if apiKeys.length === 0}
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
