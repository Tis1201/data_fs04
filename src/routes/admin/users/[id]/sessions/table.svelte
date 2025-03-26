<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import type { Session } from "@prisma/client";
    import { page } from "$app/stores";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let props = {
        records: [] as Session[],
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

    $: ({ records, pagination, sort, loading } = props);

    const columns = [
        {
            id: "id",
            label: "ID",
            sortable: true,
            width: "20%",
            render: (record: Session) => record.id
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "20%",
            render: (record: Session) => {
                if (!record.createdAt) return "N/A";
                return {
                    component: RelativeDate,
                    props: {
                        date: record.createdAt,
                        format: "relative",
                        showTooltip: true,
                        useHoverCard: true,
                        iconSize: 12
                    }
                };
            }
        },
        {
            id: "expires",
            label: "Expires",
            sortable: true,
            width: "20%",
            render: (record: Session) => {
                if (!record.expires) return "N/A";
                return {
                    component: RelativeDate,
                    props: {
                        date: record.expires,
                        format: "relative",
                        showTooltip: true,
                        useHoverCard: true,
                        iconSize: 12
                    }
                };
            }
        },
        {
            id: "userAgent",
            label: "User Agent",
            width: "20%",
            render: (record: Session) => record.userAgent || "N/A"
        },
        {
            id: "ipAddress",
            label: "IP Address",
            width: "20%",
            render: (record: Session) => record.ipAddress || "N/A"
        }
    ];
</script>

<div class="space-y-4">
    {#if loading}
        <div class="space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-3/4" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
        </div>
    {:else}
        <DataTable
            {columns}
            props={{
                records,
                pagination,
                sort,
                loading: false
            }}
            on:sort={handleTableSort}
            on:pagination={(e) => handleTablePagination(e, 'preferredPageSize')}
        />
    {/if}
</div>
