<script lang="ts">
    /**
     * SensorDataTable - Reusable table for viewing ClickHouse sensor data
     *
     * Features:
     * - Server-side pagination, sorting, filtering via API
     * - Uses URL state for filters (shareable, back-button works)
     * - Account-scoped security (enforced at API level)
     * - No flashing on filter/sort changes (only shows skeleton on initial load)
     */

    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import DateRangeFilter from "$lib/components/ui_components_sveltekit/table/filter/DateRangeFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { getColumnsForDataType, type ColumnDef } from "./columns";
    import type {
        SensorDataType,
        SensorDataResponse,
    } from "$lib/server/clickhouse/sensor-data/types";

    // =========================================================================
    // Props
    // =========================================================================

    export let dataType: SensorDataType;
    export let sensorId: string | undefined = undefined;
    export let deviceId: string | undefined = undefined;
    export let targetId: string | undefined = undefined;
    export let pageSize: number = 25;
    export let customColumns: ColumnDef[] | undefined = undefined;
    export let showDateFilter: boolean = true;

    // =========================================================================
    // State
    // =========================================================================

    let initialLoading = true; // Only true on first load
    let fetching = false; // True during any fetch (for subtle loading indicator)
    let error: string | null = null;
    let mounted = false;

    let props = {
        records: [] as Record<string, unknown>[],
        pagination: {
            page: 1,
            per_page: pageSize,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "log_creation_time",
            order: "desc" as "asc" | "desc",
        },
        loading: false,
    };

    // Get columns for this data type (or use custom)
    $: columns =
        customColumns ?? enhanceColumns(getColumnsForDataType(dataType));

    // =========================================================================
    // Column Enhancement (add RelativeDate rendering for timestamps)
    // =========================================================================

    function enhanceColumns(cols: ColumnDef[]): ColumnDef[] {
        return cols.map((col) => {
            if (col.id === "log_creation_time") {
                return {
                    ...col,
                    render: (row: Record<string, unknown>) => ({
                        component: RelativeDate,
                        props: {
                            date: row.log_creation_time,
                            format: "relative",
                            showTooltip: true,
                            useHoverCard: true,
                            iconSize: 12,
                        },
                    }),
                };
            }
            return col;
        });
    }

    // =========================================================================
    // Data Fetching
    // =========================================================================

    // Track the last URL string to prevent duplicate fetches
    let lastFetchUrl = "";

    async function fetchData() {
        if (!browser) return;

        // Build query params from URL
        const urlParams = new URLSearchParams($page.url.searchParams);

        // Override with component props
        urlParams.set("per_page", String(pageSize));
        if (sensorId) urlParams.set("sensorId", sensorId);
        if (deviceId) urlParams.set("deviceId", deviceId);
        if (targetId) urlParams.set("targetId", targetId);

        const fetchUrl = `/api/sensor-data/${dataType}?${urlParams}`;

        // Skip if we just fetched this exact URL
        if (fetchUrl === lastFetchUrl && !initialLoading) {
            return;
        }
        lastFetchUrl = fetchUrl;

        fetching = true;
        error = null;

        try {
            const response = await fetch(fetchUrl);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || result.message || "Failed to fetch data",
                );
            }

            props = {
                records: result.data || [],
                pagination: result.pagination || {
                    page: 1,
                    per_page: pageSize,
                    total_records: 0,
                    total_pages: 0,
                },
                sort: result.sort || {
                    field: "log_creation_time",
                    order: "desc" as "asc" | "desc",
                },
                loading: false,
            };
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[SensorDataTable]", err);
        } finally {
            fetching = false;
            initialLoading = false;
        }
    }

    // Fetch on mount
    onMount(() => {
        mounted = true;
        fetchData();
    });

    // Track URL search params changes - only refetch when they actually change
    let prevSearchParams = "";
    $: if (browser && mounted) {
        const currentSearchParams = $page.url.searchParams.toString();
        if (currentSearchParams !== prevSearchParams) {
            prevSearchParams = currentSearchParams;
            fetchData();
        }
    }
</script>

<div class="space-y-4">
    {#if initialLoading}
        <LoadingSkeleton />
    {:else if error}
        <div class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-700">Error: {error}</p>
        </div>
    {:else}
        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-2">
            <div class="w-64">
                <DebouncedTextFilter
                    placeholder="Search..."
                    paramName="search"
                    value={$page.url.searchParams.get("search") || ""}
                />
            </div>

            {#if showDateFilter}
                <DateRangeFilter
                    label="Time Range"
                    startParamName="startTime"
                    endParamName="endTime"
                    format_string="yyyy-MM-dd'T'HH:mm:ss"
                />
            {/if}

            <!-- Subtle loading indicator for refetches -->
            {#if fetching}
                <div class="text-sm text-muted-foreground animate-pulse">
                    Loading...
                </div>
            {/if}
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
