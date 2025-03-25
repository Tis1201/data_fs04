<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil } from "lucide-svelte";
    import type { User } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Props for DataTable component
    export let props = {
        records: [] as User[],
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
        selectedRecord: null as User | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(user: User) {
        state.selectedRecord = user;
        state.confirmationOpen = true;
    }

    // Stores for filters and table state
    const selectedRoles = writable<string[]>(
        $page.url.searchParams.get("roles")?.split(",").filter(Boolean) ?? []
    );
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );

    // Column definitions
    const columns = [
        {
            id: "email",
            label: "Email",
            sortable: true,
            width: "30%",
            render: (record: User) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/users",
                    idField: "id",
                    nameField: "email"
                }
            })
        },
        {
            id: "rolesString",
            label: "Roles",
            sortable: true,
            width: "20%",
            render: (record: User) => record.rolesString || "N/A"
        },
        // {
        //     id: "systemRole",
        //     label: "System Role",
        //     sortable: true,
        //     width: "20%",
        //     render: (record: User) => record.systemRole || "N/A"
        // },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "20%",
            render: (record: User) => ({
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
            render: (record: User) => ({
                component: RecordActions,
                props: {
                    record,
                    onDelete: confirmDelete
                }
            })
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
            // Refresh the page to update the user list
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
                    placeholder="Search by email..."
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
