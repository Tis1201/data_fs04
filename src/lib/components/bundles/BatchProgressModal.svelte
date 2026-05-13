<script lang="ts">
    /**
     * Batch Progress modal – opened when user clicks a Batch Name in Deployment Batches table.
     * Shows: title "Batch Progress", 4 summary cards (Total / Completed / In progress / Failed),
     * device table (#, Device Name, Status, Issues, Started On, End On), pagination, Close button.
     */
    import { onDestroy, createEventDispatcher } from 'svelte';
    import { Modal, Button, DataTable, InputField } from '$lib/design-system/components';
    import type { ColumnDef } from '$lib/design-system/components';

    type DeviceProgress = {
        id: string;
        deviceId: string;
        deviceName: string;
        status: string;
        progress?: number;
        startedAt: string | null;
        completedAt: string | null;
        errorDetails: string | null;
        retryCount?: number;
    };

    export let open = false;
    export let bundleId: string = '';
    export let wave: { id: string; name: string } | null = null;
    export let apiPrefix: string = '/api/user';
    export let reloadToken: number = 0; // Incremented by parent when real-time updates occur

    const dispatch = createEventDispatcher<{ close: void }>();
    let devices: DeviceProgress[] = [];
    let loading = false;
    let refreshing = false; // true when re-fetching due to real-time update (show "Updating" overlay)
    let abortController: AbortController | null = null;

    const PAGE_SIZE = 10;
    let currentPage = 1;
    let searchTerm = '';

    $: totalDevices = devices.length;
    $: completedCount = devices.filter((d) => d.status === 'COMPLETED').length;
    $: inProgressCount = devices.filter((d) => d.status === 'IN_PROGRESS' || d.status === 'PENDING').length;
    $: failedCount = devices.filter((d) => d.status === 'FAILED').length;

    // Filter by device name or ID for table (summary cards still show full batch totals)
    $: filteredDevices = devices.filter((d) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.trim().toLowerCase();
        return (d.deviceName?.toLowerCase().includes(term)) || (d.deviceId?.toLowerCase().includes(term));
    });
    $: filteredTotal = filteredDevices.length;
    $: totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
    $: pagination = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        totalItems: filteredTotal,
        totalPages
    };
    $: tableData = filteredDevices
        .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
        .map((row, i) => ({ ...row, _displayIndex: (currentPage - 1) * PAGE_SIZE + i + 1 }));

    async function loadProgress(isRefresh = false) {
        if (!bundleId || !wave?.id) {
            devices = [];
            return;
        }
        const hadData = devices.length > 0;
        if (isRefresh && hadData) {
            refreshing = true;
        } else {
            loading = true;
        }
        try {
            if (abortController) abortController.abort();
            abortController = new AbortController();
            const res = await fetch(`${apiPrefix}/iot/bundles/${bundleId}/waves/${wave.id}/progress`, {
                signal: abortController.signal
            });
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load progress');
            devices = (json.data || []) as DeviceProgress[];
            currentPage = 1;
            searchTerm = '';
        } catch (e) {
            devices = [];
        } finally {
            loading = false;
            refreshing = false;
        }
    }

    $: if (open && wave?.id && bundleId) loadProgress(false);
    // Reload when reloadToken changes (real-time updates from MQTT)
    $: if (open && wave?.id && bundleId && reloadToken > 0) {
        loadProgress(true);
    }
    onDestroy(() => { if (abortController) abortController.abort(); });

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

    /** Escape for safe display in HTML body. */
    function escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
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
            type: 'custom',
            sortable: false,
            render: (value: string, row: any) => {
                if (!value || value === '—') return '—';
                const truncated = value.length > 100 ? value.substring(0, 100) + '...' : value;
                const fullEscaped = escapeHtml(value);
                const bodyEscaped = escapeHtml(truncated);
                return `<span class="issue-cell-wrap"><span class="issue-cell-text">${bodyEscaped}</span><span class="issue-tooltip-popup">${fullEscaped}</span></span>`;
            }
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

    function handleClose() {
        open = false;
        wave = null;
        devices = [];
        currentPage = 1;
        searchTerm = '';
        dispatch('close');
    }

    // Reset to page 1 when search changes
    $: searchTerm, (currentPage = 1);
