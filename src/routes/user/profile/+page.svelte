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
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { formatDistanceToNow } from "date-fns";
    import type { PageData } from "./$types";
    
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
    
    // API key management state
    let showNewKeyDialog = false;
    let newKeyData: { id: string; key: string; name: string } | null = null;
    let apiKeys = data.apiKeys || [];
    
    // Setup form for API key creation
    const { form, enhance, message } = superForm(data.form, {
        onResult: ({ result }) => {
            if (result.type === 'success') {
                if (result.data?.data) {
                    // Store the new key data for display
                    newKeyData = result.data.data;
                    showNewKeyDialog = true;
                    // Refresh the keys list
                    apiKeys = [...apiKeys, result.data.data];
                }
                toast.success(result.data?.message || 'API key created successfully');
            } else if (result.type === 'error') {
                toast.error(result.error?.message || 'Failed to create API key');
            }
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
    
    // Delete API key
    async function deleteApiKey(id: string) {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            return;
        }
        
        const formData = new FormData();
        formData.append('id', id);
        
        try {
            const response = await fetch('?/deleteApiKey', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Remove the key from the local state
                apiKeys = apiKeys.filter(key => key.id !== id);
                toast.success('API key deleted successfully');
            } else {
                toast.error(result.error || 'Failed to delete API key');
            }
        } catch (error) {
            toast.error('An error occurred while deleting the API key');
            console.error('Error deleting API key:', error);
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
                <Button on:click={() => showNewKeyDialog = true}>
                    <Plus class="w-4 h-4 mr-2" />
                    Create API Key
                </Button>
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
                                <div class="flex items-center gap-2 mt-1">
                                    <code class="text-xs bg-muted px-2 py-1 rounded">
                                        {key.key}
                                    </code>
                                    <Button variant="ghost" size="icon" on:click={() => copyToClipboard(key.key)} title="Copy to clipboard">
                                        <Copy class="w-4 h-4" />
                                    </Button>
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
                                    class="text-destructive hover:text-destructive"
                                    on:click={() => deleteApiKey(key.id)}
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

    <!-- New API Key Dialog -->
    <Dialog bind:open={showNewKeyDialog} on:close={() => showNewKeyDialog = false}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>New API Key</DialogTitle>
                <DialogDescription>
                    Create a new API key to authenticate with our API
                </DialogDescription>
            </DialogHeader>
            
            {#if newKeyData}
                <div class="space-y-4">
                    <div class="bg-muted/50 p-4 rounded-lg">
                        <p class="text-sm font-medium mb-2">Your new API key</p>
                        <div class="flex items-center gap-2">
                            <code class="flex-1 bg-background p-2 rounded text-sm break-all">
                                {newKeyData.key}
                            </code>
                            <Button variant="outline" size="icon" on:click={() => copyToClipboard(newKeyData.key)}>
                                <Copy class="w-4 h-4" />
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            Make sure to copy your API key now. You won't be able to see it again!
                        </p>
                    </div>
                    <DialogFooter>
                        <Button on:click={() => {
                            showNewKeyDialog = false;
                            newKeyData = null;
                        }}>
                            Done
                        </Button>
                    </DialogFooter>
                </div>
            {:else}
                <form method="POST" use:enhance class="space-y-4">
                    <div class="space-y-2">
                        <Label for="name">Name</Label>
                        <Input 
                            id="name" 
                            name="name" 
                            placeholder="e.g., Production Server"
                            required
                            bind:value={$form.name}
                        />
                        <p class="text-xs text-muted-foreground">
                            A descriptive name for this API key
                        </p>
                    </div>
                    
                    <div class="space-y-2">
                        <Label for="description">Description (Optional)</Label>
                        <Textarea 
                            id="description" 
                            name="description" 
                            placeholder="What's this key for?"
                            rows={3}
                            bind:value={$form.description}
                        />
                    </div>
                    
                    <div class="space-y-2">
                        <Label for="expiresAt">Expiration (Optional)</Label>
                        <Input 
                            type="datetime-local" 
                            id="expiresAt" 
                            name="expiresAt"
                            bind:value={$form.expiresAt}
                        />
                        <p class="text-xs text-muted-foreground">
                            Leave empty for no expiration
                        </p>
                    </div>
                    
                    <DialogFooter class="mt-6">
                        <Button variant="outline" on:click={(e) => {
                            e.preventDefault();
                            showNewKeyDialog = false;
                        }}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Create API Key
                        </Button>
                    </DialogFooter>
                </form>
            {/if}
        </DialogContent>
    </Dialog>
</UserPageLayout>
