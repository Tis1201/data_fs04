<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    type AccountSummary = { id: string; name: string; slug?: string };

    type AssignmentRecord = {
        id: string;
        relationshipType: string;
        status: string;
        validFrom: string | Date | null;
        validTo: string | Date | null;
        createdAt: Date;
        parentAccount?: { id: string; name: string; slug?: string } | null;
        childAccount?: { id: string; name: string; slug?: string } | null;
    };

    export let props = {
        records: [] as AssignmentRecord[],
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
        loading: false,
        filters: {
            accounts: [] as AccountSummary[]
        }
    };

    onMount(() => {
        if (!browser) return;
        const url = new URL(window.location.href);
        let needsRedirect = false;
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

    $: columns = [
        {
            id: "parentAccount",
            label: "Parent Account",
            width: "20%",
            render: (record: AssignmentRecord) => record.parentAccount?.name ?? "-"
        },
        {
            id: "childAccount",
            label: "Child Account",
            width: "20%",
            render: (record: AssignmentRecord) => record.childAccount?.name ?? "-"
        },
        {
            id: "relationshipType",
            label: "Type",
            width: "15%",
            render: (record: AssignmentRecord) => record.relationshipType
        },
        {
            id: "status",
            label: "Status",
            width: "10%",
            render: (record: AssignmentRecord) => record.status
        },
        {
            id: "validity",
            label: "Validity",
            width: "20%",
            render: (record: AssignmentRecord) => `${record.validFrom ?? '-'} — ${record.validTo ?? '-'}`
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: AssignmentRecord) => ({
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
    ];
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by parent or child account..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>

            <PopoverFilter
                label="Parent Account"
                options={props.filters.accounts?.map((account) => ({ label: account.name, value: account.id })) || []}
                selectedValues={$page.url.searchParams.get('parentAccountId')?.split(',').filter(Boolean) || []}
                key="parentAccountId"
            />
        </div>

        <DataTable
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
