<script lang="ts">
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
    import { Badge } from '$lib/components/ui/badge';
    import { Key, Trash2, Plus, Copy, Check, RefreshCw } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { toast } from 'svelte-sonner';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
        DialogTrigger,
    } from "$lib/components/ui/dialog";
    import { goto } from '$app/navigation';

    interface ApiKey {
        id: string;
        name: string;
        key: string;
        description: string | null;
        active: boolean;
        createdAt: string;
        expiresAt: string | null;
        lastUsedAt: string | null;
    }

    let apiKeys: ApiKey[] = [];
    let loading = true;
    let error: string | null = null;
    let copied = false;
    let copiedKeyId: string | null = null;
    let deleteKeyId: string | null = null;
    let deleteKeyName: string | null = null;
    let deleteDialogOpen = false;
    let regenerateKeyId: string | null = null;
    let regenerateKeyName: string | null = null;
    let regenerateDialogOpen = false;
    let regenerating = false;
    let deleting = false;
    let newApiKey: string | null = null;

    onMount(async () => {
        await loadApiKeys();
    });

    async function loadApiKeys() {
        try {
            loading = true;
            const response = await fetch('/api/api-keys');
            if (!response.ok) {
                throw new Error(`Error fetching API keys: ${response.statusText}`);
            }
            const data = await response.json();
            apiKeys = data.apiKeys;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('Failed to load API keys:', err);
        } finally {
            loading = false;
        }
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    }

    async function copyToClipboard(text: string, keyId: string) {
        try {
            await navigator.clipboard.writeText(text);
            copiedKeyId = keyId;
            toast.success('API key copied to clipboard');
            setTimeout(() => {
                copiedKeyId = null;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            toast.error('Failed to copy to clipboard');
        }
    }

    function openDeleteDialog(keyId: string, keyName: string) {
        deleteKeyId = keyId;
        deleteKeyName = keyName;
        deleteDialogOpen = true;
    }

    function openRegenerateDialog(keyId: string, keyName: string) {
        regenerateKeyId = keyId;
        regenerateKeyName = keyName;
        regenerateDialogOpen = true;
    }

    async function deleteApiKey() {
        if (!deleteKeyId) return;
        
        try {
            deleting = true;
            const response = await fetch(`/api/api-keys/${deleteKeyId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete API key');
            }
            
            toast.success('API key deleted successfully');
            await loadApiKeys();
        } catch (err) {
            console.error('Failed to delete API key:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to delete API key');
        } finally {
            deleting = false;
            deleteDialogOpen = false;
            deleteKeyId = null;
            deleteKeyName = null;
        }
    }

    async function regenerateApiKey() {
        if (!regenerateKeyId) return;
        
        try {
            regenerating = true;
            const response = await fetch(`/api/api-keys/${regenerateKeyId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    regenerate: true
                })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to regenerate API key');
            }
            
            const data = await response.json();
            newApiKey = data.apiKey.key;
            
            toast.success('API key regenerated successfully');
            await loadApiKeys();
        } catch (err) {
            console.error('Failed to regenerate API key:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to regenerate API key');
        } finally {
            regenerating = false;
            regenerateDialogOpen = false;
            regenerateKeyId = null;
            regenerateKeyName = null;
        }
    }
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>API Keys</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">API Keys</h2>
            <p class="text-muted-foreground">Manage API keys for external integrations and WebSocket connections</p>
        </div>
        <Button on:click={() => goto('/admin/api-keys/create')}>
            <Plus class="mr-2 h-4 w-4" />
            Create API Key
        </Button>
    </div>

    {#if newApiKey}
        <Card>
            <CardHeader>
                <CardTitle>API Key Regenerated</CardTitle>
                <CardDescription>
                    Your API key has been regenerated. Please copy it now as you won't be able to see it again.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="p-4 border border-yellow-200 rounded-md bg-yellow-50 text-yellow-800 mb-4">
                    <p class="font-medium">Important</p>
                    <p class="text-sm">This API key will only be displayed once. If you lose it, you'll need to generate a new one.</p>
                </div>
                
                <div class="flex">
                    <Input value={newApiKey} readonly class="font-mono text-sm flex-1" />
                    <Button variant="outline" class="ml-2" on:click={() => copyToClipboard(newApiKey, 'new')}>
                        {#if copiedKeyId === 'new'}
                            <Check class="h-4 w-4" />
                        {:else}
                            <Copy class="h-4 w-4" />
                        {/if}
                    </Button>
                </div>
            </CardContent>
            <CardFooter>
                <Button on:click={() => newApiKey = null}>Done</Button>
            </CardFooter>
        </Card>
    {/if}

    <Card>
        <CardHeader>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>
                API keys allow external applications to authenticate with the system.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {#if loading}
                <div class="space-y-4">
                    <Skeleton class="h-8 w-full" />
                    <Skeleton class="h-8 w-full" />
                    <Skeleton class="h-8 w-full" />
                </div>
            {:else if error}
                <div class="p-4 border border-destructive/50 rounded-md bg-destructive/10 text-destructive">
                    {error}
                </div>
            {:else if apiKeys.length === 0}
                <div class="text-center py-8 text-muted-foreground">
                    <Key class="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p>No API keys found</p>
                    <p class="text-sm">Create an API key to get started</p>
                </div>
            {:else}
                <div class="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Last Used</TableHead>
                                <TableHead class="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {#each apiKeys as apiKey}
                                <TableRow>
                                    <TableCell>
                                        <div>
                                            <p class="font-medium">{apiKey.name}</p>
                                            {#if apiKey.description}
                                                <p class="text-xs text-muted-foreground">{apiKey.description}</p>
                                            {/if}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={apiKey.active ? "success" : "secondary"}>
                                            {apiKey.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(apiKey.createdAt)}</TableCell>
                                    <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
                                    <TableCell class="text-right">
                                        <div class="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" on:click={() => copyToClipboard(apiKey.key, apiKey.id)}>
                                                {#if copiedKeyId === apiKey.id}
                                                    <Check class="h-4 w-4" />
                                                {:else}
                                                    <Copy class="h-4 w-4" />
                                                {/if}
                                            </Button>
                                            <Button size="sm" variant="outline" on:click={() => openRegenerateDialog(apiKey.id, apiKey.name)}>
                                                <RefreshCw class="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="destructive" on:click={() => openDeleteDialog(apiKey.id, apiKey.name)}>
                                                <Trash2 class="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            {/each}
                        </TableBody>
                    </Table>
                </div>
            {/if}
        </CardContent>
        <CardFooter>
            <p class="text-sm text-muted-foreground">
                API keys should be kept secure and not shared publicly.
            </p>
        </CardFooter>
    </Card>
</div>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={deleteDialogOpen}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
                Are you sure you want to delete the API key "{deleteKeyName}"? This action cannot be undone.
            </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button variant="outline" on:click={() => deleteDialogOpen = false} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" on:click={deleteApiKey} disabled={deleting}>
                {#if deleting}
                    <Skeleton class="h-4 w-4 mr-2 rounded-full" />
                    Deleting...
                {:else}
                    Delete
                {/if}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>

<!-- Regenerate Confirmation Dialog -->
<Dialog bind:open={regenerateDialogOpen}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Regenerate API Key</DialogTitle>
            <DialogDescription>
                Are you sure you want to regenerate the API key "{regenerateKeyName}"? The old key will be invalidated immediately.
            </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button variant="outline" on:click={() => regenerateDialogOpen = false} disabled={regenerating}>Cancel</Button>
            <Button variant="default" on:click={regenerateApiKey} disabled={regenerating}>
                {#if regenerating}
                    <Skeleton class="h-4 w-4 mr-2 rounded-full" />
                    Regenerating...
                {:else}
                    Regenerate
                {/if}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
