<script lang="ts">
    import { browser } from "$app/environment";
    import SortableColumnHeader from "$lib/components/custom/table/sort/SortableColumnHeader.svelte";
    import DataTablePagination from "$lib/components/custom/table/pagination/Pagination.svelte";
    import * as Table from "$lib/components/ui/table";
    import { createEventDispatcher } from "svelte";

    export let columns: {
        id: string;
        label: string;
        sortable?: boolean;
        sortKey?: string;
        width?: string;
        render?: (record: any) => string | { component: any; props: any };
    }[] = [];

    export let data: any[] = [];

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

    const dispatch = createEventDispatcher();

    function handleSort(event: CustomEvent<{ field: string; order: "asc" | "desc" }>) {
        dispatch("sort", event.detail);
    }

    function handlePaginationChange(event: CustomEvent<{ page: number; per_page: number }>) {
        dispatch("pagination", event.detail);
    }
</script>

<div class="rounded-md border">
    <!-- Table -->
    <Table.Root>
        <Table.Header>
            <Table.Row>
                {#each columns as column}
                    <Table.Head style={`width: ${column.width ?? "auto"}`}>
                        {#if column.sortable}
                            <SortableColumnHeader
                                label={column.label}
                                sortKey={column.sortKey ?? column.id}
                                currentSortField={sort.field}
                                currentSortOrder={sort.order}
                                on:sort={handleSort}
                            />
                        {:else}
                            {column.label}
                        {/if}
                    </Table.Head>
                {/each}
            </Table.Row>
        </Table.Header>
        <Table.Body>
            {#if data && data.length > 0}
                {#each data as record, index (record.id ?? `${index}-${JSON.stringify(record)}`)}
                    <Table.Row>
                        {#each columns as column}
                            <Table.Cell>
                                {#if column.render}
                                    {@const rendered = column.render(record)}
                                    {#if typeof rendered === 'string'}
                                        {@html rendered}
                                    {:else if rendered.component && browser}
                                        <svelte:component
                                            this={rendered.component}
                                            {...rendered.props}
                                        />
                                    {:else}
                                        N/A
                                    {/if}
                                {:else}
                                    {record[column.id] ?? "N/A"}
                                {/if}
                            </Table.Cell>
                        {/each}
                    </Table.Row>
                {/each}
            {:else}
                <Table.Row>
                    <Table.Cell
                        colspan={columns.length}
                        class="text-center"
                    >
                        No records available
                    </Table.Cell>
                </Table.Row>
            {/if}
        </Table.Body>
    </Table.Root>

    <DataTablePagination
        {pagination}
        on:pagination={handlePaginationChange}
    />
</div>
