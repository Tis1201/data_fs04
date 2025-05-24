<script lang="ts">
    import { Factory, RotateCw, AlertCircle, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-svelte';
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { toast } from "svelte-sonner";
    
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
                toast.success('Factory key created successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to create factory key');
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
                toast.success('Factory key rotated successfully');
            } else if (result.type === 'failure') {
                toast.error('Failed to rotate factory key');
            }
            return result;
        }
    });
    
    // Get primary key from server data
    $: primaryKey = data.primaryKey;
    
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
    title="Factory JWT Signing Key"
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
            form: "rotate-key-form",
            type: "submit",
            variant: "default",
            disabled: !data.key
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
            keyType="FACTORY"
            title="Factory Key"
            description="Used to sign factory tokens for device provisioning"
            tokenCount={primaryKey ? "1,248" : undefined}
            badgeColor={{ bg: "bg-green-50", text: "text-green-700", border: "border-green-200" }}
        >
            <svelte:fragment slot="icon">
                <Factory class="h-5 w-5" />
            </svelte:fragment>
            
            <svelte:fragment slot="actions">
                <form id="rotate-key-form" method="POST" action="?/rotateKey" use:rotateEnhance>
                    <input type="hidden" name="keyId" bind:value={primaryKey.id} />
                </form>
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
                <form method="POST" action="?/createKey" use:createEnhance>
                    <input type="hidden" name="keyType" value="FACTORY" />
                    <Button type="submit" class="w-full" disabled={createSubmitting}>
                        Create Factory Key
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
</AdminPageLayout>
