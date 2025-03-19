<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/custom/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/custom/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/custom/table/filter/PopoverFilter.svelte";
    import ActionDropdown from "$lib/components/custom/table/column/ActionDropdown.svelte";
    import ConfirmationDialog from "$lib/components/custom/dialog/ConfirmationDialog.svelte";
    import { Mail, Ban, Pencil, Trash2, Power } from "lucide-svelte";
    import type { User } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";

    // Props for DataTable component
    export let records: User[];
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
            width: "30%"
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
            render: (record: User) => new Date(record.createdAt).toLocaleDateString()
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: User) => ({
                component: ActionDropdown,
                props: {
                    items: [
                        {
                            label: "Edit",
                            icon: Pencil,
                            onClick: () => goto(`/admin/users/${record.id}`)
                        }
                    ]
                }
            })
        }
    ];

    /**
     * Handle table sort
     */
    function handleTableSort(event: CustomEvent<{ field: string; order: "asc" | "desc" }>) {
        const url = new URL(window.location.href);
        url.searchParams.set("sort", event.detail.field);
        url.searchParams.set("order", event.detail.order);
        goto(url.toString());
    }

    /**
     * Handle table pagination
     */
    function handleTablePagination(event: CustomEvent<{ page: number; per_page: number }>) {
        const url = new URL(window.location.href);
        url.searchParams.set("page", event.detail.page.toString());
        url.searchParams.set("per_page", event.detail.per_page.toString());
        goto(url.toString());
    }
</script>

<div class="space-y-4">
    <div class="flex items-center gap-4">
        <!-- Search filter -->
        <div class="flex-1">
            <DebouncedTextFilter
                placeholder="Search by email..."
                paramName="search"
            />
        </div>

        <!-- Role filter -->
        <PopoverFilter
            label="Roles"
            paramName="roles"
            options={[
                { value: "admin", label: "Admin" },
                { value: "user", label: "User" }
            ]}
            bind:selected={$selectedRoles}
        />

        <!-- Status filter -->
        <!-- <PopoverFilter
            label="System Role"
            paramName="statuses"
            options={[
                { value: "ADMIN", label: "Admin" },
                { value: "USER", label: "User" }
            ]}
            bind:selected={$selectedStatuses}
        /> -->
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
</div>
