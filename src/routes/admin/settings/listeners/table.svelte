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
    import { Pencil, Trash, Power, PowerOff, Clock } from "lucide-svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import EndpointDisplay from "$lib/components/ui_components_sveltekit/webhook/EndpointDisplay.svelte";
    import ListenerSourcesDisplay from "$lib/components/ui_components_sveltekit/listener/ListenerSourcesDisplay.svelte";
    import ListenerConnectionsBadges from "$lib/components/ui_components_sveltekit/listener/ListenerConnectionsBadges.svelte";
    import type { ListenerEndpoint } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    
    // Props for DataTable component
    export let props = {
        records: [] as ListenerEndpoint[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as ListenerEndpoint | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(listener: ListenerEndpoint) {
        state.selectedRecord = listener;
        state.confirmationOpen = true;
    }
    
    // Listener to be toggled (for active status change)
    let listenerToToggle: ListenerEndpoint | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(listener: ListenerEndpoint) {
        listenerToToggle = listener;
        statusToggleDialogOpen = true;
    }

    // Stores for filters and table state
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );
    $: {
        // Keep selectedStatuses in sync with URL changes
        const urlStatuses = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlStatuses) !== JSON.stringify($selectedStatuses)) {
            selectedStatuses.set(urlStatuses);
        }
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: ListenerEndpoint) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/settings/listeners",
                    idField: "id",
                    nameField: "name"
                }
            })
        },
        {
            id: "postfix",
            label: "Endpoint",
            sortable: true,
            width: "15%",
            render: (record: ListenerEndpoint) => ({
                component: EndpointDisplay,
                props: {
                    postfix: record.postfix,
                    basePath: "/api/listen"
                }
            })
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "15%",
            render: (record: ListenerEndpoint) => ({
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
            id: "connections",
            label: "Connections",
            sortable: false,
            width: "20%",
            render: (record: ListenerEndpoint) => ({
                component: ListenerConnectionsBadges,
                props: {
                    webhookEndpoints: record.webhookEndpoints?.map(w => w.webhookEndpoint) || [],
                    whatsappAccounts: record.whatsappAccounts?.map(w => w.whatsappAccount) || [],
                    listenToAll: record.listenToAll
                }
            })
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: ListenerEndpoint) => record.status
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: ListenerEndpoint) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/settings/listeners/${record.id}`)
                    },
                    {
                        label: isTogglingStatus && listenerToToggle?.id === record.id 
                            ? "Updating..." 
                            : (record.status === 'ACTIVE' ? "Deactivate" : "Activate"),
                        icon: isTogglingStatus && listenerToToggle?.id === record.id 
                            ? null 
                            : (record.status === 'ACTIVE' ? PowerOff : Power),
                        onClick: () => prepareToggleStatus(record),
                        disabled: isTogglingStatus
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

    // Using imported pagination utilities for table interactions
    // These are already imported from pagination-utils
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        onConfirm={() => {
            // Refresh the page to update the listener list
            window.location.reload();
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={listenerToToggle}
        bind:isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            // Update the listener status in the local data without page refresh
            if (listenerToToggle) {
                const newStatus = listenerToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the listener in the records array
                const index = props.records.findIndex(r => r.id === listenerToToggle.id);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`Listener ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the listenerToToggle and close dialog
                listenerToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update listener status: ${result.data?.error || 'Unknown error'}`);
            listenerToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={listenerToToggle?.id || ''} />
        <input type="hidden" name="status" value={listenerToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
    {#if props.loading}
        <div class="space-y-4">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
        </div>
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search event listeners..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" }
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />
        </div>

        <!-- Data table -->
        <DataTable
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>