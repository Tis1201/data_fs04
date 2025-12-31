<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RecordActions, {
        type ActionItem,
    } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Eye, ExternalLink, AlertTriangle } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Subscription type matching server data
    type SubscriptionRecord = {
        id: string;
        accountId: string;
        accountName: string;
        accountSlug: string;
        planId: string;
        planCode: string;
        planName: string;
        source: string;
        status: string;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        createdAt: Date;
        updatedAt: Date;
    };

    // Props for DataTable component
    export let props = {
        records: [] as SubscriptionRecord[],
        pagination: {
            page: 1,
            per_page: 50,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "updatedAt",
            order: "desc" as "asc" | "desc",
        },
        loading: false,
    };

    // Stores for filters
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ??
            [],
    );
    const selectedSources = writable<string[]>(
        $page.url.searchParams.get("sources")?.split(",").filter(Boolean) ?? [],
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
        const urlSources =
            $page.url.searchParams.get("sources")?.split(",").filter(Boolean) ??
            [];
        if (JSON.stringify(urlSources) !== JSON.stringify($selectedSources)) {
            selectedSources.set(urlSources);
        }
    }

    // Status color mapping
    function getStatusVariant(status: string): string {
        switch (status) {
            case "active":
                return "Active";
            case "trialing":
                return "Pending";
            case "past_due":
                return "Warning";
            case "canceled":
                return "Inactive";
            case "pending_cancel":
                return "Warning";
            default:
                return "default";
        }
    }

    // Column definitions
    const columns = [
        {
            id: "accountName",
            label: "Account",
            sortable: true,
            width: "22%",
            render: (record: SubscriptionRecord) => ({
                component: NameWithIdLink,
                props: {
                    record: { id: record.id, name: record.accountName },
                    baseUrl: "/admin/billing/subscriptions",
                    showId: false,
                },
            }),
        },
        {
            id: "planName",
            label: "Plan",
            sortable: true,
            width: "12%",
            render: (record: SubscriptionRecord) => record.planName,
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "12%",
            render: (record: SubscriptionRecord) => {
                const variant = getStatusVariant(record.status);
                const showWarning = record.cancelAtPeriodEnd;
                return `${variant}${showWarning ? " (canceling)" : ""}`;
            },
        },
        {
            id: "source",
            label: "Source",
            sortable: true,
            width: "10%",
            render: (record: SubscriptionRecord) =>
                record.source === "stripe" ? "Stripe" : "License",
        },
        {
            id: "currentPeriodEnd",
            label: "Period End",
            sortable: true,
            width: "15%",
            render: (record: SubscriptionRecord) => {
                if (!record.currentPeriodEnd) return "—";
                return {
                    component: RelativeDate,
                    props: {
                        date: record.currentPeriodEnd,
                        showIcon: true,
                    },
                };
            },
        },
        {
            id: "updatedAt",
            label: "Updated",
            sortable: true,
            width: "15%",
            render: (record: SubscriptionRecord) => ({
                component: RelativeDate,
                props: {
                    date: record.updatedAt,
                    showIcon: true,
                },
            }),
        },
        {
            id: "actions",
            label: "",
            width: "8%",
            render: (record: SubscriptionRecord) => {
                const actionItems: ActionItem[] = [
                    {
                        label: "View Details",
                        icon: Eye,
                        onClick: () =>
                            goto(`/admin/billing/subscriptions/${record.id}`),
                    },
                    {
                        label: "View Account",
                        icon: Eye,
                        onClick: () =>
                            goto(
                                `/admin/accounts/accounts/${record.accountId}`,
                            ),
                    },
                ];

                if (record.stripeSubscriptionId) {
                    actionItems.push({
                        label: "View in Stripe",
                        icon: ExternalLink,
                        onClick: () =>
                            window.open(
                                `https://dashboard.stripe.com/subscriptions/${record.stripeSubscriptionId}`,
                                "_blank",
                            ),
                    });
                }

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
                    placeholder="Search by account or plan..."
                    paramName="search"
                    value={$page.url.searchParams.get("search") || ""}
                />
            </div>

            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "active" },
                    { label: "Trialing", value: "trialing" },
                    { label: "Past Due", value: "past_due" },
                    { label: "Canceled", value: "canceled" },
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />

            <!-- Source filter -->
            <PopoverFilter
                label="Source"
                options={[
                    { label: "Stripe", value: "stripe" },
                    { label: "License", value: "license" },
                ]}
                selectedValues={$selectedSources}
                key="sources"
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
