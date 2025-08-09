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
    import * as Popover from "$lib/components/ui/popover";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Separator } from "$lib/components/ui/separator";
    import { Trash, ArrowUpDown, Plus, Filter, Check, Search as SearchIcon } from 'lucide-svelte';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import { page } from "$app/stores";
    
    import type { BundleApp } from "@prisma/client";
    import AppSelector from "../app_select/AppSelector.svelte";
    
    export let bundleId: string;
    export let apps: (BundleApp & { resource: { name: string, id: string } })[] = [];
    // Local display copy for optimistic updates
    let displayApps: (BundleApp & { resource: { name: string, id: string } })[] = apps;
    let lastAppsRef = apps;
    $: if (apps !== lastAppsRef) {
        // Only resync when parent prop reference changes (after invalidate)
        displayApps = apps;
        lastAppsRef = apps;
    }
    // Search and filters (local-only, like devices)
    let searchTerm = '';
    let filterOpen = false;
    type YesNo = 'YES' | 'NO';
    type AppFilters = { autoOpen: Record<YesNo, boolean> };
    let filters: AppFilters = { autoOpen: { YES: false, NO: false } };
    $: filteredApps = displayApps.filter((a) => {
        const matchesSearch = !searchTerm || a.resource.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        const autoOpenActive = Object.values(filters.autoOpen).some(v => v);
        const matchesAuto = !autoOpenActive || (filters.autoOpen.YES && a.autoOpen) || (filters.autoOpen.NO && !a.autoOpen);
        return matchesAuto;
    });
    // Sorting like devices
    let sortField: 'resource.name' | 'order' | 'autoOpen' | 'createdAt' = 'resource.name';
    let sortOrder: 'asc' | 'desc' = 'asc';
    function toggleSort(field: typeof sortField) {
        if (sortField === field) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        else { sortField = field; sortOrder = 'asc'; }
    }
    $: sortedApps = [...filteredApps].sort((a, b) => {
        let va: any, vb: any;
        if (sortField === 'resource.name') { va = a.resource.name; vb = b.resource.name; }
        else if (sortField === 'order') { va = a.order; vb = b.order; }
        else if (sortField === 'autoOpen') { va = a.autoOpen ? 1 : 0; vb = b.autoOpen ? 1 : 0; }
        else { va = a.createdAt; vb = b.createdAt; return sortOrder === 'asc' ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime(); }
        if (typeof va === 'string' && typeof vb === 'string') return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortOrder === 'asc' ? va - vb : vb - va;
    });
    // Batch selection
    let selectedIds: string[] = [];
    $: allSelected = apps.length > 0 && apps.every(a => selectedIds.includes(a.id));
    function toggleSelectAll() {
        selectedIds = allSelected ? [] : apps.map(a => a.id);
    }
    function toggleRowSelection(id: string) {
        selectedIds = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    }
    async function batchRemoveSelected() {
        if (selectedIds.length === 0) return;
        const confirmed = window.confirm(`Remove ${selectedIds.length} app(s) from this bundle?`);
        if (!confirmed) return;
        try {
            const promises = selectedIds.map((id) => api_delete(`/api/admin/iot/bundles/${bundleId}/apps/${id}`, id));
            await Promise.all(promises);
            toast.success(`Removed ${selectedIds.length} app(s)`);
            // Optimistic local update
            displayApps = displayApps.filter(a => !selectedIds.includes(a.id));
            selectedIds = [];
            await invalidate('app:bundle');
        } catch (e) {
            console.error(e);
            toast.error('Failed to remove selected apps');
        }
    }
    
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
        const idToRemove = deleteDialogState.selectedRecord.id;
        // Close dialog before async to avoid UI lag
        deleteDialogState.confirmationOpen = false;
        deleteDialogState.selectedRecord = null;
        // Optimistic local update immediately
        displayApps = displayApps.filter(a => a.id !== idToRemove);
        try {
            await api_delete(`/api/admin/iot/bundles/${bundleId}/apps/${idToRemove}`, idToRemove);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        }
    }
    
    // Handle app selection from AppSelector
    async function handleAppSelect(event: CustomEvent<{ id: string; name: string; autoOpen: boolean }[]>) {
        const selected = event.detail;
        if (!selected || selected.length === 0) return;
        
        addingApp = true;
        
        try {
            // Add multiple apps similar to device add
            const promises = selected.map((res, idx) => api_post(`/api/admin/iot/bundles/${bundleId}/apps`, {
                resourceId: res.id,
                order: installationOrder + idx,
                autoOpen: res.autoOpen
            }));
            await Promise.all(promises);
            
            toast.success(`Added ${selected.length} app${selected.length !== 1 ? 's' : ''} to bundle`);
            // Optimistically append to displayApps so UI updates immediately
            displayApps = [
                ...displayApps,
                ...selected.map((res, idx) => ({
                    id: `temp-${res.id}-${Date.now()}-${idx}`,
                    bundleId,
                    resourceId: res.id,
                    order: installationOrder + idx,
                    autoOpen: res.autoOpen,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: 'me',
                    updatedBy: 'me',
                    resource: { id: res.id, name: res.name }
                }))
            ];
            await invalidate('app:bundle');
            
            // Reset form and close dialog
            addDialogOpen = false;
            autoOpen = false;
            
        } catch (error) {
            toast.error("Failed to add app(s) to bundle");
            console.error(error);
        } finally {
            addingApp = false;
        }
    }
</script>

