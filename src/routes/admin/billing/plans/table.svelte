<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RecordActions, {
        type ActionItem,
    } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Pencil } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Plan type matching server data
    type PlanRecord = {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        maxDevices: number;
        maxUsers: number;
        maxLogLinesPerMonth: number;
        dataRetentionDays: number;
        stripeProductId: string | null;
        stripePriceId: string | null;
        features: string[];
        subscriptionCount: number;
    };

    // Props for DataTable component
    export let props = {
        records: [] as PlanRecord[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "name",
            order: "asc" as "asc" | "desc",
        },
        loading: false,
    };

    // Stores for filters
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ??
            [],
    );

    $: {
        const urlStatuses =
            $page.url.searchParams
                .get("statuses")
                ?.split(",")
                .filter(Boolean) ?? [];
        if (JSON.stringify(urlStatuses) !== JSON.stringify($selectedStatuses)) {
            selectedStatuses.set(urlStatuses);
        }
    }

    // Format limit values
    function formatLimit(value: number): string {
        return value >= 999999 ? "Unlimited" : value.toLocaleString();
    }

    // Format log limits
    function formatLogs(value: number): string {
        if (value >= 999999999) return "Unlimited";
        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toLocaleString();
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Plan",
            sortable: true,
            width: "18%",
            render: (record: PlanRecord) => ({
                component: NameWithIdLink,
                props: {
                    record: { id: record.id, name: record.name },
                    baseUrl: "/admin/billing/plans",
                    showId: false,
                },
            }),
        },
        {
            id: "code",
            label: "Code",
            sortable: true,
            width: "10%",
            render: (record: PlanRecord) => record.code,
        },
        {
            id: "isActive",
            label: "Status",
            sortable: true,
            width: "8%",
            render: (record: PlanRecord) =>
                record.isActive ? "Active" : "Inactive",
        },
        {
            id: "maxDevices",
            label: "Devices",
            sortable: true,
            width: "8%",
            render: (record: PlanRecord) => formatLimit(record.maxDevices),
        },
        {
            id: "maxUsers",
            label: "Users",
            sortable: true,
            width: "8%",
            render: (record: PlanRecord) => formatLimit(record.maxUsers),
        },
        {
            id: "dataRetentionDays",
            label: "Retention",
            sortable: true,
            width: "8%",
            render: (record: PlanRecord) => `${record.dataRetentionDays}d`,
        },
        {
            id: "maxLogLinesPerMonth",
            label: "Logs/mo",
            sortable: true,
            width: "10%",
            render: (record: PlanRecord) =>
                formatLogs(record.maxLogLinesPerMonth),
        },
        {
            id: "stripePriceId",
            label: "Stripe",
            width: "10%",
            render: (record: PlanRecord) => {
                if (record.stripePriceId) return "Connected";
                if (record.code === "free" || record.code === "enterprise")
                    return "N/A";
                return "Missing";
            },
        },
        {
            id: "subscriptionCount",
            label: "Subs",
            sortable: true,
            width: "6%",
            render: (record: PlanRecord) => String(record.subscriptionCount),
        },
        {
            id: "actions",
            label: "",
            width: "6%",
            render: (record: PlanRecord) => {
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () =>
                            goto(`/admin/billing/plans/${record.id}`),
                    },
                ];
                return {
                    component: RecordActions,
                    props: { items: actionItems },
                };
            },
        },
    ];
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name or code..."
                    paramName="search"
                    value={$page.url.searchParams.get("search") || ""}
                />
            </div>

            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" },
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />
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
