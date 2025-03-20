<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/custom/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/custom/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/custom/table/filter/PopoverFilter.svelte";
    import ActionDropdown from "$lib/components/custom/table/column/ActionDropdown.svelte";
    import ConfirmationDialog from "$lib/components/custom/dialog/ConfirmationDialog.svelte";
    import { Phone, Pencil, Trash2, MessageSquare } from "lucide-svelte";
    import type { WhatsAppAccount } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { Skeleton } from "$lib/components/ui/skeleton";

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

    // Column definitions
    const columns = [
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
                component: ActionDropdown,
                props: {
                    items: [
                        {
                            label: "Edit",
                            icon: Pencil,
                            onClick: () => goto(`/admin/whatsapp/accounts/${record.id}`)
                        },
                        {
                            label: "Send Message",
                            icon: MessageSquare,
                            onClick: () => goto(`/admin/whatsapp/accounts/${record.id}/messages`)
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
    {#if loading}
        <div class="space-y-4">
            <Skeleton class="h-12 w-full" />
            <Skeleton class="h-64 w-full" />
        </div>
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