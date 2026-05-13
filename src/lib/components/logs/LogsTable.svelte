<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Download, AlertCircle, Info, FileText } from "lucide-svelte";
    import { browser } from "$app/environment";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { triggerFileDownload } from "$lib/utils/download";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let props = {
        records: [] as any[], // LogEntry[]
        pagination: {
            page: 1,
            per_page: 50,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "timestamp",
            order: "desc" as "asc" | "desc",
        },
        loading: false,
    };

    const levelOptions = [
        { label: "Info", value: "INFO" },
        { label: "Warning", value: "WARN" },
        { label: "Error", value: "ERROR" },
        { label: "Debug", value: "DEBUG" },
    ];

    $: columns = [
        {
            id: "timestamp",
            label: "Time",
            sortable: true,
            width: "15%",
            render: (record: any) => ({
                component: RelativeDate,
                props: {
                    date: new Date(record.timestamp),
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                },
            }),
        },
        {
            id: "level",
            label: "Level",
            sortable: true,
            width: "10%",
            render: (record: any) => record.level, // Could add a badge here later
        },
        {
            id: "message",
            label: "Message",
            sortable: true,
            width: "45%",
            render: (record: any) => record.message,
        },
        {
            id: "device_id",
            label: "Device",
            sortable: true,
            width: "15%",
            render: (record: any) => record.device_id || "N/A",
        },
        {
            id: "account_id",
            label: "Account",
            width: "15%",
            render: (record: any) => record.account_id || "N/A",
        },
    ];

    async function handleExport(format: "csv" | "json") {
        const searchParams = new URLSearchParams($page.url.searchParams);
        searchParams.set("format", format);
        const exportUrl = `/api/logs/export?${searchParams.toString()}`;
        try {
            toast.info("Export started. Large files may take a moment.");
            const res = await fetch(exportUrl, { credentials: "include" });
            if (!res.ok) {
                const msg = await res.text().catch(() => res.statusText);
                toast.error(`Export failed: ${msg.slice(0, 80)}`);
                return;
            }
            const data = await res.json();
            await triggerFileDownload({
                downloadUrl: data.downloadUrl,
                fileName: data.fileName || `logs.${format}`,
                ...(data.downloadAuth && { downloadAuth: data.downloadAuth }),
            });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Export failed");
        }
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
        <div class="flex flex-1 items-center gap-2">
            <div class="w-1/3 min-w-[200px]">
                <DebouncedTextFilter
                    placeholder="Search logs..."
                    paramName="search"
                    value={$page.url.searchParams.get("search") || ""}
                />
            </div>

            <PopoverFilter
                label="Level"
                options={levelOptions}
                selectedValues={$page.url.searchParams
                    .get("level")
                    ?.split(",")
                    .filter(Boolean) || []}
                key="level"
            />

            <!-- TODO: Add Date Range Picker here -->
        </div>

        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild let:builder>
                <Button builders={[builder]} variant="outline" size="sm">
                    <Download class="mr-2 h-4 w-4" />
                    Export
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
                <DropdownMenu.Item on:click={() => handleExport("csv")}>
                    <FileText class="mr-2 h-4 w-4" />
                    Export as CSV
                </DropdownMenu.Item>
                <DropdownMenu.Item on:click={() => handleExport("json")}>
                    <FileText class="mr-2 h-4 w-4" />
                    Export as JSON
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>

    <DataTable
        {columns}
        {props}
        on:sort={handleTableSort}
        on:pagination={handleTablePagination}
    />
</div>
