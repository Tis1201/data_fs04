<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { goto, invalidate } from '$app/navigation';
    import { toast } from "svelte-sonner";
    import { Pencil, Trash } from "lucide-svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import EnhancedPopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/EnhancedPopoverFilter.svelte";
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import type { TableColumn, TableProps, TableState } from "$lib/components/ui_components_sveltekit/table/types";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import type { ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import type { WhatsAppAccount } from "$lib/types/whatsapp";
    import { formatDate } from "$lib/utils/format";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/table/column/StatusBadge.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    
    // Get initial sort from URL or use defaults
    let initialSort = {
        field: $page.url.searchParams.get('sort') || 'createdAt',
        order: ($page.url.searchParams.get('order') || 'desc') as 'asc' | 'desc'
    };

    // Props for DataTable component
    export let props: TableProps<WhatsAppAccount> = {
        records: [],
        pagination: {
            page: Number($page.url.searchParams.get('page')) || 1,
            per_page: Number($page.url.searchParams.get('per_page')) || 10,
            total_records: 0,
            total_pages: 0
        },
        sort: initialSort,
        loading: false
    };
    
    // We don't need to manually handle URL changes here as handleTableSort will do it
    
    // Filter values are now handled by the UrlFilter component

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            field: "name",
            width: "30%",
            render: (record: WhatsAppAccount) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/user/integrations/whatsapp/accounts",
                    showId: true
                }
            })
        },
        {
            id: "phoneNumber",
            label: "Phone Number",
            sortable: true,
            field: "phoneNumber",
            width: "20%"
        },
        {
            id: "description",
            label: "Description",
            sortable: true,
            field: "description",
            width: "40%",
            render: (record: WhatsAppAccount) => record.description || "N/A"
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            field: "client_status", // Using client_status for sorting
            sortKey: "client_status", // Explicit sort key for the DataTable
            width: "20%",
            render: (record: WhatsAppAccount) => ({
                component: StatusBadge,
                props: {
                    status: record.status,
                    value: record.status || "N/A"
                }
            })
        },
        
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            field: "createdAt",
            width: "20%",
            render: (record: WhatsAppAccount) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "actions",
            label: "Actions",
            sortable: false,
            width: "100px",
            render: (record: WhatsAppAccount) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/user/integrations/whatsapp/accounts/${record.id}`)
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
    
    // Table state for delete confirmation dialog
    let state: TableState<WhatsAppAccount> = {
        confirmationOpen: false,
        selectedRecord: null,
        loading: false
    };
    
    function confirmDelete(record: WhatsAppAccount) {
        state.selectedRecord = record;
        state.confirmationOpen = true;
    }
    
    // Reference to the DataTable component
    let dataTable: any;
    
    // Simple function to refresh data
    async function refreshData() {
        // Just call the DataTable's refreshData method with our specific dependency
        await dataTable?.refreshData(['app:whatsapp-accounts']);
    }
    
    async function handleDelete() {
        if (!state.selectedRecord) return;
        
        try {
            const response = await fetch(`/api/whatsapp/accounts/${state.selectedRecord.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Use the standardized response format text field
                toast.success(result.text || "WhatsApp account deleted successfully");
                
                // Dispatch a custom event to refresh the data
                // This will be handled by our refreshData function
                refreshData();
            } else {
                // Handle error from standardized error response
                toast.error(result.error || `Error deleting WhatsApp account: ${result.message || 'Unknown error'}`);
            }
        } catch (error) {
            toast.error(`Error deleting WhatsApp account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }
    }
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-2 justify-between mb-4">
            <div class="flex flex-col sm:flex-row gap-2">
                <!-- Search filter -->
                <DebouncedTextFilter
                    placeholder="Search accounts..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
                
                <!-- Status filter -->
                <EnhancedPopoverFilter
                    label="Status"
                    paramName="status"
                    options={[
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' }
                    ]}
                />
                
                <!-- Connection Status filter -->
                <EnhancedPopoverFilter
                    label="Connection"
                    paramName="connectionStatuses"
                    options={[
                        { value: 'CONNECTED', label: 'Connected' },
                        { value: 'DISCONNECTED', label: 'Disconnected' },
                        { value: 'PENDING', label: 'Pending' }
                    ]}
                />
            </div>
        </div>

        <!-- Data table -->
        <DataTable
            bind:this={dataTable}
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>

<!-- Delete confirmation dialog -->
<RecordDeleteDialog
    state={{
        selectedRecord: state.selectedRecord,
        confirmationOpen: state.confirmationOpen,
        title: 'Delete WhatsApp Account',
        message: state.selectedRecord ? `Are you sure you want to delete WhatsApp account ${state.selectedRecord.name || state.selectedRecord.phoneNumber || state.selectedRecord.id}?` : '',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
    }}
    useFormSubmission={false}
    onConfirm={handleDelete}
/>
