<script lang="ts">
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import { Key, AlertTriangle, Copy, Check } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { toast } from 'svelte-sonner';
    import { Skeleton } from '$lib/components/ui/skeleton';

    let name = '';
    let description = '';
    let loading = false;
    let error: string | null = null;
    let newApiKey: string | null = null;
    let copied = false;

    async function createApiKey() {
        if (!name.trim()) {
            error = 'Name is required';
            return;
        }

        loading = true;
        error = null;

        try {
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description: description.trim() || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create API key');
            }

            newApiKey = data.apiKey.key;
            toast.success('API key created successfully');
        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('Failed to create API key:', err);
            toast.error('Failed to create API key');
        } finally {
            loading = false;
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
            toast.success('API key copied to clipboard');
            setTimeout(() => {
                copied = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            toast.error('Failed to copy to clipboard');
        }
    }

    function goToApiKeys() {
        goto('/admin/api-keys');
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
                <a href="/admin/api-keys" class="text-sm font-medium underline-offset-4 hover:underline">API Keys</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Create</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div>
        <h2 class="text-3xl font-bold tracking-tight">Create API Key</h2>
        <p class="text-muted-foreground">Generate a new API key for external integrations</p>
    </div>

    {#if newApiKey}
        <Card>
            <CardHeader>
                <CardTitle>API Key Created</CardTitle>
                <CardDescription>
                    Your new API key has been generated. Please copy it now as you won't be able to see it again.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="warning" class="mb-4">
                    <AlertTriangle class="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                        This API key will only be displayed once. If you lose it, you'll need to generate a new one.
                    </AlertDescription>
                </Alert>
                
                <div class="space-y-4">
                    <div>
                        <Label>API Key</Label>
                        <div class="flex mt-1.5">
                            <Input value={newApiKey} readonly class="font-mono text-sm flex-1" />
                            <Button variant="outline" class="ml-2" on:click={() => copyToClipboard(newApiKey || '')}>
                                {#if copied}
                                    <Check class="h-4 w-4" />
                                {:else}
                                    <Copy class="h-4 w-4" />
                                {/if}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button on:click={goToApiKeys}>Done</Button>
            </CardFooter>
        </Card>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>New API Key</CardTitle>
                <CardDescription>
                    Create a new API key for external applications to authenticate with the system.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {#if error}
                    <Alert variant="destructive" class="mb-4">
                        <AlertTriangle class="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                {/if}
                
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label for="name">Name</Label>
                        <Input id="name" bind:value={name} placeholder="My API Key" />
                    </div>
                    
                    <div class="space-y-2">
                        <Label for="description">Description (optional)</Label>
                        <Textarea 
                            id="description" 
                            bind:value={description} 
                            placeholder="What this API key will be used for"
                            rows={3}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter class="flex justify-between">
                <Button variant="outline" on:click={goToApiKeys}>Cancel</Button>
                <Button on:click={createApiKey} disabled={loading}>
                    {#if loading}
                        <Skeleton class="h-4 w-4 mr-2 rounded-full" />
                        Creating...
                    {:else}
                        <Key class="mr-2 h-4 w-4" />
                        Create API Key
                    {/if}
                </Button>
            </CardFooter>
        </Card>
    {/if}
</div>
