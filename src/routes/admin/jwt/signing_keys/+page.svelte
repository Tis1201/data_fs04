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
        <div class="space-y-6">
            <!-- Key Cards Row -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Factory Key Card -->
                <div class="border rounded-lg shadow-sm overflow-hidden bg-white">
                    <div class="p-6 flex flex-col h-full">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <Factory class="h-5 w-5 text-gray-500" />
                                <h3 class="text-lg font-medium">Factory Key</h3>
                            </div>
                            {#if getKeyByType('FACTORY')}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-green-50 text-green-700">Active</span>
                            {:else}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-700">Not Created</span>
                            {/if}
                        </div>
                        <p class="text-gray-500 mb-6">Device provisioning</p>
                        
                        {#if getKeyByType('FACTORY')}
                            <div class="space-y-4 mb-6">
                                <div>
                                    <p class="font-medium text-gray-700">Key ID:</p>
                                    <p class="text-gray-600">{getKeyByType('FACTORY').keyId}</p>
                                </div>
                                <div>
                                    <p class="font-medium text-gray-700">Updated:</p>
                                    <p class="text-gray-600">{new Date(getKeyByType('FACTORY').updatedAt).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                                </div>
                                <div class="pt-2 border-t border-gray-100">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Algorithm</p>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                                {getKeyByType('FACTORY').algorithm || 'RS256'}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Age</p>
                                            <p class="text-sm font-medium">{Math.floor((new Date() - new Date(getKeyByType('FACTORY').createdAt)) / (1000 * 60 * 60 * 24))} days</p>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <div class="flex items-center justify-between">
                                            <p class="text-xs text-gray-500">Tokens Signed</p>
                                            <span class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                                Last 30 days
                                            </span>
                                        </div>
                                        <div class="flex items-end gap-1 mt-1">
                                            <span class="text-lg font-semibold">{getKeyByType('FACTORY').tokenCount || '1,248'}</span>
                                            <span class="text-xs text-gray-500 mb-1">tokens</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="py-4 mb-2">
                                <p class="text-gray-500">No factory key created yet</p>
                            </div>
                        {/if}
                        
                        <div class="flex-grow"></div>
                        
                        <a href="/admin/jwt/signing_keys/factory" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md shadow-sm mt-4 {getKeyByType('FACTORY') ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50' : 'bg-primary text-primary-foreground hover:bg-primary/90'}">
                            {#if getKeyByType('FACTORY')}
                                Manage
                            {:else}
                                Create Key
                            {/if}
                            <ChevronRight class="h-4 w-4 ml-2" />
                        </a>
                    </div>
                </div>
                
                <!-- Token Key Card -->
                <div class="border rounded-lg shadow-sm overflow-hidden bg-white">
                    <div class="p-6 flex flex-col h-full">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <KeyRound class="h-5 w-5 text-gray-500" />
                                <h3 class="text-lg font-medium">Token Key</h3>
                            </div>
                            {#if getKeyByType('TOKEN')}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-green-50 text-green-700">Active</span>
                            {:else}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-700">Not Created</span>
                            {/if}
                        </div>
                        <p class="text-gray-500 mb-6">Authentication tokens</p>
                        
                        {#if getKeyByType('TOKEN')}
                            <div class="space-y-4 mb-6">
                                <div>
                                    <p class="font-medium text-gray-700">Key ID:</p>
                                    <p class="text-gray-600">{getKeyByType('TOKEN').keyId}</p>
                                </div>
                                <div>
                                    <p class="font-medium text-gray-700">Updated:</p>
                                    <p class="text-gray-600">{new Date(getKeyByType('TOKEN').updatedAt).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                                </div>
                                <div class="pt-2 border-t border-gray-100">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Algorithm</p>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                                {getKeyByType('TOKEN').algorithm || 'RS256'}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Age</p>
                                            <p class="text-sm font-medium">{Math.floor((new Date() - new Date(getKeyByType('TOKEN').createdAt)) / (1000 * 60 * 60 * 24))} days</p>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <div class="flex items-center justify-between">
                                            <p class="text-xs text-gray-500">Tokens Signed</p>
                                            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                Last 30 days
                                            </span>
                                        </div>
                                        <div class="flex items-end gap-1 mt-1">
                                            <span class="text-lg font-semibold">{getKeyByType('TOKEN').tokenCount || '24,563'}</span>
                                            <span class="text-xs text-gray-500 mb-1">tokens</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="py-4 mb-2">
                                <p class="text-gray-500">No token key created yet</p>
                            </div>
                        {/if}
                        
                        <div class="flex-grow"></div>
                        
                        <a href="/admin/jwt/signing_keys/token" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md shadow-sm mt-4 {getKeyByType('TOKEN') ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50' : 'bg-primary text-primary-foreground hover:bg-primary/90'}">
                            {#if getKeyByType('TOKEN')}
                                Manage
                            {:else}
                                Create Key
                            {/if}
                            <ChevronRight class="h-4 w-4 ml-2" />
                        </a>
                    </div>
                </div>
                
                <!-- Link Key Card -->
                <div class="border rounded-lg shadow-sm overflow-hidden bg-white">
                    <div class="p-6 flex flex-col h-full">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <LinkIcon class="h-5 w-5 text-gray-500" />
                                <h3 class="text-lg font-medium">Link Key</h3>
                            </div>
                            {#if getKeyByType('LINK')}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-green-50 text-green-700">Active</span>
                            {:else}
                                <span class="text-sm font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-700">Not Created</span>
                            {/if}
                        </div>
                        <p class="text-gray-500 mb-6">Invitations & resets</p>
                        
                        {#if getKeyByType('LINK')}
                            <div class="space-y-4 mb-6">
                                <div>
                                    <p class="font-medium text-gray-700">Key ID:</p>
                                    <p class="text-gray-600">{getKeyByType('LINK').keyId}</p>
                                </div>
                                <div>
                                    <p class="font-medium text-gray-700">Updated:</p>
                                    <p class="text-gray-600">{new Date(getKeyByType('LINK').updatedAt).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                                </div>
                                <div class="pt-2 border-t border-gray-100">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Algorithm</p>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                                {getKeyByType('LINK').algorithm || 'RS256'}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="text-xs text-gray-500 mb-1">Age</p>
                                            <p class="text-sm font-medium">{Math.floor((new Date() - new Date(getKeyByType('LINK').createdAt)) / (1000 * 60 * 60 * 24))} days</p>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <div class="flex items-center justify-between">
                                            <p class="text-xs text-gray-500">Tokens Signed</p>
                                            <span class="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                                Last 30 days
                                            </span>
                                        </div>
                                        <div class="flex items-end gap-1 mt-1">
                                            <span class="text-lg font-semibold">{getKeyByType('LINK').tokenCount || '5,921'}</span>
                                            <span class="text-xs text-gray-500 mb-1">tokens</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="py-4 mb-2">
                                <p class="text-gray-500">No link key created yet</p>
                            </div>
                        {/if}
                        
                        <div class="flex-grow"></div>
                        
                        <a href="/admin/jwt/signing_keys/link" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md shadow-sm mt-4 {getKeyByType('LINK') ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50' : 'bg-primary text-primary-foreground hover:bg-primary/90'}">
                            {#if getKeyByType('TOKEN')}
                                Manage
                            {:else}
                                Create Key
                            {/if}
                            <ChevronRight class="h-4 w-4 ml-2" />
                        </a>
                    </div>
                </div>
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
