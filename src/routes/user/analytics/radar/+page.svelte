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
        // { id: 'summary-logs', label: 'Summary Logs' }, // Hidden for now, maybe use later
        { id: 'path-tracking', label: 'Path Tracking' }
    ];

    type RangeType = 'week' | 'month' | 'custom';

    $: sensors = data?.sensors ?? []; // First 10 from page server
    $: filterDeviceDropdownOptions = [
        { id: '', label: 'All' },
        ...deviceOptionsList.map((s) => ({ id: s.id, label: s.name }))
    ];
    $: activeTab = $page.url.searchParams.get('tab') || 'session-logs';
    /** When Summary Logs is hidden, treat its tab param as Session Logs */
    $: displayTab = activeTab === 'summary-logs' ? 'session-logs' : activeTab;
    $: searchParam = $page.url.searchParams.get('search') || '';
    $: deviceParam = $page.url.searchParams.get('sensorId') || '';
    $: rangeParam = ($page.url.searchParams.get('range') as RangeType) || 'week';
    $: startTimeParam = $page.url.searchParams.get('startTime') || '';
    $: endTimeParam = $page.url.searchParams.get('endTime') || '';

    $: effectiveRange = (rangeParam === 'week' || rangeParam === 'month' || rangeParam === 'custom') ? rangeParam : 'week';

    let searchValue: string = searchParam || '';
    let filterModalOpen = false;
    let filterDeviceId = deviceParam;
    let filterRangeType: RangeType = effectiveRange;
    let filterFrom = startTimeParam ? startTimeParam.slice(0, 10) : '';
    let filterTo = endTimeParam ? endTimeParam.slice(0, 10) : '';
    let deviceOptionsList: { id: string; name: string }[] = [];
    let deviceSearchLoading = false;

    /** Compute start/end for API from current range choice. Returns null only for custom when dates not set. */
    function getDateRangeForFilter(): { startTime: string; endTime: string } | null {
        const now = new Date();
        if (effectiveRange === 'week') {
            const start = new Date(now);
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            return { startTime: start.toISOString(), endTime: now.toISOString() };
        }
        if (effectiveRange === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            return { startTime: start.toISOString(), endTime: now.toISOString() };
        }
        if (effectiveRange === 'custom') {
            if (!startTimeParam || !endTimeParam) return null;
            return {
                startTime: startTimeParam.startsWith('2') ? startTimeParam : `${startTimeParam}T00:00:00.000Z`,
                endTime: endTimeParam.startsWith('2') ? endTimeParam : `${endTimeParam}T23:59:59.999Z`
            };
        }
        return null;
    }
    let sessionLogsData: Record<string, unknown>[] = [];
    let sessionLogsPagination: PaginationState = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 };
    // DataTable sorting uses column.id, not DB column names
    let sessionLogsSort: SortState = { field: 'startOn', direction: 'desc' };
    let sessionLogsLoading = false;
    let pathTrackingData: Record<string, unknown>[] = [];
    let pathTrackingPagination: PaginationState = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 };
    // DataTable sorting uses column.id, not DB column names
    let pathTrackingSort: SortState = { field: 'date', direction: 'desc' };
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

    function parseClickHouseDateTime(value: unknown): Date | null {
        if (value == null) return null;
        const s = String(value).trim();
        if (!s) return null;

        // ClickHouse commonly returns "YYYY-MM-DD HH:mm:ss" (not strict ISO; Safari may fail to parse it)
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
            const d = new Date(s.replace(' ', 'T') + 'Z'); // treat as UTC
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatDateTime(value: unknown): string {
        const d = parseClickHouseDateTime(value);
        if (!d) return '—';
        return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }

    function formatDateOnly(value: unknown): string {
        const d = parseClickHouseDateTime(value);
        if (!d) return '—';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    async function fetchSessionLogs(pageNum?: number) {
        if (!browser) return;
        const page = pageNum ?? parseInt($page.url.searchParams.get('page') || '1', 10);
        sessionLogsLoading = true;
        try {
            const range = getDateRangeForFilter();
            if (!range) {
                toast.error('Please select a date range in the filter (Current week, Current month, or Custom with From/To).');
                return;
            }
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(PAGE_SIZE));
            params.set('startTime', range.startTime);
            params.set('endTime', range.endTime);
            const sessionSortField =
                sessionLogsSort.field === 'sessionId' ? 'target_id'
                : sessionLogsSort.field === 'sensor' ? 'sensor_name'
                : sessionLogsSort.field === 'startOn' ? 'log_creation_time'
                : sessionLogsSort.field === 'duration' ? 'dwell_tracking_area_sec'
                : sessionLogsSort.field === 'timezone' ? 'timezone_label'
                : sessionLogsSort.field === 'proximityM' ? 'proximity_m'
                : 'log_creation_time';
            params.set('sort', sessionSortField);
            params.set('order', sessionLogsSort.direction || 'desc');
            if (searchValue?.trim()) params.set('search', searchValue.trim());
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
            const res = await fetch(`/api/sensor-data/radar_session?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch session logs');
            const rows = (json.data || []).map((r: Record<string, unknown>, i: number) => {
                const zoneJson = r.zone_dwell_times_json;
                const zoneStr =
                    zoneJson == null || zoneJson === '' || String(zoneJson).trim() === '{}'
                        ? '—'
                        : String(zoneJson).length > 80
                            ? String(zoneJson).slice(0, 77) + '…'
                            : String(zoneJson);
                return {
                    id: `sess-${i}-${r.target_id ?? r.log_creation_time ?? i}`,
                    sessionId: r.target_id ?? '—',
                    sensor: r.sensor_name ?? '—',
                    startOn: r.log_creation_time,
                    duration: r.dwell_tracking_area_sec != null ? formatDuration(Number(r.dwell_tracking_area_sec)) : '—',
                    zone: zoneStr,
                    timezone: r.timezone_label ?? '—',
                    proximityM: r.proximity_m != null ? Number(r.proximity_m).toFixed(2) : '—',
                    _raw: r
                };
            });
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
        const range = getDateRangeForFilter();
        if (!range) {
            toast.error('Please select a date range in the filter (Current week, Current month, or Custom with From/To).');
            return;
        }
        const page = pageNum ?? parseInt($page.url.searchParams.get('path_page') || '1', 10);
        pathTrackingLoading = true;
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(PAGE_SIZE));
            params.set('startTime', range.startTime);
            params.set('endTime', range.endTime);
            const pathSortField =
                pathTrackingSort.field === 'date' ? 'processed_at'
                : pathTrackingSort.field === 'targetId' ? 'target_id'
                : pathTrackingSort.field === 'xM' ? 'x_m'
                : pathTrackingSort.field === 'yM' ? 'y_m'
                : pathTrackingSort.field === 'sensor' ? 'sensor_name'
                : pathTrackingSort.field === 'timezone' ? 'timezone_label'
                : 'processed_at';
            params.set('sort', pathSortField);
            params.set('order', pathTrackingSort.direction || 'desc');
            if (searchValue?.trim()) params.set('search', searchValue.trim());
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
            const res = await fetch(`/api/sensor-data/radar_path?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch path tracking');
            const rows = (json.data || []).map((r: Record<string, unknown>, i: number) => ({
                id: `path-${i}-${r.target_id ?? r.log_creation_time ?? i}`,
                date: formatDateTime(r.processed_at ?? r.log_creation_time ?? ''),
                targetId: r.target_id ? String(r.target_id) : '—',
                xM: r.x_m != null ? Number(r.x_m).toFixed(2) : '—',
                yM: r.y_m != null ? Number(r.y_m).toFixed(2) : '—',
                deviceName: r.sensor_name ?? '—',
                timezone: r.timezone_label ?? '—',
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

    function openFilterModal() {
        filterRangeType = effectiveRange;
        filterFrom = startTimeParam ? startTimeParam.slice(0, 10) : '';
        filterTo = endTimeParam ? endTimeParam.slice(0, 10) : '';
        filterDeviceId = deviceParam;
        deviceOptionsList = [...sensors];
        filterModalOpen = true;
        fetchDeviceOptions('');
    }

    async function fetchDeviceOptions(search: string) {
        deviceSearchLoading = true;
        try {
            const params = new URLSearchParams();
            params.set('limit', '50');
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/user/sensors?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch devices');
            const list = (json.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
            deviceOptionsList = list.length > 0 ? list : [...sensors];
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load devices');
            deviceOptionsList = [...sensors];
        } finally {
            deviceSearchLoading = false;
        }
    }

    function applyFilter() {
        if (filterRangeType === 'custom') {
            if (!filterFrom || !filterTo) {
                toast.error('Please select both From and To dates for Custom range.');
                return;
            }
            setUrlParams({
                range: 'custom',
                startTime: `${filterFrom}T00:00:00.000Z`,
                endTime: `${filterTo}T23:59:59.999Z`,
                sensorId: filterDeviceId || null,
                page: null,
                path_page: null
            });
        } else {
            setUrlParams({
                range: filterRangeType,
                startTime: null,
                endTime: null,
                sensorId: filterDeviceId || null,
                page: null,
                path_page: null
            });
        }
        filterModalOpen = false;
        if (activeTab === 'session-logs') fetchSessionLogs();
        else if (activeTab === 'path-tracking') fetchPathTracking();
    }

    function clearFilter() {
        filterDeviceId = '';
        filterFrom = '';
        filterTo = '';
        filterRangeType = 'week';
        deviceOptionsList = [...sensors];
        setUrlParams({ range: 'week', sensorId: null, startTime: null, endTime: null, page: null, path_page: null });
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
        const range = getDateRangeForFilter();
        if (!range) {
            toast.error('Please select a date range in the filter (Current week, Current month, or Custom with From/To).');
            exporting = false;
            return;
        }
        exporting = true;
        try {
            const params = new URLSearchParams($page.url.searchParams);
            params.set('per_page', '10000');
            params.set('page', '1');
            params.set('startTime', range.startTime);
            params.set('endTime', range.endTime);
            if (filterDeviceId) params.set('sensorId', filterDeviceId);
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
                ? ['Session ID', 'Sensor', 'Start On', 'Duration (sec)', 'Zone', 'Timezone', 'Proximity (m)']
                : ['Date', 'Target ID', 'X (m)', 'Y (m)', 'Sensor', 'Timezone'];
            const keys = dataType === 'radar_session'
                ? ['target_id', 'sensor_name', 'log_creation_time', 'dwell_tracking_area_sec', 'zone_dwell_times_json', 'timezone_label', 'proximity_m']
                : ['processed_at', 'target_id', 'x_m', 'y_m', 'sensor_name', 'timezone_label'];
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
        { id: 'sessionId', header: 'Session ID', accessor: (r) => r.sessionId, type: 'text', sortable: true, width: '14%' },
        { id: 'sensor', header: 'Sensor', accessor: (r) => r.sensor, type: 'text', sortable: true, width: '14%' },
        { id: 'startOn', header: 'Start On', accessor: (r) => formatDateTime(r.startOn ?? ''), type: 'text', sortable: true, width: '14%' },
        { id: 'duration', header: 'Duration', accessor: (r) => r.duration, type: 'text', sortable: true, width: '12%' },
        { id: 'zone', header: 'Zone', accessor: (r) => r.zone ?? '—', type: 'text', width: '18%' },
        { id: 'timezone', header: 'Timezone', accessor: (r) => r.timezone ?? '—', type: 'text', sortable: true, width: '14%' },
        { id: 'proximityM', header: 'Proximity (m)', accessor: (r) => r.proximityM ?? '—', type: 'text', width: '14%' }
    ];

    // Summary Logs tab hidden for now, maybe use later
    // const summaryLogsColumns: ColumnDef[] = [
    //     { id: 'date', header: 'Date', accessor: (r) => r.date, type: 'text', width: '18%' },
    //     { id: 'deviceName', header: 'Device Name', accessor: (r) => r.deviceName, type: 'text', width: '22%' },
    //     { id: 'totalSessions', header: 'Total Sessions', accessor: (r) => r.totalSessions, type: 'text', width: '15%' },
    //     { id: 'totalEvents', header: 'Total Events', accessor: (r) => r.totalEvents, type: 'text', width: '15%' },
    //     { id: 'avgDuration', header: 'Avg Duration', accessor: (r) => r.avgDuration, type: 'text', width: '15%' },
    //     { id: 'peakHour', header: 'Peak Hour', accessor: (r) => r.peakHour, type: 'text', width: '15%' }
    // ];

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
                on:click={openFilterModal}
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
        activeTab={displayTab}
        type="underline"
        size="md"
        fullWidth={false}
        on:change={handleTabChange}
    />

    {#if displayTab === 'session-logs'}
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
    {:else if displayTab === 'path-tracking'}
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
            <label class="filter-label">Date range</label>
            <div class="filter-range-options" role="radiogroup" aria-label="Date range">
                <label class="filter-radio">
                    <input type="radio" name="range" value="week" bind:group={filterRangeType} />
                    <span>Current week</span>
                </label>
                <label class="filter-radio">
                    <input type="radio" name="range" value="month" bind:group={filterRangeType} />
                    <span>Current month</span>
                </label>
                <label class="filter-radio">
                    <input type="radio" name="range" value="custom" bind:group={filterRangeType} />
                    <span>Custom</span>
                </label>
            </div>
        </div>
        {#if filterRangeType === 'custom'}
            <div class="filter-row">
                <div class="filter-field">
                    <InputField type="date" label="From" bind:value={filterFrom} />
                </div>
                <span class="filter-sep" aria-hidden="true">–</span>
                <div class="filter-field">
                    <InputField type="date" label="To" bind:value={filterTo} />
                </div>
            </div>
        {/if}
        <div class="filter-field">
            <Dropdown
                label="Device"
                placeholder="Select device"
                options={filterDeviceDropdownOptions}
                bind:value={filterDeviceId}
                searchable={true}
                preferPlacement="top"
                clearable={true}
                disabled={deviceSearchLoading}
                helperText={deviceSearchLoading ? 'Loading devices…' : ''}
            />
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
    .filter-range-options {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }
    .filter-radio {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-primary);
        cursor: pointer;
    }
    .filter-radio input {
        margin: 0;
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
