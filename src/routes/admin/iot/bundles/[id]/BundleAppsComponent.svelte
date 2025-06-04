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
    import { Trash, ArrowUpDown, Plus, Search } from 'lucide-svelte';
    import ResourceSelect from "$lib/components/ui_components_sveltekit/form/ResourceSelect.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import { page } from "$app/stores";
    
    import type { BundleApp } from "@prisma/client";
    
    export let bundleId: string;
    export let apps: (BundleApp & { resource: { name: string, id: string } })[] = [];
    export let resources: { id: string, name: string }[] = [];
    
    // State for add app dialog
    let addDialogOpen = false;
    let selectedResourceId = "";
    let autoOpen = false;
    let addingApp = false;
    let searchLoading = false;
    let searchQuery = "";
    let searchType = "APK";
    let searchResults = resources;
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
    
    // Watch for URL changes to trigger search
    $: {
        if ($page.url.searchParams.has('search')) {
            const query = $page.url.searchParams.get('search') || '';
            performSearch(query, searchType);
        }
    }
    
    // Server-side search function
    async function performSearch(query, type = "APK") {
        searchLoading = true;
        searchQuery = query;
        searchType = type;
        
        try {
            // Build the URL with search parameters
            const url = new URL(`/admin/iot/bundles/${bundleId}/apps/add`, window.location.origin);
            url.searchParams.set('query', query);
            url.searchParams.set('type', type);
            
            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            searchResults = data.resources || [];
        } catch (error) {
            console.error('Error searching resources:', error);
            searchResults = [];
        } finally {
            searchLoading = false;
        }
    }
    
    // Legacy handler for direct ResourceSelect search
    async function handleResourceSearch(query, type = "APK") {
        performSearch(query, type);
    }
    
    // Handle add app submission
    async function handleAddApp() {
        if (!selectedResourceId) {
            toast.error("Please select an app");
            return;
        }
        
        addingApp = true;
        
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
            searchResults = resources;
            
        } catch (error) {
            toast.error("Failed to add app to bundle");
            console.error(error);
        } finally {
            addingApp = false;
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

<!-- Add App Dialog -->
<Dialog.Root bind:open={addDialogOpen} onOpenChange={onDialogOpen}>
    <!-- Dialog Content -->
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Add App to Bundle</Dialog.Title>
            <Dialog.Description>
                Select an app to add to this bundle
            </Dialog.Description>
        </Dialog.Header>
    
    <div class="space-y-4 py-4">
        <!-- Search filter -->
        <div class="mb-4">
            <DebouncedTextFilter
                placeholder="Search apps..."
                paramName="search"
                value={$page.url.searchParams.get('search') || ''}
                className="w-full"
            />
        </div>
        
        <!-- App selection -->
        <FormRow>
            <FormField
                id="resourceId"
                label="App"
                required={true}
            >
                <ResourceSelect
                    bind:value={selectedResourceId}
                    placeholder="Select an app"
                    searchPlaceholder="Search apps..."
                    resources={searchResults}
                    required={true}
                    loading={searchLoading}
                    resourceType={searchType}
                />
            </FormField>
        </FormRow>
        
        <!-- Installation order -->
        <FormRow>
            <FormField
                id="order"
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
                id="autoOpen"
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
