<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import {
        Button,
        InputField,
        DataTable,
        TabGroup,
        Modal,
        Dropdown
    } from '$lib/design-system/components';
    import type { ColumnDef, SortState, PaginationState } from '$lib/design-system/components';
    import { Search, Filter, Download } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { toast } from '$lib/stores/alertToast';

    export let data: PageData;

    const PAGE_SIZE = 10;
    const TABS = [
        { id: 'session-logs', label: 'Session Logs' },
        { id: 'summary-logs', label: 'Summary Logs' },
        { id: 'path-tracking', label: 'Path Tracking' }
    ];

    $: sensors = data?.sensors ?? [];
    $: filterDeviceOptions = [{ id: '', label: 'All' }, ...sensors.map((s) => ({ id: s.id, label: s.name }))];
    $: activeTab = $page.url.searchParams.get('tab') || 'session-logs';
    $: searchParam = $page.url.searchParams.get('search') || '';
    $: deviceParam = $page.url.searchParams.get('sensorId') || '';
    $: startTimeParam = $page.url.searchParams.get('startTime') || '';
    $: endTimeParam = $page.url.searchParams.get('endTime') || '';

    let searchValue: string = searchParam || '';
    let filterModalOpen = false;
    let filterDeviceId = deviceParam;
    let filterFrom = startTimeParam ? startTimeParam.slice(0, 10) : '';
    let filterTo = endTimeParam ? endTimeParam.slice(0, 10) : '';
    let sessionLogsData: Record<string, unknown>[] = [];
    let sessionLogsPagination: PaginationState = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 };
    let sessionLogsSort: SortState = { field: 'log_creation_time', direction: 'desc' };
    let sessionLogsLoading = false;
    let pathTrackingData: Record<string, unknown>[] = [];
    let pathTrackingPagination: PaginationState = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 };
    let pathTrackingSort: SortState = { field: 'log_creation_time', direction: 'desc' };
    let pathTrackingLoading = false;
    let exporting = false;
    let previewPathRow: Record<string, unknown> | null = null;
    $: previewPathRaw = previewPathRow?._raw != null ? (previewPathRow._raw as Record<string, unknown>) : null;

    function setUrlParams(updates: Record<string, string | null>) {
        const url = new URL($page.url);
        for (const [k, v] of Object.entries(updates)) {
            if (v == null || v === '') url.searchParams.delete(k);
            else url.searchParams.set(k, v);
        }
        goto(url.toString(), { replaceState: true, noScroll: true });
    }

    function handleTabChange(e: CustomEvent<string>) {
        const tab = e.detail;
        setUrlParams({ tab, page: null });
    }

    function formatDuration(sec: number): string {
        if (sec < 60) return `${sec}s`;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return s ? `${m}m ${s}s` : `${m}m`;
    }

    function formatDateTime(iso: string): string {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }

    function formatDateOnly(iso: string): string {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    async function fetchSessionLogs(pageNum?: number) {
        if (!browser) return;
        const page = pageNum ?? parseInt($page.url.searchParams.get('page') || '1', 10);
        sessionLogsLoading = true;
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(PAGE_SIZE));
            params.set('sort', sessionLogsSort.field || 'log_creation_time');
            params.set('order', sessionLogsSort.direction || 'desc');
            if (searchValue?.trim()) params.set('search', searchValue.trim());
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
            if (startTimeParam) params.set('startTime', startTimeParam);
            if (endTimeParam) params.set('endTime', endTimeParam);
            const res = await fetch(`/api/sensor-data/radar_session?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch session logs');
            const rows = (json.data || []).map((r: Record<string, unknown>, i: number) => ({
                id: `sess-${i}-${r.target_id ?? r.log_creation_time ?? i}`,
                sessionId: r.target_id ?? '—',
                deviceName: r.sensor_name ?? '—',
                startOn: r.log_creation_time,
                duration: r.dwell_tracking_area_sec != null ? formatDuration(Number(r.dwell_tracking_area_sec)) : '—',
                zone: '—',
                events: '—',
                _raw: r
            }));
            sessionLogsData = rows;
            const p = json.pagination || {};
            sessionLogsPagination = {
                page: p.page ?? 1,
                pageSize: p.per_page ?? PAGE_SIZE,
                totalItems: p.total_records ?? 0,
                totalPages: p.total_pages ?? 0
            };
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load session logs');
            sessionLogsData = [];
        } finally {
            sessionLogsLoading = false;
        }
    }

    async function fetchPathTracking(pageNum?: number) {
        if (!browser) return;
        const page = pageNum ?? parseInt($page.url.searchParams.get('path_page') || '1', 10);
        pathTrackingLoading = true;
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(PAGE_SIZE));
            params.set('sort', pathTrackingSort.field || 'log_creation_time');
            params.set('order', pathTrackingSort.direction || 'desc');
            if (searchValue?.trim()) params.set('search', searchValue.trim());
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
            if (startTimeParam) params.set('startTime', startTimeParam);
            if (endTimeParam) params.set('endTime', endTimeParam);
            const res = await fetch(`/api/sensor-data/radar_path?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch path tracking');
            const rows = (json.data || []).map((r: Record<string, unknown>, i: number) => ({
                id: `path-${i}-${r.target_id ?? r.log_creation_time ?? i}`,
                date: formatDateOnly(String(r.log_creation_time ?? '')),
                targetId: r.target_id ? `${String(r.target_id).slice(0, 6)}...${String(r.target_id).slice(-4)}` : '—',
                xM: r.x_m != null ? Number(r.x_m).toFixed(2) : '—',
                yM: r.y_m != null ? Number(r.y_m).toFixed(2) : '—',
                deviceName: r.sensor_name ?? '—',
                timezone: r.timezone ?? '—',
                _raw: r
            }));
            pathTrackingData = rows;
            const p = json.pagination || {};
            pathTrackingPagination = {
                page: p.page ?? 1,
                pageSize: p.per_page ?? PAGE_SIZE,
                totalItems: p.total_records ?? 0,
                totalPages: p.total_pages ?? 0
            };
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load path tracking');
            pathTrackingData = [];
        } finally {
            pathTrackingLoading = false;
        }
    }

    $: if (browser && activeTab === 'session-logs') {
        fetchSessionLogs();
    }
    $: if (browser && activeTab === 'path-tracking') {
        fetchPathTracking();
    }

    function onSessionSort(e: CustomEvent<SortState>) {
        sessionLogsSort = e.detail;
        setUrlParams({ page: '1' });
        fetchSessionLogs();
    }
    function onSessionPageChange(pageNum: number) {
        setUrlParams({ page: String(pageNum) });
        fetchSessionLogs(pageNum);
    }
    function onPathSort(e: CustomEvent<SortState>) {
        pathTrackingSort = e.detail;
        setUrlParams({ path_page: '1' });
        fetchPathTracking();
    }
    function onPathPageChange(pageNum: number) {
        setUrlParams({ path_page: String(pageNum) });
        fetchPathTracking(pageNum);
    }

    function applySearch() {
        setUrlParams({ search: searchValue?.trim() || null, page: null, path_page: null });
        if (activeTab === 'session-logs') fetchSessionLogs();
        else if (activeTab === 'path-tracking') fetchPathTracking();
    }

    function applyFilter() {
        setUrlParams({
            sensorId: filterDeviceId || null,
            startTime: filterFrom ? `${filterFrom}T00:00:00.000Z` : null,
            endTime: filterTo ? `${filterTo}T23:59:59.999Z` : null,
            page: null,
            path_page: null
        });
        filterModalOpen = false;
        if (activeTab === 'session-logs') fetchSessionLogs();
        else if (activeTab === 'path-tracking') fetchPathTracking();
    }

    function clearFilter() {
        filterDeviceId = '';
        filterFrom = '';
        filterTo = '';
        setUrlParams({ sensorId: null, startTime: null, endTime: null, page: null, path_page: null });
        filterModalOpen = false;
        if (activeTab === 'session-logs') fetchSessionLogs();
        else if (activeTab === 'path-tracking') fetchPathTracking();
    }

    async function exportData() {
        if (!browser) return;
        const dataType = activeTab === 'session-logs' ? 'radar_session' : activeTab === 'path-tracking' ? 'radar_path' : null;
        if (!dataType) {
            toast.error('Summary Logs export is not available yet.');
            return;
        }
        exporting = true;
        try {
            const params = new URLSearchParams($page.url.searchParams);
            params.set('per_page', '10000');
            params.set('page', '1');
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
            if (startTimeParam) params.set('startTime', startTimeParam);
            if (endTimeParam) params.set('endTime', endTimeParam);
            if (searchValue?.trim()) params.set('search', searchValue.trim());
            const res = await fetch(`/api/sensor-data/${dataType}?${params}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Export failed');
            const rows = result.data || [];
            if (rows.length === 0) {
                toast.error('No data to export');
                return;
            }
            const headers = dataType === 'radar_session'
                ? ['Session ID', 'Device Name', 'Start On', 'Duration (sec)', 'Zone', 'Events']
                : ['Date', 'Target ID', 'X (m)', 'Y (m)', 'Device Name'];
            const keys = dataType === 'radar_session'
                ? ['target_id', 'sensor_name', 'log_creation_time', 'dwell_tracking_area_sec', 'zone_dwell_times_json', '']
                : ['log_creation_time', 'target_id', 'x_m', 'y_m', 'sensor_name'];
            const csvRows = [headers.map((h) => `"${h}"`).join(',')];
            for (const row of rows) {
                const values = keys.map((k) => {
                    if (!k) return '""';
                    const v = (row as Record<string, unknown>)[k];
                    if (v == null) return '""';
                    return `"${String(v).replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            }
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dataType}_export_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Export completed');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Export failed');
        } finally {
            exporting = false;
        }
    }

    const sessionLogsColumns: ColumnDef[] = [
        { id: 'sessionId', header: 'Session ID', accessor: (r) => r.sessionId, type: 'text', sortable: true, width: '18%' },
        { id: 'deviceName', header: 'Device Name', accessor: (r) => r.deviceName, type: 'text', sortable: true, width: '18%' },
        { id: 'startOn', header: 'Start On', accessor: (r) => formatDateTime(String(r.startOn ?? '')), type: 'text', sortable: true, width: '16%' },
        { id: 'duration', header: 'Duration', accessor: (r) => r.duration, type: 'text', width: '14%' },
        { id: 'zone', header: 'Zone', accessor: (r) => r.zone, type: 'text', width: '17%' },
        { id: 'events', header: 'Events', accessor: (r) => r.events, type: 'text', width: '17%' }
    ];

    const summaryLogsColumns: ColumnDef[] = [
        { id: 'date', header: 'Date', accessor: (r) => r.date, type: 'text', width: '18%' },
        { id: 'deviceName', header: 'Device Name', accessor: (r) => r.deviceName, type: 'text', width: '22%' },
        { id: 'totalSessions', header: 'Total Sessions', accessor: (r) => r.totalSessions, type: 'text', width: '15%' },
        { id: 'totalEvents', header: 'Total Events', accessor: (r) => r.totalEvents, type: 'text', width: '15%' },
        { id: 'avgDuration', header: 'Avg Duration', accessor: (r) => r.avgDuration, type: 'text', width: '15%' },
        { id: 'peakHour', header: 'Peak Hour', accessor: (r) => r.peakHour, type: 'text', width: '15%' }
    ];

    const pathTrackingColumns: ColumnDef[] = [
        { id: 'date', header: 'Date', accessor: (r) => r.date, type: 'text', sortable: true, width: '18%' },
        { id: 'targetId', header: 'Target ID', accessor: (r) => r.targetId, type: 'text', width: '16%' },
        { id: 'xM', header: 'X (m)', accessor: (r) => r.xM, type: 'text', width: '12%' },
        { id: 'yM', header: 'Y (m)', accessor: (r) => r.yM, type: 'text', width: '12%' },
        { id: 'sensor', header: 'Sensor', accessor: (r) => r.deviceName, type: 'text', width: '22%' },
        { id: 'timezone', header: 'Timezone', accessor: (r) => r.timezone ?? '—', type: 'text', width: '20%' }
    ];

    function handlePathRowClick(row: Record<string, unknown>) {
        previewPathRow = row;
    }

    $: currentPage = activeTab === 'session-logs'
        ? parseInt($page.url.searchParams.get('page') || '1', 10)
        : activeTab === 'path-tracking'
            ? parseInt($page.url.searchParams.get('path_page') || '1', 10)
            : 1;
