<script lang="ts">
    import SortableColumnHeader from "$lib/components/custom/table/sort/SortableColumnHeader.svelte";
    import DataTablePagination from "$lib/components/custom/table/pagination/Pagination.svelte";
    import * as Table from "$lib/components/ui/table";

    export let enhanced_columns: {
        id: string;
        label: string;
        sortable?: boolean;
        sortKey?: string;
        width?: string;
        render?: (record: any) => string;
    }[] = [];

    export let records: any[] = [];

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

    export let onSort: (event: {
        field: string;
        order: "asc" | "desc";
    }) => void = () => {};

    
</script>

<style>
    .table-header {
        background-color: black;
        color: white;
        font-weight: bold;
        text-align: left;
    }
</style>

<div class="rounded-md border">
    <!-- Table -->
    <Table.Root>
        <Table.Header
        
        >
            <Table.Row>
                {#each enhanced_columns as column}
                    <Table.Head style={`width: ${column.width ?? "auto"}`}>
                        {#if column.sortable}
                            <SortableColumnHeader
                                label={column.label}
                                sortKey={column.sortKey ?? column.id}
                                currentSortField={sort.field}
                                currentSortOrder={sort.order}
                                on:sort={({ detail }) => onSort(detail)}
                            />
                        {:else}
                            {column.label}
                        {/if}
                    </Table.Head>
                {/each}
            </Table.Row>
        </Table.Header>
        <Table.Body>
            {#if records.length > 0}
                {#each records as record (record.id)}
                    <Table.Row>
                        {#each enhanced_columns as column}
                            <Table.Cell>
                                {#if column.render}
                                    {#if column.render(record).component}
                                        <svelte:component
                                            this={column.render(record)
                                                .component}
                                            {...column.render(record).props}
                                        />
                                    {:else}
                                        {@html column.render(record) ?? "N/A"}
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
                        colspan={enhanced_columns.length}
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
    />
</div>
