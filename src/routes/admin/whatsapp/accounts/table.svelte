<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    // import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import type { WhatsAppAccount } from "@prisma/client";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Pencil, Trash, MessageSquare } from "lucide-svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { TableProps, TableState } from "$lib/components/ui_components_sveltekit/table/types";

    // Props for DataTable component
    export let props: TableProps<WhatsAppAccount> = {
        records: [],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc"
        },
        loading: false
    };

    // State for confirmation dialog
    let state: TableState<WhatsAppAccount> = {
        selectedRecord: null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(account: WhatsAppAccount) {
        state.selectedRecord = account;
        state.confirmationOpen = true;
    }

    // Column definitions
    const columns = [
        // {
        //     id: "client_id",
        //     label: "Client ID",
        //     sortable: true,
        //     width: "30%"
        // },
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "30%",
            render: (record: WhatsAppAccount) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/whatsapp/accounts",
                    idField: "id",
                    nameField: "name"
                }
            })
        },
        {
            id: "phoneNumber",
            label: "Phone Number",
            sortable: true,
            width: "30%"
        },
        {
            id: "description",
            label: "Description",
            sortable: true,
            width: "40%",
            render: (record: WhatsAppAccount) => record.description || "N/A"
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
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
            width: "10%",
            render: (record: WhatsAppAccount) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/whatsapp/accounts/${record.id}`)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    },
                    {
                        label: "Send Message",
                        icon: MessageSquare,
                        onClick: () => goto(`/admin/whatsapp/accounts/${record.id}/messages`)
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
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        onConfirm={() => {
            // Refresh the page to update the account list
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
                    placeholder="Search..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
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