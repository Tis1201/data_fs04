<script lang="ts">
    /**
     * Device Progress card – shows summary metrics and device table for a selected batch/wave.
     * Design: matches Batch Progress modal (4 summary cards, table # / Device Name / Status / Issues / Started On / End On).
     */
    import { onDestroy, onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { mqttClient } from '$lib/client/mqtt/mqttClient';
    import { Card, DataTable } from '$lib/design-system/components';
    import type { ColumnDef } from '$lib/design-system/components';

    // Props
    export let bundleId: string;
    export let selectedWave: any = null;
    export let reloadToken: number = 0;
    export let loading = false;
    export let apiPrefix: string = '/api/admin';
    export let deviceLinkPrefix: string = '/admin/iot/devices';

    type DeviceProgress = {
        id: string;
        deviceId: string;
        deviceName: string;
        status: string;
        progress: number;
        startedAt: string | null;
        completedAt: string | null;
        errorDetails: string | null;
        retryCount: number;
        connected?: boolean;
    };

    let devices: DeviceProgress[] = [];
    let loadingDevices = false;
    let abortController: AbortController | null = null;

    const PAGE_SIZE = 10;
    let currentPage = 1;

    async function loadDevicesForWave() {
        if (!bundleId || !selectedWave?.id) {
            devices = [];
            return;
        }
        loadingDevices = true;
        try {
            if (abortController) abortController.abort();
            abortController = new AbortController();
            const res = await fetch(
                `${apiPrefix}/iot/bundles/${bundleId}/waves/${selectedWave.id}/progress`,
                { signal: abortController.signal }
            );
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load device progress');
            devices = (json.data || []) as DeviceProgress[];
            currentPage = 1;
        } catch (e) {
            devices = [];
        } finally {
            loadingDevices = false;
        }
    }

    $: selectedWave && loadDevicesForWave();
    $: reloadToken, selectedWave && loadDevicesForWave();
    onDestroy(() => {
        if (abortController) abortController.abort();
    });

    // Summary counts (Figma: Total Devices, Devices Completed, Devices in progress, Devices Failed)
    $: totalDevices = devices.length;
    $: completedCount = devices.filter((d) => d.status === 'COMPLETED').length;
    $: inProgressCount = devices.filter((d) => d.status === 'IN_PROGRESS' || d.status === 'PENDING').length;
    $: failedCount = devices.filter((d) => d.status === 'FAILED').length;

    $: totalPages = Math.max(1, Math.ceil(totalDevices / PAGE_SIZE));
    $: pagination = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        totalItems: totalDevices,
        totalPages
    };
    $: tableData = devices
        .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
        .map((row, i) => ({ ...row, _displayIndex: (currentPage - 1) * PAGE_SIZE + i + 1 }));

    function getStatusColor(status: string): 'gray' | 'error' | 'warning' | 'success' | 'rose' {
        const map: Record<string, 'gray' | 'error' | 'warning' | 'success' | 'rose'> = {
            COMPLETED: 'success',
            IN_PROGRESS: 'warning',
            PENDING: 'warning',
            FAILED: 'error',
            ROLLED_BACK: 'warning',
            CANCELLED: 'rose'
        };
        return map[status] ?? 'gray';
    }
    function getStatusLabel(status: string): string {
        const map: Record<string, string> = {
            COMPLETED: 'Completed',
            IN_PROGRESS: 'In Progress',
            PENDING: 'Pending',
            FAILED: 'Failed',
            ROLLED_BACK: 'Rolled Back',
            CANCELLED: 'Cancelled'
        };
        return map[status] ?? status;
    }

    const columns: ColumnDef<any>[] = [
        {
            id: '_displayIndex',
            header: '#',
            accessor: '_displayIndex',
            type: 'custom',
            render: (value: number) => String(value).padStart(2, '0'),
            sortable: false,
            width: '50px'
        },
        {
            id: 'deviceName',
            header: 'Device Name',
            accessor: (row) => row.deviceName,
            type: 'textWithSupporting',
            supportingField: 'deviceId',
            sortable: false
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row) => getStatusLabel(row.status),
            type: 'badge',
            sortable: false,
            statusColor: (_v, row) => getStatusColor(row.status),
            showDot: () => true
        },
        {
            id: 'issues',
            header: 'Issues',
            accessor: (row) => row.errorDetails || '—',
            type: 'text',
            sortable: false
        },
        {
            id: 'startedAt',
            header: 'Started On',
            accessor: 'startedAt',
            type: 'datetime',
            sortable: false
        },
        {
            id: 'completedAt',
            header: 'End On',
            accessor: 'completedAt',
            type: 'datetime',
            sortable: false
        }
    ];

    function handlePageChange(e: CustomEvent<number>) {
        const page = e.detail;
        if (page >= 1 && page <= totalPages) currentPage = page;
    }

    function handleRowClick(e: CustomEvent<{ row: any }>) {
        const row = e.detail?.row;
        if (row?.deviceId) goto(`${deviceLinkPrefix}/${row.deviceId}`);
    }

    // MQTT: real-time device connection updates
    onMount(() => {
        const unsubConnection = mqttClient.onNotification('device:connection', (payload: any) => {
            const deviceId = payload?.deviceId;
            if (!deviceId) return;
            const idx = devices.findIndex((d) => d.deviceId === deviceId);
            if (idx >= 0) {
                devices[idx].connected = payload?.connected ?? true;
                devices = [...devices];
            }
        });
        const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
            const deviceId = payload?.deviceId;
            if (!deviceId) return;
            const idx = devices.findIndex((d) => d.deviceId === deviceId);
            if (idx >= 0) {
                devices[idx].connected = false;
                devices = [...devices];
            }
        });
        return () => {
            unsubConnection();
            unsubDisconnection();
        };
    });
