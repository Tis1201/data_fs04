<script lang="ts">
    import { KeyRound, RotateCw, AlertCircle, CheckCircle } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { toast } from 'svelte-sonner';
    
    // Layout components
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    
    // UI components
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    
    // Types
    import type { PageData } from './$types';
    
    // Import form components
    import { superForm } from 'sveltekit-superforms/client';
    
    // Import page data from server
    export let data: PageData;
    
    // Create form handlers
    const { form: createForm, submitting: createSubmitting, enhance: createEnhance, message: createMessage } = superForm(data.createForm, {
        taintedMessage: false,
        validationMethod: 'oninput',
        resetForm: false,
        dataType: 'json',
        onSubmit: () => {
            toast.loading('Creating key...');
        },
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Token key created successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to create token key');
            }
            return result;
        }
    });
    
    // Rotate form handlers
    const { form: rotateForm, submitting: rotateSubmitting, enhance: rotateEnhance, message: rotateMessage } = superForm(data.rotateForm, {
        taintedMessage: false,
        validationMethod: 'oninput',
        resetForm: false,
        dataType: 'json',
        onSubmit: () => {
            toast.loading('Rotating key...');
        },
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Token key rotated successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to rotate token key');
            }
            return result;
        }
    });
    
    // Get the primary key
    $: primaryKey = data.keys.find(key => key.isPrimary);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ['Admin', '/admin'],
        ['JWT', '/admin/jwt'],
        ['Signing Keys', '/admin/jwt/signing_keys'],
        'Token Key'
    ];
</script>

<AdminPageLayout
    title="Token JWT Signing Key"
    crumbs={pageCrumbs}
>
    {#if data.error}
        <AdminCard
            title="Database Setup Required"
            titleIcon={AlertCircle}
            titleClass="text-amber-600"
        >
            <p class="mb-4">{data.error.message}</p>
            <p class="text-sm text-muted-foreground">This feature requires a database migration to add the JwtSigningKey table. Please contact your system administrator.</p>
            {#if data.error.details}
                <div class="mt-4 p-3 bg-muted rounded-md">
                    <p class="text-xs font-mono">{data.error.details}</p>
                </div>
            {/if}
        </AdminCard>
    {:else}
        <Card class="w-full">
            <CardHeader>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <KeyRound class="h-5 w-5" />
                        <CardTitle>Token Key</CardTitle>
                    </div>
                    {#if primaryKey}
                        <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                    {:else}
                        <Badge variant="outline" class="bg-amber-50 text-amber-700 border-amber-200">Not Created</Badge>
                    {/if}
                </div>
                <CardDescription>Used to sign authentication tokens for users and services</CardDescription>
            </CardHeader>
            <CardContent>
                {#if primaryKey}
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm font-medium">Key ID</p>
                                <p class="text-sm text-muted-foreground">{primaryKey.keyId}</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium">Algorithm</p>
                                <p class="text-sm text-muted-foreground">{primaryKey.algorithm}</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium">Created</p>
                                <p class="text-sm text-muted-foreground">{new Date(primaryKey.createdAt).toLocaleString()}</p>
                            </div>
                            <div>
                                <p class="text-sm font-medium">Last Rotated</p>
                                <p class="text-sm text-muted-foreground">
                                    {primaryKey.rotatedAt ? new Date(primaryKey.rotatedAt).toLocaleString() : 'Never'}
                                </p>
                            </div>
                        </div>
                        
                        <form method="POST" action="?/rotateKey" use:rotateEnhance>
                            <input type="hidden" name="keyId" bind:value={primaryKey.id} />
                            <Button type="submit" variant="outline" class="w-full" disabled={rotateSubmitting}>
                                <RotateCw class="h-4 w-4 mr-2" />
                                Rotate Key
                            </Button>
                        </form>
                        
                        {#if $rotateMessage}
                            <div class="mt-4 p-3 rounded-md" class:bg-green-50={$rotateMessage.type === 'success'} class:bg-red-50={$rotateMessage.type === 'error'}>
                                <p class="text-sm" class:text-green-700={$rotateMessage.type === 'success'} class:text-red-700={$rotateMessage.type === 'error'}>
                                    {$rotateMessage.text}
                                </p>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="space-y-4">
                        <p class="text-sm text-muted-foreground">No token key has been created yet. Create one to enable authentication token signing.</p>
                        
                        <form method="POST" action="?/createKey" use:createEnhance>
                            <input type="hidden" name="keyType" value="TOKEN" />
                            <Button type="submit" variant="default" class="w-full" disabled={createSubmitting}>
                                <KeyRound class="h-4 w-4 mr-2" />
                                Create Token Key
                            </Button>
                        </form>
                        
                        {#if $createMessage}
                            <div class="mt-4 p-3 rounded-md" class:bg-green-50={$createMessage.type === 'success'} class:bg-red-50={$createMessage.type === 'error'}>
                                <p class="text-sm" class:text-green-700={$createMessage.type === 'success'} class:text-red-700={$createMessage.type === 'error'}>
                                    {$createMessage.text}
                                </p>
                            </div>
                        {/if}
                    </div>
                {/if}
            </CardContent>
        </Card>
        
        <AdminCard
            title="Token Key Guidelines"
            description="Best practices for managing token JWT signing keys"
        >
            <ul class="space-y-3">
                <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 class="font-medium">Authentication Tokens</h4>
                        <p class="text-sm text-muted-foreground">Token keys are used to sign authentication tokens for users and services</p>
                    </div>
                </li>
                <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 class="font-medium">Regular Rotation</h4>
                        <p class="text-sm text-muted-foreground">Rotate keys periodically for enhanced security</p>
                    </div>
                </li>
                <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 class="font-medium">Grace Period</h4>
                        <p class="text-sm text-muted-foreground">Old keys are kept for a grace period to verify existing tokens</p>
                    </div>
                </li>
            </ul>
        </AdminCard>
    {/if}
</AdminPageLayout>
