<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Trash, ArrowUpDown, Plus } from 'lucide-svelte';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import { page } from "$app/stores";
    
    import type { BundleApp } from "@prisma/client";
    import AppSelector from "../app_select/AppSelector.svelte";
    
    export let bundleId: string;
    export let apps: (BundleApp & { resource: { name: string, id: string } })[] = [];
    
    // State for add app dialog
    let addDialogOpen = false;
    let autoOpen = false;
    let addingApp = false;
    let installationOrder = 1;
    
    // State for delete confirmation dialog
    let deleteDialogState = {
        selectedRecord: null as (BundleApp & { resource: { name: string, id: string } }) | null,
        confirmationOpen: false,
        title: "Remove App",
        message: "Are you sure you want to remove this app from the bundle? This action cannot be undone.",
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel"
    };
    
    // Calculate the next order number based on existing apps
    $: {
        if (apps.length > 0) {
            const maxOrder = Math.max(...apps.map(app => app.order));
            installationOrder = maxOrder + 1;
        } else {
            installationOrder = 1;
        }
    }
    
    // Calculate the next order number based on existing apps
    $: {
        if (apps.length > 0) {
            const maxOrder = Math.max(...apps.map(app => app.order));
            installationOrder = maxOrder + 1;
        } else {
            installationOrder = 1;
        }
    }
    

    
    // Function to open delete confirmation dialog
    function confirmDelete(bundleApp: BundleApp & { resource: { name: string, id: string } }) {
        deleteDialogState.selectedRecord = bundleApp;
        deleteDialogState.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        if (!deleteDialogState.selectedRecord) return;
        
        try {
            await api_delete(`/api/admin/iot/bundles/${bundleId}/apps/${deleteDialogState.selectedRecord.id}`);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        } finally {
            deleteDialogState.confirmationOpen = false;
            deleteDialogState.selectedRecord = null;
        }
    }
    
    // Handle app selection from AppSelector
    async function handleAppSelect(event: CustomEvent<{ detail: { id: string; name: string } }>) {
        const resource = event.detail;
        if (!resource) return;
        
        addingApp = true;
        
        try {
            await api_post(`/api/admin/iot/bundles/${bundleId}/apps`, {
                resourceId: resource.id,
                order: installationOrder,
                autoOpen
            });
            
            toast.success(`Added ${resource.name} to bundle`);
            await invalidate('app:bundle');
            
            // Reset form and close dialog
            addDialogOpen = false;
            autoOpen = false;
            
        } catch (error) {
            toast.error("Failed to add app to bundle");
            console.error(error);
        } finally {
            addingApp = false;
        }
    }
</script>

<!-- Bundle Apps Header and Add Button -->
<div class="flex justify-between items-center mb-2">
    <div>
        <h3 class="text-lg font-medium">Bundle Apps</h3>
        <p class="text-sm text-muted-foreground">{apps.length} app{apps.length !== 1 ? 's' : ''} in this bundle</p>
    </div>
    <Button variant="outline" size="sm" on:click={() => addDialogOpen = true}>
        <Plus class="h-4 w-4 mr-2" />
        Add App
    </Button>
</div>

<!-- App Selector Dialog -->
<AppSelector 
    bind:open={addDialogOpen}
    {bundleId}
    on:select={handleAppSelect}
    on:close={() => addDialogOpen = false}
    autoOpen={autoOpen}
    on:autoOpenChange={(e) => autoOpen = e.detail}
/>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    state={deleteDialogState}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    getDescription={(record) => `Are you sure you want to remove ${record?.resource?.name || 'this app'} from the bundle? This action cannot be undone.`}
/>

<!-- App List Table -->
<div class="w-full mt-1">
    <table class="w-full border-collapse">
        <thead>
            <tr class="border-b">
                <th class="text-left py-1.5 px-3 font-medium text-sm">Order</th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">App</th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">Auto Open</th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">Added</th>
                <th class="text-right py-1.5 px-3 font-medium text-sm">Actions</th>
            </tr>
        </thead>
        <tbody>
            {#if apps.length === 0}
                <tr>
                    <td colspan="5" class="py-3 text-center text-muted-foreground">
                        No apps added to this bundle yet
                    </td>
                </tr>
            {:else}
                {#each apps as app}
                    <tr class="border-b hover:bg-muted/50">
                        <td class="py-1.5 px-3">{app.order}</td>
                        <td class="py-1.5 px-3">{app.resource.name}</td>
                        <td class="py-1.5 px-3">{app.autoOpen ? 'Yes' : 'No'}</td>
                        <td class="py-1.5 px-3">
                            <RelativeDate date={app.createdAt} />
                        </td>
                        <td class="py-1.5 px-3 text-right">
                            <div class="flex justify-end space-x-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    title="Edit Order"
                                >
                                    <ArrowUpDown class="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    title="Remove App"
                                    on:click={() => confirmDelete(app)}
                                >
                                    <Trash class="h-4 w-4" />
                                </Button>
                            </div>
                        </td>
                    </tr>
                {/each}
            {/if}
        </tbody>
    </table>
</div>
