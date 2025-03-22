<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import { Phone, Pencil, Trash2, MessageSquare, Trash } from "lucide-svelte";
    import type { WhatsAppAccount } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { enhance } from "$app/forms";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Props for DataTable component
    export let records: WhatsAppAccount[] = [];
    export let pagination: {
        page: number;
        per_page: number;
        total_records: number;
        total_pages: number;
    };
    export let sort: {
        field: string;
        order: "asc" | "desc";
    };
    export let loading = false;
    
    // State for confirmation dialog
    let accountToDelete: WhatsAppAccount | null = null;
    
    // Function to open delete confirmation dialog
    function confirmDelete(account: WhatsAppAccount) {
        accountToDelete = account;
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
            width: "30%"
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
            render: (record: WhatsAppAccount) => new Date(record.createdAt).toLocaleDateString()
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: WhatsAppAccount) => ({
                component: RecordActions,
                props: {
                    record,
                    onDelete: confirmDelete
                }
            })
        }
    ];

    // Using imported pagination utilities for table interactions
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {accountToDelete}
        onConfirm={() => {
            // Refresh the page to update the account list
            window.location.reload();
        }}
    />
    {#if loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-4">
            <!-- Search filter -->
            <div class="flex-1">
                <DebouncedTextFilter
                    placeholder="Search by phone number or description..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
        </div>

        <!-- Data table -->
        <DataTable
            {columns}
            data={records}
            {pagination}
            {sort}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>