</script>

<Modal
    bind:open
    title="Batch Progress"
    type="default"
    size="2xl"
    showFooter={false}
    on:close={handleClose}
>
    <svelte:fragment slot="footer">
        <div class="batch-progress-modal-footer">
            <Button variant="filled" color="primary" size="lg" on:click={handleClose}>
                Close
            </Button>
        </div>
    </svelte:fragment>

    {#if wave && bundleId}
        {#if loading}
            <div class="batch-progress-loading">
                <p class="batch-progress-loading-text">Loading batch progress...</p>
            </div>
        {:else}
            <div class="batch-progress-body">
                <!-- Updating overlay when re-fetching due to real-time update -->
                {#if refreshing}
                    <div class="batch-progress-updating-overlay" aria-hidden="true">
                        <div class="batch-progress-updating-content">
                            <div class="batch-progress-updating-spinner"></div>
                            <span class="batch-progress-updating-text">Updating</span>
                        </div>
                    </div>
                {/if}
                <!-- Summary cards (design: Total Devices, Devices Completed, Devices in progress, Devices Failed) -->
                <div class="batch-progress-summary">
                    <div class="batch-progress-card">
                        <span class="batch-progress-card-label">Total Devices</span>
                        <span class="batch-progress-card-value">{totalDevices.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="batch-progress-card">
                        <span class="batch-progress-card-label">Devices Completed</span>
                        <span class="batch-progress-card-value">{completedCount.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="batch-progress-card">
                        <span class="batch-progress-card-label">Devices in progress</span>
                        <span class="batch-progress-card-value">{inProgressCount.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="batch-progress-card">
                        <span class="batch-progress-card-label">Devices Failed</span>
                        <span class="batch-progress-card-value">{failedCount.toString().padStart(2, '0')}</span>
                    </div>
                </div>

                <!-- Search by device name or ID -->
                <div class="batch-progress-search-row">
                    <InputField
                        type="search"
                        placeholder="Search by device name or ID..."
                        value={searchTerm}
                        showClearButton={true}
                        label=""
                        on:input={(e) => (searchTerm = e.detail)}
                        on:clear={() => (searchTerm = '')}
                    />
                </div>

                <!-- Device table -->
                <div class="batch-progress-table-wrap">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        keyField="id"
                        paginated={filteredTotal > PAGE_SIZE}
                        pagination={pagination}
                        selectable={false}
                        hoverable={false}
                        bordered={false}
                        cellBorders={true}
                        emptyMessage={searchTerm.trim() ? 'No devices match your search.' : 'No devices in this batch'}
                        on:pageChange={handlePageChange}
                    />
                </div>
            </div>
        {/if}
    {/if}
</Modal>

<style>
    /* Modal body: flex column, 16px padding/gap (Figma); relative for updating overlay */
    .batch-progress-body {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        width: 100%;
    }

    .batch-progress-loading {
        padding: var(--ds-space-8);
        text-align: center;
    }
    .batch-progress-loading-text {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
        font-family: var(--ds-font-family-primary);
    }

    /* Summary cards row: flex row, gap 16px (Figma: datas) */
    .batch-progress-summary {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: stretch;
        gap: var(--ds-space-4);
        width: 100%;
    }
    .batch-progress-search-row {
        max-width: 320px;
    }

    /* Each card (Figma: wrap): 16px padding, 10px gap, white bg, border E5E5E5, radius 12px */
    .batch-progress-card {
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
    /* Label: 14px regular, #525252 (Figma: Body/14px/14-Regular, Neutral True/600) */
    .batch-progress-card-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }
    /* Value: 20px semibold, 28px line-height, #141414 (Figma: Heading/H3, Neutral True/900) */
    .batch-progress-card-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xl);
        font-weight: var(--ds-font-semibold);
        line-height: var(--ds-leading-lg);
        color: var(--ds-color-neutral-true-900);
    }

    /* Table wrap: white bg, radius 9px (Figma: table wrap); overflow visible so issue tooltip can show */
    .batch-progress-table-wrap {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        background: var(--ds-color-white);
        border-radius: var(--ds-radius-lg);
        overflow: visible;
        font-family: var(--ds-font-family-primary);
    }
    .batch-progress-table-wrap :global(thead th) {
        background: var(--ds-color-neutral-true-100);
        border-bottom: 1px solid var(--ds-border-default);
        padding: var(--ds-space-3) var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    .batch-progress-table-wrap :global(tbody td) {
        padding: var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-default);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-900);
        max-width: 300px;
    }
    
    /* Issue cell: multiline text + custom tooltip (fast, styled) */
    .batch-progress-table-wrap :global(.issue-cell-wrap) {
        position: relative;
        display: inline-block;
        max-width: 100%;
        cursor: help;
    }
    .batch-progress-table-wrap :global(.issue-cell-text) {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        word-break: break-word;
        line-height: 1.4;
    }
    .batch-progress-table-wrap :global(.issue-cell-wrap:hover .issue-cell-text) {
        color: var(--ds-color-primary-600);
    }
    /* Custom tooltip: polished popover style with arrow */
    .batch-progress-table-wrap :global(.issue-tooltip-popup) {
        visibility: hidden;
        opacity: 0;
        position: absolute;
        z-index: 9999;
        bottom: calc(100% + 10px);
        left: 0;
        max-width: 380px;
        min-width: 120px;
        padding: 12px 14px;
        background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
        color: #f3f4f6;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.5;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 10px 25px -5px rgba(0, 0, 0, 0.35),
            0 8px 10px -6px rgba(0, 0, 0, 0.2);
        white-space: pre-wrap;
        word-break: break-word;
        pointer-events: none;
        transition: opacity 0.12s ease, visibility 0.12s ease, transform 0.12s ease;
        transition-delay: 0.06s;
        transform: translateY(4px);
    }
    .batch-progress-table-wrap :global(.issue-tooltip-popup::after) {
        content: '';
        position: absolute;
        top: 100%;
        left: 16px;
        border: 6px solid transparent;
        border-top-color: #111827;
        margin-left: -6px;
    }
    .batch-progress-table-wrap :global(.issue-cell-wrap:hover .issue-tooltip-popup) {
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0s;
    }
    /* Updating overlay */
    .batch-progress-updating-overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.75);
        border-radius: var(--ds-radius-lg);
    }
    .batch-progress-updating-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ds-space-3);
    }
    .batch-progress-updating-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid var(--ds-color-neutral-true-200);
        border-top-color: var(--ds-color-primary-600);
        border-radius: 50%;
        animation: batch-progress-spin 0.7s linear infinite;
    }
    .batch-progress-updating-text {
        font-size: var(--ds-text-sm);
        font-weight: 500;
        color: var(--ds-color-neutral-true-700);
    }
    @keyframes batch-progress-spin {
        to { transform: rotate(360deg); }
    }
    /* Pagination bar: border-top, padding 8px 24px (Figma) */
    .batch-progress-table-wrap :global(.ds-datatable-pagination) {
        border-top: 1px solid var(--ds-border-default);
        padding: var(--ds-space-2) var(--ds-space-6);
        gap: var(--ds-space-2);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-600);
    }
    .batch-progress-table-wrap :global(.ds-pagination-details) {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }

    /* Footer: centered, single Close button (Figma: Blue light/600, 10px 18px, shadow xs) */
    .batch-progress-modal-footer {
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-4);
    }
</style>
