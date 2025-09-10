<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { ExternalLink } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from '$app/stores';
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";

    // Props for DataTable component
    type PreclaimSet = {
        id: string;
        name: string;
        description?: string | null;
        status: 'ACTIVE' | 'INACTIVE';
        expiresAt?: string | Date | null;
        createdAt: string | Date;
    };

    export let props = {
        records: [] as PreclaimSet[],
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

    // Initialize filter values from URL parameters
    let statusFilterValues = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
    
    // No legacy URL param cleanup needed
    onMount(() => {});

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "25%",
            render: (record: PreclaimSet) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Set'
                    },
                    baseUrl: '/admin/iot/preclaims',
                    showId: true
                }
            })
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "15%",
            render: (record: PreclaimSet) => ({
                component: StatusBadge,
                props: {
                    status: (record.status || '').toString().toLowerCase(),
                    className: 'capitalize'
                }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "15%",
            render: (record: PreclaimSet) => ({
                component: RelativeDate,
                props: {
                    date: (record as any).expiresAt || null,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "createdAt",
            label: "Added",
            sortable: true,
            width: "15%",
            render: (record: PreclaimSet) => ({
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
            width: "15%",
            render: (record: PreclaimSet) => {
                // Define action items here instead of in the RecordActions component
                const actionItems = [
                    {
                        label: "View Details",
                        icon: ExternalLink,
                        onClick: () => goto(`/admin/iot/preclaims/${record.id}`)
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
    // These are already imported from pagination-utils
    onMount(() => {});
</script>

<div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 justify-between">
        <div class="flex flex-col sm:flex-row gap-2">
            <!-- Search filter -->
            <DebouncedTextFilter
                placeholder="Search by name or description..."
                value={$page.url.searchParams.get('search') || ''}
                className="w-full md:w-[250px]"
            />      
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'INACTIVE', label: 'Inactive' }
                ]}
                selectedValues={statusFilterValues}
                key="statuses"
            />
        </div>
    </div>
    
    <!-- Data Table -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <DataTable
            props={{
                records: props.records,
                pagination: props.pagination,
                sort: props.sort
            }}
            columns={columns}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