</script>

<svelte:head>
    <title>Data - Data Realities</title>
</svelte:head>

<!-- Same structure as Devices, Templates, Sensors, Pin Rules: flex flex-col + action row with gap 16px, height 48px -->
<div class="data-page flex flex-col items-start" style="padding: 24px; gap: 16px;">
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div class="search-input-wrapper">
            <form role="search" on:submit|preventDefault={applySearch} style="height: 100%;">
                <InputField
                    type="search"
                    placeholder="Search by Device name"
                    bind:value={searchValue}
                    label=""
                    prefixIcon={true}
                >
                    <Search size={22} slot="prefix-icon" />
                </InputField>
            </form>
        </div>
        <div class="action-buttons">
            <Button
                variant="outline"
                color="gray"
                size="lg"
                icon={Filter}
                iconPosition="only"
                on:click={() => (filterModalOpen = true)}
            />
            <Button
                variant="filled"
                color="primary"
                size="lg"
                icon={Download}
                iconPosition="left"
                on:click={exportData}
                disabled={exporting || (activeTab === 'summary-logs')}
            >
                {exporting ? 'Exporting…' : 'Export Data'}
            </Button>
        </div>
    </div>

    <TabGroup
        tabs={TABS}
        activeTab={activeTab}
        type="underline"
        size="md"
        fullWidth={false}
        on:change={handleTabChange}
    />

    {#if activeTab === 'session-logs'}
        <div class="data-table-wrap session-logs">
            <DataTable
                columns={sessionLogsColumns}
                data={sessionLogsData}
                keyField="id"
                sort={sessionLogsSort}
                on:sort={onSessionSort}
                paginated={true}
                pagination={sessionLogsPagination}
                on:pageChange={(e) => onSessionPageChange(e.detail)}
                loading={sessionLogsLoading}
                emptyMessage="No session logs found"
            />
        </div>
    {:else if activeTab === 'summary-logs'}
        <div class="data-table-wrap">
            <DataTable
                columns={summaryLogsColumns}
                data={[]}
                keyField="id"
                paginated={false}
                emptyMessage="Summary logs will be available in a future release. Use Session Logs or Path Tracking for now."
            />
        </div>
    {:else if activeTab === 'path-tracking'}
        <div class="data-table-wrap">
            <DataTable
                columns={pathTrackingColumns}
                data={pathTrackingData}
                keyField="id"
                sort={pathTrackingSort}
                on:sort={onPathSort}
                paginated={true}
                pagination={pathTrackingPagination}
                on:pageChange={(e) => onPathPageChange(e.detail)}
                loading={pathTrackingLoading}
                emptyMessage="No path tracking data found"
                on:rowClick={(e) => handlePathRowClick(e.detail)}
            />
        </div>
    {/if}
</div>

<!-- Filter modal -->
<Modal
    open={filterModalOpen}
    title="Filter"
    on:close={() => (filterModalOpen = false)}
    size="sm"
    showFooter={false}
>
    <div class="filter-body">
        <div class="filter-field">
            <label class="filter-label" for="filter-device">Device</label>
            <Dropdown
                placeholder="All"
                options={filterDeviceOptions}
                bind:value={filterDeviceId}
                clearable={true}
            />
        </div>
        <div class="filter-row">
            <div class="filter-field">
                <InputField type="date" label="From" bind:value={filterFrom} />
            </div>
            <span class="filter-sep" aria-hidden="true">–</span>
            <div class="filter-field">
                <InputField type="date" label="To" bind:value={filterTo} />
            </div>
        </div>
        <div class="filter-actions">
            <Button variant="text" color="gray" size="md" on:click={clearFilter}>Clear All</Button>
            <Button variant="filled" color="primary" size="md" on:click={applyFilter}>Apply</Button>
        </div>
    </div>
</Modal>

<!-- Preview Path Tracking modal -->
<Modal
    open={previewPathRow != null}
    title="Preview Path Tracking"
    on:close={() => (previewPathRow = null)}
    size="lg"
>
    {#if previewPathRow && previewPathRaw}
        <div class="preview-modal-body">
            <!-- Visualization placeholder -->
            <div class="preview-visualization">
                <div class="preview-placeholder">
                    <span>Path Tracking Visualization</span>
                </div>
            </div>
            <!-- Info wrap -->
            <div class="preview-info-wrap">
                <div class="preview-timestamp">
                    {formatDateTime(String(previewPathRaw.log_creation_time ?? ''))}
                </div>
                <div class="preview-stats">
                    <span class="preview-stat">• Path Point: {previewPathRow.id ?? '—'}</span>
                    <span class="preview-stat">• Distance: {previewPathRaw.x_m != null && previewPathRaw.y_m != null ? Math.hypot(Number(previewPathRaw.x_m), Number(previewPathRaw.y_m)).toFixed(1) : '—'} m</span>
                    <span class="preview-stat">• Avg. Speed: — m/s</span>
                </div>
            </div>
        </div>
    {/if}
    <svelte:fragment slot="footer">
        <Button variant="filled" color="primary" size="lg" on:click={() => (previewPathRow = null)}>Close</Button>
    </svelte:fragment>
</Modal>

<style>
    .data-page {
        width: 100%;
        background: var(--ds-bg-secondary);
        min-height: 100%;
    }
    /* Search input takes available space, max 500px */
    .search-input-wrapper {
        flex: 1;
        max-width: 500px;
        height: 48px;
    }
    /* Action buttons aligned to the right */
    .action-buttons {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        margin-left: auto;
    }
    /* Table wrap - DataTable component already has border, radius, shadow */
    .data-table-wrap {
        width: 100%;
    }
    /* Session ID column: Blue link style (Figma) - first column in session logs table */
    .data-table-wrap.session-logs :global(tbody td:first-child) {
        color: var(--ds-color-blue-light-700);
    }
    .filter-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .filter-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }
    .filter-label {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-primary);
    }
    .filter-row {
        display: flex;
        align-items: flex-end;
        gap: var(--ds-space-2);
    }
    .filter-sep {
        color: var(--ds-text-tertiary);
        padding-bottom: var(--ds-space-2);
    }
    .filter-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--ds-space-3);
        margin-top: var(--ds-space-2);
    }
    /* Preview Modal - Figma specs */
    .preview-modal-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .preview-visualization {
        width: 100%;
        height: 400px;
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .preview-placeholder {
        color: var(--ds-text-tertiary);
        font: var(--ds-text-sm-regular);
    }
    .preview-info-wrap {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3);
        gap: var(--ds-space-2);
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-lg);
    }
    .preview-timestamp {
        width: 100%;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
    }
    .preview-stats {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: var(--ds-space-4);
        width: 100%;
    }
    .preview-stat {
        flex: 1;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
    }
</style>
