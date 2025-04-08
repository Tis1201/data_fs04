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
    import EndpointDisplay from "$lib/components/ui_components_sveltekit/webhook/EndpointDisplay.svelte";
    import CopyableText from "$lib/components/ui_components_sveltekit/display/CopyableText.svelte";
    import { Pencil, Trash, Key, Eye, EyeOff, RotateCw } from "lucide-svelte";
    import type { ApiKey } from "@prisma/client";
    import ExpiresDate from "$lib/components/ui_components_sveltekit/date/ExpiresDate.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";

    // Props for DataTable component
    export let props = {
        records: [] as ApiKey[],
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
        selectedRecord: null as ApiKey | null,
        confirmationOpen: false
    };

    // API key to be toggled
    let apiKeyToToggle: ApiKey | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Stores for filters and table state
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: ApiKey) => ({
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
            id: "apiKey",
            label: "API Key",
            sortable: true,
            width: "20%",
            render: (record: ApiKey) => ({
                component: CopyableText,
                props: {
                    text: record.key,
                    mask: true,
                    monospace: true,
                    visiblePrefix: 2,
                    visibleSuffix: 2,
                    maskLength: 10,
                    tooltipText: "Copy API Key",
                    copiedTooltipText: "API Key copied!"
                }
            })
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "20%",
            render: (record: ApiKey) => ({
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
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "20%",
            render: (record: ApiKey) => ({
                component: ExpiresDate,
                props: {
                    date: record.expiresAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
    ];

    

    // Function to open delete confirmation dialog
    function confirmDelete(apiKey: ApiKey) {
        state.selectedRecord = apiKey;
        state.confirmationOpen = true;
    }
    
    // Function to prepare for status toggle
    function prepareToggleStatus(apiKey: ApiKey) {
        apiKeyToToggle = apiKey;
        statusToggleDialogOpen = true;
    }

    // Using imported pagination utilities for table interactions
    // These are already imported from pagination-utils
</script>

<div class="space-y-4">
    <!-- {JSON.stringify(props.records)} -->
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        onConfirm={() => {
            // Refresh the page to update the API key list
            window.location.reload();
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={apiKeyToToggle}
        bind:isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            if (apiKeyToToggle) {
                const newStatus = !apiKeyToToggle.active;
                
                const index = props.records.findIndex(r => r.id === apiKeyToToggle.id);
                if (index !== -1) {
                    props.records[index].active = newStatus;
                    props = { ...props };
                }
                
                toast.success(`API key ${newStatus ? 'activated' : 'deactivated'} successfully`);
                
                apiKeyToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update API key status: ${result.data?.error || 'Unknown error'}`);
            apiKeyToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={apiKeyToToggle?.id || ''} />
        <input type="hidden" name="active" value={apiKeyToToggle?.active ? 'false' : 'true'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name or description..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" }
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
