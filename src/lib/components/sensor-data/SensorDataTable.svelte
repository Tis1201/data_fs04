<script lang="ts">
    /**
     * SensorDataTable - Reusable table for viewing ClickHouse sensor data
     *
     * Features:
     * - Server-side pagination, sorting, filtering via API
     * - Uses URL state for filters (shareable, back-button works)
     * - Account-scoped security (enforced at API level)
     * - No flashing on filter/sort changes (only shows skeleton on initial load)
     * - CSV export functionality
     */

    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import DateRangeFilter from "$lib/components/ui_components_sveltekit/table/filter/DateRangeFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Download } from "lucide-svelte";
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
    export let showExport: boolean = true;

    // =========================================================================
    // State
    // =========================================================================

    let initialLoading = true;
    let fetching = false;
    let exporting = false;
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

    $: columns =
        customColumns ?? enhanceColumns(getColumnsForDataType(dataType));

    // =========================================================================
    // Column Enhancement
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

    let lastFetchUrl = "";

    async function fetchData() {
        if (!browser) return;

        const urlParams = new URLSearchParams($page.url.searchParams);
        urlParams.set("per_page", String(pageSize));
        if (sensorId) urlParams.set("sensorId", sensorId);
        if (deviceId) urlParams.set("deviceId", deviceId);
        if (targetId) urlParams.set("targetId", targetId);

        const fetchUrl = `/api/sensor-data/${dataType}?${urlParams}`;

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

    // =========================================================================
    // CSV Export
    // =========================================================================

    async function exportToCsv() {
        if (!browser) return;

        exporting = true;

        try {
            // Build query params but request more data for export
            const urlParams = new URLSearchParams($page.url.searchParams);
            urlParams.set("per_page", "10000"); // Export up to 10,000 rows
            urlParams.set("page", "1");
            if (sensorId) urlParams.set("sensorId", sensorId);
            if (deviceId) urlParams.set("deviceId", deviceId);
            if (targetId) urlParams.set("targetId", targetId);

            const response = await fetch(
                `/api/sensor-data/${dataType}?${urlParams}`,
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Failed to fetch data for export",
                );
            }

            const data = result.data || [];
            if (data.length === 0) {
                alert("No data to export");
                return;
            }

            // Get column headers from the columns config
            const exportColumns = getColumnsForDataType(dataType);
            const headers = exportColumns.map((col) => col.label);
            const columnIds = exportColumns.map((col) => col.id);

            // Build CSV content
            const csvRows: string[] = [];

            // Header row
            csvRows.push(headers.map((h) => `"${h}"`).join(","));

            // Data rows
            for (const row of data) {
                const values = columnIds.map((id) => {
                    const value = row[id];
                    if (value === null || value === undefined) return "";
                    const strValue = String(value).replace(/"/g, '""');
                    return `"${strValue}"`;
                });
                csvRows.push(values.join(","));
            }

            const csvContent = csvRows.join("\n");

            // Create and download file
            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `${dataType}_export_${new Date().toISOString().split("T")[0]}.csv`,
            );
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("[SensorDataTable Export]", err);
            alert(err instanceof Error ? err.message : "Export failed");
        } finally {
            exporting = false;
        }
    }

    // Fetch on mount
    onMount(() => {
        mounted = true;
        fetchData();
    });

    // Track URL search params changes
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

            <!-- Spacer -->
            <div class="flex-1"></div>

            {#if showExport}
                <Button
                    variant="outline"
                    size="sm"
                    on:click={exportToCsv}
                    disabled={exporting || props.records.length === 0}
                    class="gap-2"
                >
                    <Download class="h-4 w-4" />
                    {#if exporting}
                        Exporting...
                    {:else}
                        Export CSV
                    {/if}
                </Button>
            {/if}

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
