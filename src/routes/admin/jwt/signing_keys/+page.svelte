<script lang="ts">
    import { Key, RotateCw, AlertCircle, CheckCircle, Clock, KeyRound, Link as LinkIcon, Factory, ChevronRight } from 'lucide-svelte';
    import { page } from '$app/stores';
    
    // Layout components
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    
    // UI components
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    
    // Types
    import type { PageData } from './$types';
    import type { JwtKeyType } from '$lib/server/jwt_issuer/keys/types';
    
    // Import page data from server
    export let data: PageData;
    
    // Get key by type
    function getKeyByType(type: JwtKeyType) {
        return data.keys.find(key => key.keyType === type && key.isPrimary);
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ['Admin', '/admin'],
        ['JWT', '/admin/jwt'],
        'Signing Keys'
    ];
</script>

<AdminPageLayout
    title="JWT Signing Keys"
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
        <div class="grid grid-cols-1 gap-6">
            <!-- Key Cards Row -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Factory Key Card -->
                <Card class="w-full">
                    <div class="flex flex-col h-full">
                        <CardHeader class="pb-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <Factory class="h-5 w-5" />
                                    <CardTitle>Factory Key</CardTitle>
                                </div>
                                {#if getKeyByType('FACTORY')}
                                    <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                {:else}
                                    <Badge variant="outline" class="bg-amber-50 text-amber-700 border-amber-200">Not Created</Badge>
                                {/if}
                            </div>
                            <CardDescription>Device provisioning</CardDescription>
                        </CardHeader>
                        <CardContent class="flex-grow pb-2">
                            {#if getKeyByType('FACTORY')}
                                <div class="text-sm">
                                    <div class="flex justify-between mb-1">
                                        <span class="font-medium">Key ID:</span>
                                        <span class="text-muted-foreground">{getKeyByType('FACTORY').keyId.substring(0, 8)}...</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="font-medium">Updated:</span>
                                        <span class="text-muted-foreground">{new Date(getKeyByType('FACTORY').updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            {:else}
                                <p class="text-sm text-muted-foreground">No factory key created yet</p>
                            {/if}
                        </CardContent>
                        <CardFooter class="pt-0">
                            <Button variant="outline" class="w-full" href="/admin/jwt/signing_keys/factory">
                                Manage
                                <ChevronRight class="h-4 w-4 ml-2" />
                            </Button>
                        </CardFooter>
                    </div>
                </Card>
                
                <!-- Token Key Card -->
                <Card class="w-full">
                    <div class="flex flex-col h-full">
                        <CardHeader class="pb-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <KeyRound class="h-5 w-5" />
                                    <CardTitle>Token Key</CardTitle>
                                </div>
                                {#if getKeyByType('TOKEN')}
                                    <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                {:else}
                                    <Badge variant="outline" class="bg-amber-50 text-amber-700 border-amber-200">Not Created</Badge>
                                {/if}
                            </div>
                            <CardDescription>Authentication tokens</CardDescription>
                        </CardHeader>
                        <CardContent class="flex-grow pb-2">
                            {#if getKeyByType('TOKEN')}
                                <div class="text-sm">
                                    <div class="flex justify-between mb-1">
                                        <span class="font-medium">Key ID:</span>
                                        <span class="text-muted-foreground">{getKeyByType('TOKEN').keyId.substring(0, 8)}...</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="font-medium">Updated:</span>
                                        <span class="text-muted-foreground">{new Date(getKeyByType('TOKEN').updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            {:else}
                                <p class="text-sm text-muted-foreground">No token key created yet</p>
                            {/if}
                        </CardContent>
                        <CardFooter class="pt-0">
                            <Button variant="outline" class="w-full" href="/admin/jwt/signing_keys/token">
                                Manage
                                <ChevronRight class="h-4 w-4 ml-2" />
                            </Button>
                        </CardFooter>
                    </div>
                </Card>
                
                <!-- Link Key Card -->
                <Card class="w-full">
                    <div class="flex flex-col h-full">
                        <CardHeader class="pb-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <LinkIcon class="h-5 w-5" />
                                    <CardTitle>Link Key</CardTitle>
                                </div>
                                {#if getKeyByType('LINK')}
                                    <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                {:else}
                                    <Badge variant="outline" class="bg-amber-50 text-amber-700 border-amber-200">Not Created</Badge>
                                {/if}
                            </div>
                            <CardDescription>Invitations & resets</CardDescription>
                        </CardHeader>
                        <CardContent class="flex-grow pb-2">
                            {#if getKeyByType('LINK')}
                                <div class="text-sm">
                                    <div class="flex justify-between mb-1">
                                        <span class="font-medium">Key ID:</span>
                                        <span class="text-muted-foreground">{getKeyByType('LINK').keyId.substring(0, 8)}...</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="font-medium">Updated:</span>
                                        <span class="text-muted-foreground">{new Date(getKeyByType('LINK').updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            {:else}
                                <p class="text-sm text-muted-foreground">No link key created yet</p>
                            {/if}
                        </CardContent>
                        <CardFooter class="pt-0">
                            <Button variant="outline" class="w-full" href="/admin/jwt/signing_keys/link">
                                Manage
                                <ChevronRight class="h-4 w-4 ml-2" />
                            </Button>
                        </CardFooter>
                    </div>
                </Card>
            </div>
        
            <AdminCard
                title="Key Rotation Guidelines"
                description="Best practices for managing your JWT signing keys"
            >
            <ul class="space-y-3">
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
                <li class="flex items-start gap-3">
                    <AlertCircle class="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 class="font-medium">Factory Key Warning</h4>
                        <p class="text-sm text-muted-foreground">Rotating the factory key requires re-provisioning of devices</p>
                    </div>
                </li>
            </ul>
            </AdminCard>
        </div>
    {/if}
</AdminPageLayout>
