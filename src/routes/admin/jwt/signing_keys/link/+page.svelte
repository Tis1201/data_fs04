<script lang="ts">
    import { Link, RotateCw, AlertCircle, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-svelte';
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
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
    
    // Create form handlers
    const { form: createForm, submitting: createSubmitting, enhance: createEnhance, message: createMessage } = superForm(data.createForm, {
        taintedMessage: false,
        validationMethod: 'oninput',
        resetForm: false,
        dataType: 'json',
        onSubmit: () => {
            toast.loading('Creating key...');
            return async ({ result }) => {
                if (result.type === 'success') {
                    toast.success('Key created successfully');
                } else if (result.type === 'error') {
                    toast.error('Failed to create key');
                } else {
                    toast.dismiss();
                }
            };
        },
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Link key created successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to create link key');
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
            return async ({ result }) => {
                if (result.type === 'success') {
                    toast.success('Key rotated successfully');
                } else if (result.type === 'error') {
                    toast.error('Failed to rotate key');
                } else {
                    toast.dismiss();
                }
            };
        },
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Link key rotated successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to rotate link key');
            }
            return result;
        }
    });
    
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
        // Submit the form programmatically
        const form = document.getElementById('rotate-key-form') as HTMLFormElement;
        if (form) {
            form.submit();
            toast.loading('Rotating key...');
        } else {
            toast.error('Form not found');
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
        'Factory Key'
    ];
</script>

<AdminPageLayout
    title="Link JWT Signing Key"
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
            keyType="LINK"
            title="Link Key"
            description="Used to sign link tokens for secure sharing"
            tokenCount={primaryKey ? "0" : undefined}
            badgeColor={{ bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" }}
        >
            <svelte:fragment slot="icon">
                <Link class="h-5 w-5" />
            </svelte:fragment>
            
            <svelte:fragment slot="actions">
                {#if primaryKey}
                    <form id="rotate-key-form" method="POST" action="?/rotateKey" use:rotateEnhance>
                        <input type="hidden" name="keyId" value={primaryKey.id} />
                    </form>
                {/if}
            </svelte:fragment>
            
            <svelte:fragment slot="messages">
                {#if $rotateMessage}
                    <div class="mt-4 p-3 rounded-md" class:bg-green-50={$rotateMessage.type === 'success'} class:bg-red-50={$rotateMessage.type === 'error'}>
                        <p class="text-sm" class:text-green-700={$rotateMessage.type === 'success'} class:text-red-700={$rotateMessage.type === 'error'}>
                            {$rotateMessage.text}
                        </p>
                    </div>
                {/if}
            </svelte:fragment>
            
            <svelte:fragment slot="create-form">
                <p class="text-muted-foreground mb-4">No active link key found. Create a new key to get started.</p>
                <form method="POST" action="?/createKey" use:createEnhance>
                    <input type="hidden" name="keyType" value="LINK" />
                    <Button type="submit" disabled={$createSubmitting}>
                        <Link class="mr-2 h-4 w-4" />
                        Create Link Key
                    </Button>
                </form>
                
                {#if $createMessage}
                    <div class="mt-4 p-3 rounded-md" class:bg-green-50={$createMessage.type === 'success'} class:bg-red-50={$createMessage.type === 'error'}>
                        <p class="text-sm" class:text-green-700={$createMessage.type === 'success'} class:text-red-700={$createMessage.type === 'error'}>
                            {$createMessage.text}
                        </p>
                    </div>
                {/if}
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
