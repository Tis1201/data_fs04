<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from "$app/stores";
    
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import type { WhatsAppAccount } from "@prisma/client";
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
    
    // Get initial filter values from URL
    $: statusFilterValues = $page.url.searchParams.get('status')?.split(',').filter(Boolean) || [];
    $: connectionStatusFilterValues = $page.url.searchParams.get('connectionStatuses')?.split(',').filter(Boolean) || [];

    // Column definitions
    const columns = [
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
        }
        // Removed actions column as requested
    ];
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-2 justify-between mb-4">
            <div class="flex flex-col sm:flex-row gap-2">
                <!-- Search filter -->
                <DebouncedTextFilter
                    placeholder="Search accounts..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
                
                <!-- Status filter -->
                <PopoverFilter
                    label="Status"
                    options={[
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' }
                    ]}
                    selectedValues={statusFilterValues}
                    key="status"
                    onChange={(values) => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('status', values.join(','));
                        if (!values.length) url.searchParams.delete('status');
                        url.searchParams.set('page', '1');
                        window.history.pushState({}, '', url);
                        window.dispatchEvent(new Event('popstate'));
                    }}
                />
                
                <!-- Connection Status filter -->
                <PopoverFilter
                    label="Connection"
                    options={[
                        { value: 'CONNECTED', label: 'Connected' },
                        { value: 'DISCONNECTED', label: 'Disconnected' },
                        { value: 'PENDING', label: 'Pending' }
                    ]}
                    selectedValues={connectionStatusFilterValues}
                    key="connectionStatuses"
                    onChange={(values) => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('connectionStatuses', values.join(','));
                        if (!values.length) url.searchParams.delete('connectionStatuses');
                        url.searchParams.set('page', '1');
                        window.history.pushState({}, '', url);
                        window.dispatchEvent(new Event('popstate'));
                    }}
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