<!-- Count (page card already has title/description) -->
<div class="flex justify-between items-center mb-2">
    <div>
        <p class="text-sm text-muted-foreground">{apps.length} app{apps.length !== 1 ? 's' : ''} in this bundle</p>
    </div>
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
    <!-- Selected banner (batch actions) -->
    {#if selectedIds.length > 0}
        <div class="flex items-center justify-between mb-3 p-2 border rounded-md bg-muted/40">
            <div class="text-sm">{selectedIds.length} selected</div>
            <div class="flex items-center gap-2">
                <Button variant="destructive" size="sm" on:click={batchRemoveSelected}>Remove Selected</Button>
            </div>
        </div>
    {/if}

    <!-- Controls: search + filter + add -->
    <div class="flex justify-between items-center mb-3">
        <div class="relative w-72">
            <SearchIcon class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search apps..." class="pl-8 w-full" bind:value={searchTerm} />
        </div>
        <div class="flex items-center gap-2">
            <Popover.Root bind:open={filterOpen}>
                <Popover.Trigger>
                    <div>
                        <Button variant="outline" size="sm" class="flex items-center gap-1">
                            <Filter class="h-4 w-4" />
                            Filter
                        </Button>
                    </div>
                </Popover.Trigger>
                <Popover.Content class="w-72 p-0" align="end">
                    <div class="p-4 pb-0">
                        <h4 class="font-medium leading-none mb-2">Filter Apps</h4>
                        <p class="text-sm text-muted-foreground">Select options to filter the app list.</p>
                    </div>
                    <div class="p-4">
                        <h5 class="text-sm font-medium mb-2">Auto Open</h5>
                        <div class="grid grid-cols-1 gap-2">
                            <div class="flex items-center space-x-2">
                                <Checkbox id="auto-open-yes" bind:checked={filters.autoOpen.YES} />
                                <Label for="auto-open-yes" class="text-sm font-normal">Yes</Label>
                            </div>
                            <div class="flex items-center space-x-2">
                                <Checkbox id="auto-open-no" bind:checked={filters.autoOpen.NO} />
                                <Label for="auto-open-no" class="text-sm font-normal">No</Label>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between p-4 pt-0">
                        <Button variant="ghost" size="sm" on:click={() => { filters.autoOpen.YES = false; filters.autoOpen.NO = false; }}>Reset</Button>
                        <Button variant="outline" size="sm" on:click={() => filterOpen = false}><Check class="h-4 w-4 mr-1" /> Apply</Button>
                    </div>
                </Popover.Content>
            </Popover.Root>
            <Button variant="outline" size="sm" on:click={() => addDialogOpen = true} disabled={($page?.data?.bundle?.status || '').toUpperCase() !== 'DRAFT'} title={($page?.data?.bundle?.status || '').toUpperCase() !== 'DRAFT' ? 'Not editable: bundle already published' : undefined}>
                <Plus class="h-4 w-4 mr-2" />
                Add App
            </Button>
        </div>
    </div>

    <table class="w-full border-collapse">
        <thead>
            <tr class="border-b">
                <th class="text-left py-1.5 px-3 font-medium text-sm w-10">
                    <button type="button" class="inline-flex" on:click|stopPropagation={toggleSelectAll} aria-label="Select all">
                        <Checkbox checked={allSelected} />
                    </button>
                </th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">
                    <button class="flex items-center gap-1 hover:text-primary" on:click={() => toggleSort('order')}>
                        <span>Order</span>
                        <ArrowUpDown class="h-3.5 w-3.5" />
                    </button>
                </th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">
                    <button class="flex items-center gap-1 hover:text-primary" on:click={() => toggleSort('resource.name')}>
                        <span>App</span>
                        <ArrowUpDown class="h-3.5 w-3.5" />
                    </button>
                </th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">
                    <button class="flex items-center gap-1 hover:text-primary" on:click={() => toggleSort('autoOpen')}>
                        <span>Auto Open</span>
                        <ArrowUpDown class="h-3.5 w-3.5" />
                    </button>
                </th>
                <th class="text-left py-1.5 px-3 font-medium text-sm">
                    <button class="flex items-center gap-1 hover:text-primary" on:click={() => toggleSort('createdAt')}>
                        <span>Added</span>
                        <ArrowUpDown class="h-3.5 w-3.5" />
                    </button>
                </th>
                <th class="text-right py-1.5 px-3 font-medium text-sm">Actions</th>
            </tr>
        </thead>
        <tbody>
            {#if filteredApps.length === 0}
                <tr>
                    <td colspan="5" class="py-3 text-center text-muted-foreground">
                        No apps added to this bundle yet
                    </td>
                </tr>
            {:else}
                {#each sortedApps as app}
                    <tr class="border-b hover:bg-muted/50">
                        <td class="py-1.5 px-3 w-10">
                            <button type="button" class="inline-flex" on:click|stopPropagation={() => toggleRowSelection(app.id)} aria-label={`Select ${app.resource.name}`}>
                                <Checkbox checked={selectedIds.includes(app.id)} />
                            </button>
                        </td>
                        <td class="py-1.5 px-3">{app.order}</td>
                        <td class="py-1.5 px-3">
                            <a href={`/admin/iot/resources/${app.resource.id}`} class="hover:underline">{app.resource.name}</a>
                        </td>
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

    {#if selectedIds.length > 0}
        <div class="flex items-center justify-between mt-2 p-2 border rounded-md bg-muted/40">
            <div class="text-sm">{selectedIds.length} selected</div>
            <div class="flex items-center gap-2">
                <Button variant="destructive" size="sm" on:click={batchRemoveSelected}>Remove Selected</Button>
            </div>
        </div>
    {/if}

    <!-- App Selector Dialog -->
    <AppSelector 
        bind:open={addDialogOpen}
        {bundleId}
        on:select={handleAppSelect}
        on:close={() => (addDialogOpen = false)}
        autoOpen={autoOpen}
        on:autoOpenChange={(e) => (autoOpen = e.detail)}
    />
</div>