</script>

<Card showHeader={true} padding="md" radius="2xl" variant="default">
    <svelte:fragment slot="header">
        <div class="device-progress-card-header">
            <h3 class="device-progress-card-title">Device Progress</h3>
            <p class="device-progress-card-subtitle">
                {#if selectedWave}
                    Showing progress for devices in batch: {selectedWave.name}
                {:else}
                    Select a batch to view device progress
                {/if}
            </p>
        </div>
    </svelte:fragment>

    {#if loading || loadingDevices}
        <div class="device-progress-loading">
            <p class="device-progress-loading-text">Loading device progress...</p>
        </div>
    {:else if !selectedWave}
        <div class="device-progress-empty">
            <p class="device-progress-empty-text">Select a wave to view device progress</p>
        </div>
    {:else if devices.length === 0}
        <div class="device-progress-empty">
            <p class="device-progress-empty-text">No device progress data available for this wave</p>
        </div>
    {:else}
        <div class="device-progress-body">
            <!-- Summary cards (Figma: Total Devices, Devices Completed, Devices in progress, Devices Failed) -->
            <div class="device-progress-summary">
                <div class="device-progress-card">
                    <span class="device-progress-card-label">Total Devices</span>
                    <span class="device-progress-card-value">{totalDevices.toString().padStart(2, '0')}</span>
                </div>
                <div class="device-progress-card">
                    <span class="device-progress-card-label">Devices Completed</span>
                    <span class="device-progress-card-value">{completedCount.toString().padStart(2, '0')}</span>
                </div>
                <div class="device-progress-card">
                    <span class="device-progress-card-label">Devices in progress</span>
                    <span class="device-progress-card-value">{inProgressCount.toString().padStart(2, '0')}</span>
                </div>
                <div class="device-progress-card">
                    <span class="device-progress-card-label">Devices Failed</span>
                    <span class="device-progress-card-value">{failedCount.toString().padStart(2, '0')}</span>
                </div>
            </div>

            <!-- Device table (Figma: #, Device Name, Status, Issues, Started On, End On) -->
            <div class="device-progress-table-wrap">
                <DataTable
                    data={tableData}
                    columns={columns}
                    keyField="id"
                    paginated={totalDevices > PAGE_SIZE}
                    pagination={pagination}
                    selectable={false}
                    hoverable={true}
                    bordered={false}
                    cellBorders={true}
                    emptyMessage="No devices in this batch"
                    on:pageChange={handlePageChange}
                    on:rowClick={handleRowClick}
                />
            </div>
        </div>
    {/if}
</Card>

<style>
    .device-progress-card-header {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }
    .device-progress-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-medium);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .device-progress-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }

    .device-progress-loading,
    .device-progress-empty {
        padding: var(--ds-space-8);
        text-align: center;
    }
    .device-progress-loading-text,
    .device-progress-empty-text {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    .device-progress-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        width: 100%;
    }

    .device-progress-summary {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: stretch;
        gap: var(--ds-space-4);
        width: 100%;
    }
    .device-progress-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-2-5);
        padding: var(--ds-space-4);
        background: var(--ds-color-white);
        border: 1px solid var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-xl);
        min-width: 120px;
        flex: 1 1 0;
    }
    .device-progress-card-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }
    .device-progress-card-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xl);
        font-weight: var(--ds-font-semibold);
        line-height: var(--ds-leading-lg);
        color: var(--ds-color-neutral-true-900);
    }

    .device-progress-table-wrap {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        background: var(--ds-color-white);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
        font-family: var(--ds-font-family-primary);
    }
    .device-progress-table-wrap :global(thead th) {
        background: var(--ds-color-neutral-true-100);
        border-bottom: 1px solid var(--ds-border-default);
        padding: var(--ds-space-3) var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    .device-progress-table-wrap :global(tbody td) {
        padding: var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-default);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-900);
    }
    .device-progress-table-wrap :global(.ds-datatable-pagination) {
        border-top: 1px solid var(--ds-border-default);
        padding: var(--ds-space-2) var(--ds-space-6);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-600);
    }
</style>
