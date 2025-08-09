<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";

    import type { License } from "@prisma/client";
    import { page } from "$app/stores";
    import { goto, invalidate } from "$app/navigation";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";

    // Simple function to refresh data from the server
    async function refreshData() {
        await invalidate('app:licenses');
    }

    export let props = {
        records: [] as License[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "issuedAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };

    // Column definitions
    const columns = [
        {
            id: "licenseId",
            label: "License",
            sortable: true,
            width: "18%",
            render: (record: License) => ({
                component: NameWithIdLink,
                props: {
                    record: { id: record.id, name: record.keyId || record.id },
                    baseUrl: '/admin/billing/licenses',
                    showId: true
                }
            })
        },
        {
            id: "accountId",
            label: "Account",
            sortable: true,
            width: "16%",
            render: (record: License) => record.accountId
        },
        {
            id: "deviceId",
            label: "Device",
            sortable: true,
            width: "16%",
            render: (record: License) => record.deviceId || '—'
        },
        {
            id: "status",
            label: "Status",
            width: "12%",
            render: (record: License) => ({
                component: StatusBadge,
                props: { status: record.status?.toLowerCase?.() || 'unknown' }
            })
        },
        {
            id: "issuedAt",
            label: "Issued",
            sortable: true,
            width: "14%",
            render: (record: License) => ({
                component: RelativeDate,
                props: { date: record.issuedAt, format: 'relative', showTooltip: true, useHoverCard: true, iconSize: 12 }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "14%",
            render: (record: License) => ({
                component: RelativeDate,
                props: { date: record.expiresAt, format: 'relative', showTooltip: true, useHoverCard: true, iconSize: 12 }
            })
        },
        {
            id: "algorithm",
            label: "Alg",
            sortable: true,
            width: "10%",
            render: (record: License) => record.algorithm
        }
    ];

    // Filters state pulled from URL
    $: selectedStatus = ($page.url.searchParams.get("status")?.split(',').filter(Boolean)) ?? [];

    onMount(() => {
        if (!browser) return;
        // no-op for now
    });
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex flex-wrap gap-2 mb-4">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by account, device, keyId..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>

            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Active', value: 'ACTIVE' },
                    { label: 'Revoked', value: 'REVOKED' },
                    { label: 'Expired', value: 'EXPIRED' },
                    { label: 'Suspended', value: 'SUSPENDED' }
                ]}
                selectedValues={selectedStatus}
                onChange={(values) => {
                    const url = new URL(window.location.href);
                    if (values.length) url.searchParams.set('status', values.join(','));
                    else url.searchParams.delete('status');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
            />
        </div>

        <DataTable {columns} props={props} />
    {/if}
</div>
