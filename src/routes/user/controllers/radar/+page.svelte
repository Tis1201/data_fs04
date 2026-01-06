<script lang="ts">
    import { goto } from "$app/navigation";
    import { Plus } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/table/column/StatusBadge.svelte";
    import { Pencil } from "lucide-svelte";
    import type { Sensor } from "@prisma/client";
    import { page } from "$app/stores";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { canCreate } from "$lib/utils/permissions";
    import type { PageData } from "./$types";

    export let data: PageData;
    
    // Check if user can create new radar controllers
    $: showCreateButton = canCreate(data.modulePermissions, 'USER_CONTROLLERS_RADAR', data.user?.systemRole);

    $: tableProps = {
        records: data.radarSensors || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0,
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: (data.sort?.order || "desc") as "asc" | "desc",
        },
        loading: false,
    };

    const statusOptions = [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Maintenance", value: "MAINTENANCE" },
    ];

    $: columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Sensor) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        ...record,
                        id: (record as Sensor & { controller?: { id: string } | null }).controller?.id || record.id,
                    },
                    baseUrl: "/user/controllers/radar",
                    showId: true,
                },
            }),
        },
        {
            id: "serialNumber",
            label: "Serial Number",
            sortable: true,
            width: "15%",
            render: (record: Sensor) => record.serialNumber,
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "12%",
            render: (record: Sensor) => ({
                component: StatusBadge,
                props: {
                    status: record.status,
                },
            }),
        },
        {
            id: "location",
            label: "Location",
            width: "15%",
            render: (record: Sensor) => record.location || "N/A",
        },
        {
            id: "trackingArea",
            label: "Tracking Area",
            width: "15%",
            render: (record: Sensor) => {
                const config = record.config as { trackingArea?: { name: string }; zones?: Array<{ name: string }>; dwellBuckets?: Array<{ name: string }> } | null;
                if (!config?.trackingArea) return "Not configured";
                const zoneCount = config?.zones?.length || 0;
                return `${config.trackingArea.name} (${zoneCount} zones)`;
            },
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "12%",
            render: (record: Sensor) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12,
                },
            }),
        },
        {
            id: "actions",
            label: "Actions",
            width: "11%",
            render: (record: any) => {
                const controllerId = record.controller?.id || record.id;
                const actionItems = [
                    {
                        label: "Configure",
                        icon: Pencil,
                        onClick: () =>
                            goto(`/user/controllers/radar/${controllerId}`),
                    },
                ];

                return {
                    component: RecordActions,
                    props: {
                        items: actionItems,
                    },
                };
            },
        },
    ];
</script>

<div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">Radar Controllers</h1>
            <p class="text-muted-foreground">Manage your radar sensor controllers</p>
        </div>
        {#if showCreateButton}
            <Button
                on:click={() => goto("/user/controllers/radar/new")}
                class="flex items-center gap-2"
            >
                <Plus class="h-4 w-4" />
                Register Controller
            </Button>
        {/if}
    </div>

    <div class="space-y-4">
        {#if tableProps.loading}
            <LoadingSkeleton />
        {:else}
            <div class="flex items-center gap-2">
                <div class="w-1/3">
                    <DebouncedTextFilter
                        placeholder="Search by name, serial number, location..."
                        paramName="search"
                        value={$page.url.searchParams.get("search") || ""}
                    />
                </div>

                <PopoverFilter
                    label="Status"
                    options={statusOptions}
                    selectedValues={$page.url.searchParams
                        .get("statuses")
                        ?.split(",")
                        .filter(Boolean) || []}
                    key="statuses"
                />
            </div>

            <DataTable
                {columns}
                props={tableProps}
                on:sort={handleTableSort}
                on:pagination={handleTablePagination}
            />
        {/if}
    </div>
</div>

