<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/table/column/StatusBadge.svelte";
    import { Pencil, Trash } from "lucide-svelte";
    import type { RadarSensor } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let props = {
        records: [] as RadarSensor[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc",
        },
        loading: false,
        filters: {
            accounts: [] as { id: string; name: string }[],
        },
    };

    let state = {
        selectedRecord: null as RadarSensor | null,
        confirmationOpen: false,
        title: "Delete Radar Controller",
        message: "",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        successMessage: "Radar Controller deleted successfully",
        errorMessage: "Failed to delete radar sensor",
    };

    function confirmDelete(sensor: RadarSensor) {
        state.selectedRecord = sensor;
        state.message = `Are you sure you want to delete the radar controller "${sensor.name}" (${sensor.serialNumber})? This action cannot be undone.`;
        state.confirmationOpen = true;
    }

    onMount(() => {
        if (!browser) return;

        const url = new URL(window.location.href);
        let needsRedirect = false;

        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

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
            width: "15%",
            render: (record: RadarSensor) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/controllers/radar",
                    showId: true,
                },
            }),
        },
        {
            id: "serialNumber",
            label: "Serial Number",
            sortable: true,
            width: "12%",
            render: (record: RadarSensor) => record.serialNumber,
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: RadarSensor) => ({
                component: StatusBadge,
                props: {
                    status: record.status,
                },
            }),
        },
        {
            id: "account",
            label: "Account",
            width: "12%",
            render: (record: RadarSensor) => record.account?.name || "N/A",
        },
        {
            id: "location",
            label: "Location",
            width: "12%",
            render: (record: RadarSensor) => record.location || "N/A",
        },
        {
            id: "trackingArea",
            label: "Tracking Area",
            width: "10%",
            render: (record: RadarSensor) => {
                if (!record.trackingArea) return "Not configured";
                const zoneCount = record.trackingArea._count?.zones || 0;
                return `${record.trackingArea.name} (${zoneCount} zones)`;
            },
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "12%",
            render: (record: RadarSensor) => ({
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
            width: "10%",
            render: (record: RadarSensor) => {
                const actionItems = [
                    {
                        label: "Configure",
                        icon: Pencil,
                        onClick: () =>
                            goto(`/admin/controllers/radar/${record.id}`),
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record),
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

<div class="space-y-4">
    <RecordDeleteDialog
        {state}
        actionName="deleteRadarSensor"
        action="?/deleteRadarSensor"
        onConfirm={() => {
            window.location.reload();
        }}
    />

    {#if props.loading}
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

            <PopoverFilter
                label="Account"
                options={props.filters.accounts?.map((account) => ({
                    label: account.name,
                    value: account.id,
                })) || []}
                selectedValues={$page.url.searchParams
                    .get("accountId")
                    ?.split(",")
                    .filter(Boolean) || []}
                key="accountId"
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
