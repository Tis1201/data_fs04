<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Download, ExternalLink } from "lucide-svelte";
    import type { Resource } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";

    // Props for DataTable component
    export let props = {
        records: [] as Resource[],
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
        loading: false,
        filters: {
            accounts: [] as {id: string, name: string}[],
            resourceTypes: [] as string[]
        }
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as Resource | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(resource: Resource) {
        state.selectedRecord = resource;
        state.confirmationOpen = true;
    }
    
    // Function to format file size
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    // Define columns for the resources table
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Resource) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/user/resources",
                    showId: true
                }
            })
        },
        {
            id: "type",
            label: "Type",
            sortable: true,
            width: "10%",
            render: (record: Resource) => ({
                component: StatusBadge,
                props: {
                    status: record.type,
                    className: "capitalize"
                }
            })
        },
        {
            id: "size",
            label: "Size",
            sortable: true,
            width: "10%",
            render: (record: Resource) => formatFileSize(record.size)
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: Resource) => ({
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
            id: "updatedAt",
            label: "Updated",
            sortable: true,
            width: "15%",
            render: (record: Resource) => ({
                component: RelativeDate,
                props: {
                    date: record.updatedAt,
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
            width: "15%",
            render: (record: Resource) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/user/resources/${record.id}`)
                    },
                    {
                        label: "Open",
                        icon: ExternalLink,
                        onClick: () => window.open(record.path, '_blank')
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

    // No additional helpers needed; StatusBadge will handle default styling
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        actionName="deleteResource"
        onConfirm={() => {
            // Refresh the page to update the resource list
            window.location.reload();
        }}
    />

    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, ID, or path..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Account filter -->
            <PopoverFilter
                label="Account"
                options={props.filters.accounts?.map(account => ({ label: account.name, value: account.id })) || []}
                selectedValues={$page.url.searchParams.get('accountId')?.split(',').filter(Boolean) || []}
                key="accountId"
            />
            
            <!-- Resource type filter -->
            <PopoverFilter
                label="Type"
                options={props.filters.resourceTypes?.map(type => ({ label: type, value: type })) || []}
                selectedValues={$page.url.searchParams.get('types')?.split(',').filter(Boolean) || []}
                key="types"
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
