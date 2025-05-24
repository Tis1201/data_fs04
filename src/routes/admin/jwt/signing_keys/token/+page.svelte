<script lang="ts">
    import { Key, RotateCw, AlertCircle, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-svelte';
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { invalidateAll } from "$app/navigation";
    import { toast } from "svelte-sonner";
    
    // Import confirmation dialog
    import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
    
    // Layout components
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import ActionButton from '$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte';
    
    // UI components
    import { Button } from '$lib/components/ui/button';
    import SigningKeyDisplay from '$lib/components/ui_components_sveltekit/display/SigningKeyDisplay.svelte';
    
    // Types
    import type { PageData } from './$types';
    
    // Import form components
    import { superForm } from 'sveltekit-superforms/client';
    
    // Import page data from server
    export let data: PageData;
    
    // Import key history table
    import KeyHistoryTable from './table.svelte';
    
    // Loading state
    let isCreating = false;
    let isRotating = false;
    
    // Create key function
    async function createTokenKey() {
        try {
            isCreating = true;
            toast.loading('Creating token key...');
            
            const response = await fetch('/api/admin/jwt/signing_keys/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyType: 'TOKEN' })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                toast.success('Token key created successfully');
                // Refresh the page data
                await invalidateAll();
            } else {
                toast.error(result.message || 'Failed to create token key');
            }
        } catch (error) {
            toast.error('An error occurred while creating the token key');
            console.error('Error creating token key:', error);
        } finally {
            isCreating = false;
            toast.dismiss();
        }
    }
    
    // Rotate key function
    async function rotateTokenKey(keyId: string) {
        try {
            isRotating = true;
            toast.loading('Rotating token key...');
            
            const response = await fetch('/api/admin/jwt/signing_keys/rotate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyId })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                toast.success('Token key rotated successfully');
                // Refresh the page data
                await invalidateAll();
            } else {
                toast.error(result.message || 'Failed to rotate token key');
            }
        } catch (error) {
            toast.error('An error occurred while rotating the token key');
            console.error('Error rotating token key:', error);
        } finally {
            isRotating = false;
            toast.dismiss();
        }
    }
    
    // Get primary key from server data
    $: primaryKey = data.primaryKey;
    
    // Confirmation dialog state
    let showRotateConfirmation = false;
    
    // Handle rotate key button click
    function handleRotateKeyClick() {
        if (primaryKey) {
            showRotateConfirmation = true;
        } else {
            toast.error("No primary key found to rotate");
        }
    }
    
    // Handle rotate key confirmation
    function handleRotateConfirm() {
        if (primaryKey) {
            // Close the confirmation dialog first
            showRotateConfirmation = false;
            
            // Call the API to rotate the key
            rotateTokenKey(primaryKey.id);
        } else {
            toast.error('No primary key found to rotate');
        }
    }
    
    // Create props for the key history table
    $: tableProps = {
        records: data.keys || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: data.sort?.order || "desc"
        },
        loading: false,
        filters: {
            status: $page.url.searchParams.get('status') || ''
        }
    };
    
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
    actionButtons={[
        {
            label: "Back",
            icon: ArrowLeft,
            href: "/admin/jwt/signing_keys",
            variant: "outline"
        },
        {
            label: "Rotate Key",
            icon: RefreshCw,
            onClick: handleRotateKeyClick,
            variant: "default",
            disabled: !primaryKey
        }
    ]}
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
        <SigningKeyDisplay
            key={primaryKey}
            keyType="TOKEN"
            title="Token Key"
            description="Used to sign authentication tokens for API access"
            tokenCount={primaryKey ? "0" : undefined}
            badgeColor={{ bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" }}
        >
            <svelte:fragment slot="icon">
                <Key class="h-5 w-5" />
            </svelte:fragment>
            
            <svelte:fragment slot="actions">
                {#if primaryKey}
                    <!-- No form needed with API approach -->
                {/if}
            </svelte:fragment>
            
            <svelte:fragment slot="messages">
                <!-- Messages are now handled via toast notifications -->
            </svelte:fragment>
            
            <svelte:fragment slot="create-form">
                <p class="text-muted-foreground mb-4">No active token key found. Create a new key to get started.</p>
                <Button type="button" disabled={isCreating} on:click={createTokenKey}>
                    <Key class="mr-2 h-4 w-4" />
                    {isCreating ? 'Creating...' : 'Create Token Key'}
                </Button>
            </svelte:fragment>
        </SigningKeyDisplay>
        
        <!-- {#if data.keys && data.keys.length > 0} -->
            <div class="mt-6">
                <KeyHistoryTable props={tableProps} />
            </div>
        <!-- {/if} -->
        
       
    {/if}
    
    <!-- Confirmation Dialog for Key Rotation -->
    <ConfirmationDialog
        bind:open={showRotateConfirmation}
        title="Rotate JWT Signing Key"
        description="Are you sure you want to rotate this key? This will create a new primary key and mark the current one as inactive. The following changes will occur:\n\n• The well-known JWKs endpoint will be updated with the new key\n• The old key will remain in the well-known endpoint for token validation\n• New links will be signed with the new key\n• Existing links will still be valid until they expire\n\nThis operation cannot be undone."
        confirmText="Rotate Key"
        onConfirm={handleRotateConfirm}
    />
</AdminPageLayout>
