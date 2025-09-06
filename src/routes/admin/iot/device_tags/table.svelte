<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Power, RefreshCw } from "lucide-svelte";
    import type { DeviceTag } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post, api_delete, api_patch } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    import { Badge } from "$lib/components/ui/badge";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    
    import { invalidate } from '$app/navigation';
    
    // Simple function to refresh data from the server
    async function refreshData() {
        // This will trigger a reload of the page data without a full page refresh
        await invalidate('app:deviceTags');
    }
    

    // Props for DataTable component
    export let props = {
        records: [] as DeviceTag[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "issuedAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as DeviceTag | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(token: DeviceTag) {
        state.selectedRecord = token;
        state.confirmationOpen = true;
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Tag ID",
            sortable: true,
            width: "15%",
            render: (record: DeviceTag) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name
                    },
                    baseUrl: '/admin/iot/device_tags',
                    showId: true
                }
            })
        },
        {
            id: "description",
            label: "Description",
            sortable: true,
            width: "10%",
            render: (record: DeviceTag) => record.description || "N/A"
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: DeviceTag) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/iot/device_tags/${record.id}`)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    }
                ];
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={{
            selectedRecord: state.selectedRecord,
            confirmationOpen: state.confirmationOpen,
            title: 'Delete Device Tag',
            message: state.selectedRecord ? `Are you sure you want to delete Device Tag ${state.selectedRecord.name || state.selectedRecord.id}?` : '',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }}
        useFormSubmission={false}
        onConfirm={async () => {
            if (!state.selectedRecord) return;
            
            try {
                // Use the generic API delete function
                const result = await api_delete(
                    '/admin/iot/device_tags',
                    state.selectedRecord.id
                );
                
                // If we got here, the operation was successful
                toast.success('Device Tag deleted successfully');
                
                // Refresh data from the server
                await refreshData();
            } catch (error) {
                console.error('Error deleting Device Tag:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to delete Device Tag');
            }
        }}
        on:close={() => {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }}
    />

    <!-- Table with filters and data -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex flex-wrap gap-2 mb-4">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
        </div>

        <DataTable
            props={{
                records: props.records,
                pagination: props.pagination,
                sort: props.sort
            }}
            columns={columns}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
