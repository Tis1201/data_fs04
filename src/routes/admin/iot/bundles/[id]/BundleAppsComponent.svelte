<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Select from "$lib/components/ui/select";
    import { Trash, ArrowUpDown, Plus, Search } from 'lucide-svelte';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    
    import type { BundleApp } from "@prisma/client";
    
    export let bundleId: string;
    export let apps: (BundleApp & { resource: { name: string, id: string } })[] = [];
    export let resources: { id: string, name: string }[] = [];
    
    // State for the add dialog
    let addDialogOpen = false;
    let selectedResourceId = '';
    let installationOrder = 1;
    let autoOpen = false;
    let searchQuery = '';
    
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
    
    // Filtered resources based on search query
    $: filteredResources = resources.filter(resource => 
        resource.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
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
    
    // Handle add app submission
    async function handleAddApp() {
        if (!selectedResourceId) {
            toast.error("Please select an app");
            return;
        }
        
        try {
            await api_post(`/api/admin/iot/bundles/${bundleId}/apps`, {
                resourceId: selectedResourceId,
                order: installationOrder,
                autoOpen
            });
            
            toast.success("App added to bundle successfully");
            await invalidate('app:bundle');
            
            // Reset form and close dialog
            selectedResourceId = '';
            autoOpen = false;
            addDialogOpen = false;
            searchQuery = '';
            
        } catch (error) {
            toast.error("Failed to add app to bundle");
            console.error(error);
        }
    }
    
    // Reset form when dialog opens
    function onDialogOpen() {
        // Calculate the next order number
        if (apps.length > 0) {
            const maxOrder = Math.max(...apps.map(app => app.order));
            installationOrder = maxOrder + 1;
        } else {
            installationOrder = 1;
        }
        
        selectedResourceId = '';
        autoOpen = false;
        searchQuery = '';
    }
</script>

<!-- Add App Dialog -->
<Dialog.Root bind:open={addDialogOpen} onOpenChange={onDialogOpen}>
    <Dialog.Trigger asChild let:builder>
        <Button variant="outline" size="sm" builders={[builder]}>
            <Plus class="h-4 w-4 mr-2" />
            Add App
        </Button>
    </Dialog.Trigger>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Add App to Bundle</Dialog.Title>
            <Dialog.Description>
                Select an app to add to this bundle
            </Dialog.Description>
        </Dialog.Header>
        
        <div class="space-y-4 py-4">
            <!-- Search input -->
            <div class="relative">
                <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="text" 
                    placeholder="Search apps..." 
                    bind:value={searchQuery}
                    class="pl-8"
                />
            </div>
            
            <!-- App selection -->
            <FormRow>
                <FormField
                    name="resourceId"
                    label="App"
                    required={true}
                >
                    <Select.Root bind:value={selectedResourceId}>
                        <Select.Trigger class="w-full">
                            <Select.Value placeholder="Select an app" />
                        </Select.Trigger>
                        <Select.Content>
                            {#each filteredResources as resource}
                                <Select.Item value={resource.id}>{resource.name}</Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </FormField>
            </FormRow>
            
            <!-- Installation order -->
            <FormRow>
                <FormField
                    name="order"
                    label="Installation Order"
                    required={true}
                >
                    <Input
                        type="number"
                        min="1"
                        bind:value={installationOrder}
                    />
                </FormField>
            </FormRow>
            
            <!-- Auto open switch -->
            <FormRow>
                <FormField
                    name="autoOpen"
                    label="Auto Open"
                >
                    <div class="flex items-center space-x-2">
                        <Switch
                            id="autoOpen"
                            bind:checked={autoOpen}
                        />
                        <Label for="autoOpen">Automatically open app after installation</Label>
                    </div>
                </FormField>
            </FormRow>
        </div>
        
        <Dialog.Footer>
            <Button variant="outline" on:click={() => addDialogOpen = false}>Cancel</Button>
            <Button on:click={handleAddApp}>Add App</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    state={deleteDialogState}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    getDescription={(record) => `Are you sure you want to remove ${record?.resource?.name || 'this app'} from the bundle? This action cannot be undone.`}
/>

<!-- App List Table -->
<div class="w-full">
    <table class="w-full border-collapse">
        <thead>
            <tr class="border-b">
                <th class="text-left py-2 px-4 font-medium text-sm">Order</th>
                <th class="text-left py-2 px-4 font-medium text-sm">App</th>
                <th class="text-left py-2 px-4 font-medium text-sm">Auto Open</th>
                <th class="text-left py-2 px-4 font-medium text-sm">Added</th>
                <th class="text-right py-2 px-4 font-medium text-sm">Actions</th>
            </tr>
        </thead>
        <tbody>
            {#if apps.length === 0}
                <tr>
                    <td colspan="5" class="py-4 text-center text-muted-foreground">
                        No apps added to this bundle yet
                    </td>
                </tr>
            {:else}
                {#each apps as app}
                    <tr class="border-b hover:bg-muted/50">
                        <td class="py-2 px-4">{app.order}</td>
                        <td class="py-2 px-4">{app.resource.name}</td>
                        <td class="py-2 px-4">{app.autoOpen ? 'Yes' : 'No'}</td>
                        <td class="py-2 px-4">
                            <RelativeDate date={app.createdAt} />
                        </td>
                        <td class="py-2 px-4 text-right">
                            <div class="flex justify-end space-x-2">
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
