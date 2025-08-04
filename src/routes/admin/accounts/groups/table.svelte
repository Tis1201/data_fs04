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
    import { Pencil, Trash } from "lucide-svelte";
    import type { Group } from "@prisma/client";
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
        records: [] as Group[],
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
            accounts: [] as {id: string, name: string}[]
        }
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as Group | null,
        confirmationOpen: false,
        title: "Delete Group",
        message: "",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        successMessage: "Group deleted successfully",
        errorMessage: "Failed to delete group"
    };

    // Function to open delete confirmation dialog
    function confirmDelete(group: Group) {
        state.selectedRecord = group;
        state.message = `Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`;
        state.confirmationOpen = true;
    }
    
    // Stores for filters and table state
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });
    
    // Define columns for the groups table
    $: columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Group) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/accounts/groups",
                    showId: true
                }
            })
        },

        {
            id: "account",
            label: "Account",
            width: "15%",
            render: (record: Group) => record.account?.name || "N/A"
        },
        {
            id: "members",
            label: "Members",
            width: "20%",
            render: (record: Group) => record._count?.members || 0
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: Group) => ({
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
            width: "10%",
            render: (record: Group) => {
                // Define action items here instead of in the RecordActions component
                const actionItems = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/accounts/groups/${record.id}`)
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
        {state}
        actionName="deleteGroup"
        action="?/deleteGroup"
        onConfirm={() => {
            // Refresh the page to update the group list
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
                    placeholder="Search by name, ID, or description..."
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
