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
    import type { FactoryToken } from "@prisma/client";
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
        await invalidate('app:factoryTokens');
    }
    

    // Props for DataTable component
    export let props = {
        records: [] as FactoryToken[],
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
        selectedRecord: null as FactoryToken | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(token: FactoryToken) {
        state.selectedRecord = token;
        state.confirmationOpen = true;
    }
    
    // Token to be toggled (for status change)
    let tokenToToggle: FactoryToken | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(token: FactoryToken) {
        tokenToToggle = token;
        statusToggleDialogOpen = true;
    }

    // Using imported pagination utilities for table interactions
    // handleTableSort and handleTablePagination are imported from pagination-utils

    // Stores for filters and table state
    const selectedIsUsed = writable<string[]>(
        $page.url.searchParams.get("isUsed")?.split(",").filter(Boolean) ?? []
    );
    
    $: {
        // Keep selectedIsUsed in sync with URL changes
        const urlIsUsed = $page.url.searchParams.get("isUsed")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlIsUsed) !== JSON.stringify($selectedIsUsed)) {
            selectedIsUsed.set(urlIsUsed);
        }
    }
    
    const selectedHardwareModels = writable<string[]>(
        $page.url.searchParams.get("hardwareModels")?.split(",").filter(Boolean) ?? []
    );

    $: {
        // Keep selectedHardwareModels in sync with URL changes
        const urlHardwareModels = $page.url.searchParams.get("hardwareModels")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlHardwareModels) !== JSON.stringify($selectedHardwareModels)) {
            selectedHardwareModels.set(urlHardwareModels);
        }
    }
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

    // Column definitions
    const columns = [
        {
            id: "tokenId",
            label: "Token ID",
            sortable: true,
            width: "15%",
            render: (record: FactoryToken) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Token'
                    },
                    baseUrl: '/admin/iot/factory_tokens',
                    showId: true
                }
            })
        },
        // {
        //     id: "serialNumber",
        //     label: "Serial Number",
        //     sortable: true,
        //     width: "15%",
        //     render: (record: FactoryToken) => record.serialNumber || "N/A"
        // },
        {
            id: "hardwareModel",
            label: "Hardware Model",
            sortable: true,
            width: "10%",
            render: (record: FactoryToken) => record.hardwareModel || "N/A"
        },
       
        {
            id: "status",
            label: "Status",
            width: "15%",
            render: (record: FactoryToken) => ({
                component: StatusBadge,
                props: {
                    status:record.isUsed ? "active" : "inactive"
                }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "10%",
            render: (record: FactoryToken) => ({
                component: RelativeDate,
                props: {
                    date: record.expiresAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "issuedAt",
            label: "Issued",
            sortable: true,
            width: "10%",
            render: (record: FactoryToken) => ({
                component: RelativeDate,
                props: {
                    date: record.issuedAt,
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
            width: "10%",
            render: (record: FactoryToken) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/iot/factory_tokens/${record.id}`)
                    },
                    {
                        label: record.isUsed ? "Mark as Available" : "Mark as Used",
                        icon: Power,
                        onClick: () => prepareToggleStatus(record)
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
            title: 'Delete Factory Token',
            message: state.selectedRecord ? `Are you sure you want to delete factory token ${state.selectedRecord.name || state.selectedRecord.id}?` : '',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }}
        useFormSubmission={false}
        onConfirm={async () => {
            if (!state.selectedRecord) return;
            
            try {
                // Use the generic API delete function
                const result = await api_delete(
                    '/admin/iot/factory_tokens',
                    state.selectedRecord.id
                );
                
                // If we got here, the operation was successful
                toast.success('Factory token deleted successfully');
                
                // Refresh data from the server
                await refreshData();
            } catch (error) {
                console.error('Error deleting factory token:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to delete factory token');
            }
        }}
        on:close={() => {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }}
    />

    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        state={{
            open: statusToggleDialogOpen,
            title: tokenToToggle?.isUsed ? 'Mark as Available' : 'Mark as Used',
            message: tokenToToggle 
                ? `Are you sure you want to mark factory token ${tokenToToggle.tokenId || tokenToToggle.id} as ${tokenToToggle.isUsed ? 'available' : 'used'}?`
                : '',
            confirmButtonText: 'Update',
            cancelButtonText: 'Cancel',
            loading: isTogglingStatus
        }}
        on:close={() => {
            statusToggleDialogOpen = false;
            tokenToToggle = null;
        }}
        on:confirm={async () => {
            if (!tokenToToggle) return;
            
            isTogglingStatus = true;
            
            try {
                // Use the generic API patch function
                const result = await api_patch(
                    '/admin/iot/factory_tokens',
                    { id: tokenToToggle.id, isUsed: !tokenToToggle.isUsed }
                );
                
                // If we got here, the operation was successful
                toast.success(`Factory token ${tokenToToggle.isUsed ? 'marked as available' : 'marked as used'} successfully`);
                
                // Refresh data from the server
                await refreshData();
            } catch (error) {
                console.error('Error updating factory token status:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to update factory token status');
            } finally {
                isTogglingStatus = false;
                statusToggleDialogOpen = false;
                tokenToToggle = null;
            }
        }}
    />

    <!-- Table with filters and data -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex flex-wrap gap-2 mb-4">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by token ID or serial number..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Used", value: "true" },
                    { label: "Available", value: "false" }
                ]}
                selectedValues={$selectedIsUsed}
                onChange={(values) => {
                    selectedIsUsed.set(values);
                    const url = new URL(window.location.href);
                    url.searchParams.set('isUsed', values.join(','));
                    if (!values.length) url.searchParams.delete('isUsed');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
            />
            
            <!-- Hardware Model filter -->
            <!-- <PopoverFilter
                label="Hardware Model"
                options={Array.from(new Set(props.records.map(r => r.hardwareModel)))
                    .filter(Boolean)
                    .map(model => ({ label: model, value: model }))}
                selectedValues={$selectedHardwareModels}
                onChange={(values) => {
                    selectedHardwareModels.set(values);
                    const url = new URL(window.location.href);
                    url.searchParams.set('hardwareModels', values.join(','));
                    if (!values.length) url.searchParams.delete('hardwareModels');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
            /> -->
        </div>

        <DataTable
            {columns}
            props={props}
        />
    {/if}
</div>
