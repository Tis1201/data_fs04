<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import { Plus, Search, Filter, X } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import type { PageData } from "./$types";
    import HierarchyTreeView from "./components/HierarchyTreeView.svelte";
    import RelationshipDrawer from "./components/RelationshipDrawer.svelte";
    import AddRelationshipDialog from "./components/AddRelationshipDialog.svelte";
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { toast } from 'svelte-sonner';

    export let data: PageData;

    let selectedAssignmentId: string | null = null;
    let selectedAssignment: any = null;
    let isSubmitting = false;
    let showAddDialog = false;
    let showDetailsSheet = false;
    
    // Search and filter state
    let searchQuery = '';
    let statusFilter = '';
    let relationshipTypeFilter = '';
    let showFilters = false;

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts/accounts"],
        "Hierarchy"
    ];

    function handleAssignmentSelect(event: CustomEvent) {
        selectedAssignmentId = event.detail.assignmentId;
        selectedAssignment = event.detail.assignment;
        showDetailsSheet = true;
    }

    function closeDetailsSheet() {
        showDetailsSheet = false;
        selectedAssignmentId = null;
        selectedAssignment = null;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && showDetailsSheet) {
            closeDetailsSheet();
        }
    }

    // Filter assignments based on search and filters
    $: filteredAssignments = data.assignments.filter(assignment => {
        // Search filter - check account names
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const parentMatch = assignment.parentAccount.name.toLowerCase().includes(query);
            const childMatch = assignment.childAccount.name.toLowerCase().includes(query);
            if (!parentMatch && !childMatch) return false;
        }

        // Status filter
        if (statusFilter && assignment.status !== statusFilter) {
            return false;
        }

        // Relationship type filter
        if (relationshipTypeFilter && assignment.relationshipType !== relationshipTypeFilter) {
            return false;
        }

        return true;
    });

    function clearFilters() {
        searchQuery = '';
        statusFilter = '';
        relationshipTypeFilter = '';
    }

    $: hasActiveFilters = searchQuery.trim() || statusFilter || relationshipTypeFilter;

    function handleEdit(event: CustomEvent) {
        console.log('Edit assignment:', event.detail.assignment);
        // TODO: Open edit dialog
    }

    async function handleDelete(event: CustomEvent) {
        const assignment = event.detail.assignment;
        if (!confirm(`Are you sure you want to delete the relationship between "${assignment.parentAccount.name}" and "${assignment.childAccount.name}"?`)) {
            return;
        }

        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/deleteAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship deleted successfully');
                closeDetailsSheet();
                await invalidateAll();
            } else {
                toast.error('Failed to delete relationship');
            }
        } catch (error) {
            toast.error('Failed to delete relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleSuspend(event: CustomEvent) {
        const assignment = event.detail.assignment;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/suspendAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship suspended successfully');
                await invalidateAll();
            } else {
                toast.error('Failed to suspend relationship');
            }
        } catch (error) {
            toast.error('Failed to suspend relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleActivate(event: CustomEvent) {
        const assignment = event.detail.assignment;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/activateAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship activated successfully');
                await invalidateAll();
            } else {
                toast.error('Failed to activate relationship');
            }
        } catch (error) {
            toast.error('Failed to activate relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleCreateRelationship(event: CustomEvent) {
        const { parentAccountId, childAccountId, relationshipType, validFrom, validTo } = event.detail;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('parentAccountId', parentAccountId);
            formData.append('childAccountId', childAccountId);
            formData.append('relationshipType', relationshipType);
            if (validFrom) formData.append('validFrom', validFrom);
            if (validTo) formData.append('validTo', validTo);
            
            const response = await fetch('?/createAssignment', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                toast.success('Relationship created successfully');
                showAddDialog = false;
                await invalidateAll();
            } else {
                toast.error(result.message || 'Failed to create relationship');
            }
        } catch (error) {
            toast.error('Failed to create relationship');
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<AdminPageLayout
    title="Account Hierarchy"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Relationship",
            icon: Plus,
            onClick: () => showAddDialog = true
        }
    ]}
>
    <div class="transition-all duration-300 {showDetailsSheet ? 'pr-0 sm:pr-[480px]' : ''}">

    <!-- Main Content: Full-Width Tree View -->
    <Card class="w-full">
        <CardHeader>
            <div class="flex items-center justify-between">
                <div>
                    <CardTitle>Account Hierarchy</CardTitle>
                    <CardDescription>
                        {#if hasActiveFilters}
                            Showing {filteredAssignments.length} of {data.assignments.length} relationships
                        {:else}
                            {data.assignments.length} relationships total
                        {/if}
                        {#if showDetailsSheet}
                            <span class="inline-flex items-center gap-1 ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                Details panel open
                            </span>
                        {/if}
                    </CardDescription>
                </div>
                
                <div class="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => showFilters = !showFilters}
                        class={showFilters ? 'bg-blue-50 border-blue-200' : ''}
                    >
                        <Filter class="h-4 w-4 mr-2" />
                        Filters
                        {#if hasActiveFilters}
                            <Badge variant="secondary" class="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                                {[searchQuery.trim() ? 1 : 0, statusFilter ? 1 : 0, relationshipTypeFilter ? 1 : 0].filter(Boolean).length}
                            </Badge>
                        {/if}
                    </Button>
                </div>
            </div>
            
            <!-- Search and Filters -->
            {#if showFilters}
                <div class="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <!-- Search -->
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search accounts..."
                            bind:value={searchQuery}
                            class="pl-10"
                        />
                    </div>
                    
                    <!-- Filter Row -->
                    <div class="flex flex-wrap gap-4">
                        <!-- Status Filter -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-gray-700">Status</label>
                            <select bind:value={statusFilter} class="px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <option value="">All Status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="SUSPENDED">Suspended</option>
                            </select>
                        </div>
                        
                        <!-- Relationship Type Filter -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-gray-700">Relationship Type</label>
                            <select bind:value={relationshipTypeFilter} class="px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <option value="">All Types</option>
                                <option value="OWNERSHIP">Ownership</option>
                                <option value="DELEGATION">Delegation</option>
                                <option value="VISIBILITY_ONLY">Visibility Only</option>
                            </select>
                        </div>
                        
                        <!-- Clear Filters -->
                        {#if hasActiveFilters}
                            <div class="flex flex-col gap-1">
                                <label class="text-sm font-medium text-transparent">Clear</label>
                                <Button variant="outline" size="sm" on:click={clearFilters}>
                                    <X class="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </CardHeader>
        <CardContent>
            <HierarchyTreeView 
                assignments={filteredAssignments || []}
                {selectedAssignmentId}
                on:select={handleAssignmentSelect}
            />
        </CardContent>
    </Card>
    </div>
</AdminPageLayout>

<!-- Relationship Details Drawer -->
<RelationshipDrawer 
    bind:open={showDetailsSheet}
    assignment={selectedAssignment}
    loading={isSubmitting}
    on:close={closeDetailsSheet}
    on:edit={handleEdit}
    on:delete={handleDelete}
    on:suspend={handleSuspend}
    on:activate={handleActivate}
/>

<!-- Add Relationship Dialog -->
<AddRelationshipDialog 
    bind:open={showAddDialog}
    accounts={data.accounts || []}
    loading={isSubmitting}
    on:submit={handleCreateRelationship}
    on:close={() => showAddDialog = false}
/>
