<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import {
        Button,
        Card,
        TabGroup,
        Badge,
        DataTable,
        ActionMenu,
        ConfirmModal
    } from '$lib/design-system/components';
    import type { ColumnDef, SortState } from '$lib/design-system/components';
    import {
        Info,
        PenLine,
        Wrench,
        Braces,
        Layers,
        Plus,
        Radio
    } from 'lucide-svelte';
    import RadarVisualEditor from '$lib/components/ui_components_sveltekit/radar/RadarVisualEditor.svelte';
    import { getZoneColors } from '$lib/components/ui_components_sveltekit/radar/zoneColors';
    import { formatTableDateTime } from '$lib/utils/format';
    import type { PageData } from './$types';
    import type { TemplateDetail, TemplateConfig } from './+page.server';
    import { toast } from '$lib/stores/alertToast';
    import { invalidate } from '$app/navigation';

    export let data: PageData;

    $: template = data.template as TemplateDetail | null;
    $: config = (template?.config ?? null) as TemplateConfig | null;
    $: trackingArea = config?.trackingArea ?? null;
    $: zones = config?.zones ?? [];

    let activeTab = 'configuration';
    let activeZoneTab = 'all';
    let showAddZoneModal = false;
    let showRemoveSensorModal = false;
    let sensorToRemove: { id: string; name: string } | null = null;
    let removeSensorLoading = false;

    const TABS = [
        { id: 'configuration', label: 'Configuration' },
        { id: 'assigned-sensor', label: 'Assigned Sensor' }
    ];

    $: zoneTabs = (() => {
        if (zones.length === 0) return [];
        const allTab = { id: 'all', label: 'All' };
        const zoneItems = zones.map((z, i) => ({
            id: z.id ?? `zone-${z.zoneNumber ?? i + 1}`,
            label: z.name ?? `Zone ${z.zoneNumber ?? i + 1}`
        }));
        return [allTab, ...zoneItems];
    })();

    $: trackingAreaDisplay = (() => {
        const ta = trackingArea;
        return {
            leftM: ta ? Math.abs(ta.startX) : 5,
            rightM: ta ? Math.abs(ta.endX) : 5,
            fwdStart: ta ? ta.startY : 0,
            fwdRange: ta ? ta.endY - ta.startY : 10,
            xMin: ta ? ta.startX : -5,
            xMax: ta ? ta.endX : 5,
            yMin: ta ? ta.startY : 0,
            yMax: ta ? ta.endY : 10
        };
    })();

    function formatAuditDate(d: string | null | undefined): string {
        if (!d) return '—';
        return formatTableDateTime(d);
    }

    // Assigned sensors from server (placeholder until API exists)
    interface AssignedSensorRow {
        id: string;
        name: string;
        location: string;
        status: string;
        lastSeen: string;
    }
    $: assignedSensors = (data.assignedSensors ?? []) as AssignedSensorRow[];
    $: serverAssignedMeta = data.assignedPagination ?? {};
    $: assignedPagination = {
        page: serverAssignedMeta.page ?? 1,
        pageSize: serverAssignedMeta.per_page ?? 10,
        totalItems: serverAssignedMeta.total_records ?? 0,
        totalPages: serverAssignedMeta.total_pages ?? 0
    };
    let assignedSort: SortState = { field: 'name', direction: 'desc' };

    function openRemoveSensorModal(row: AssignedSensorRow) {
        sensorToRemove = { id: row.id, name: row.name };
        showRemoveSensorModal = true;
    }

    function closeRemoveSensorModal() {
        showRemoveSensorModal = false;
        sensorToRemove = null;
    }

    async function confirmRemoveSensor() {
        if (!sensorToRemove) return;
        removeSensorLoading = true;
        try {
            const fd = new FormData();
            fd.set('sensorId', sensorToRemove.id);
            fd.set('templateId', template?.id ?? '');
            const res = await fetch('?/removeSensor', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result?.success === false) {
                toast.error(result?.error || 'Unable to remove sensor. Please try again!');
                return;
            }
            toast.success('Sensor removed successfully!');
            closeRemoveSensorModal();
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to remove sensor. Please try again!');
        } finally {
            removeSensorLoading = false;
        }
    }

    const assignedSensorColumns: ColumnDef<AssignedSensorRow>[] = [
        { id: 'name', header: 'Device Name', accessor: (r) => r.name, type: 'text', sortable: true, width: '200px' },
        { id: 'location', header: 'Location', accessor: (r) => r.location, type: 'text', width: '200px' },
        {
            id: 'status',
            header: 'Status',
            accessor: (r) => r.status,
            type: 'badge',
            sortable: true,
            statusColor: (v) => (v === 'Online' ? 'success' : 'gray'),
            showDot: () => true,
            width: '120px'
        },
        { id: 'lastSeen', header: 'Last Seen', accessor: (r) => r.lastSeen, type: 'text', sortable: true, width: '140px' },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '80px',
            getMenuActions: (row) => [
                { id: 'remove', label: 'Remove', color: 'danger', onClick: () => openRemoveSensorModal(row) }
            ]
        }
    ];
</script>

<svelte:head>
    <title>{template?.name ?? 'Template'} - Data Realities</title>
</svelte:head>

<div class="template-detail-wrap">
    <div class="template-detail-header">
        <div></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={() => goto(`/user/iot/templates/${template?.id ?? ''}/edit`)}
        >
            <PenLine size={20} slot="icon-left" />
            Edit Template
        </Button>
    </div>

    <!-- Template Information -->
    <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="info-card">
        <div slot="header" class="section-header">
            <div class="section-header-icon" aria-hidden="true">
                <Info class="icon-md" />
            </div>
            <div class="section-header-content">
                <h2 class="section-title-sm">Template Information</h2>
                <p class="section-subtitle">lorem</p>
            </div>
        </div>
        <div class="info-card-body">
            <div class="info-row">
                <span class="info-label">Template Name</span>
                <span class="info-value">{template?.name ?? '—'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Type</span>
                <span class="info-value">{template?.type ?? '—'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Description</span>
                <span class="info-value">{template?.description ?? '–'}</span>
            </div>
            <div class="info-audit">
                <p class="info-audit-line">Created by {template?.createdBy ?? '—'} at {formatAuditDate(template?.createdAt)}</p>
                <p class="info-audit-line">Last updated by {template?.updatedBy ?? '—'} at {formatAuditDate(template?.updatedAt)}</p>
            </div>
        </div>
    </Card>

    <TabGroup
        tabs={TABS}
        activeTab={activeTab}
        type="button"
        size="md"
        fullWidth={false}
        on:change={(e) => (activeTab = e.detail)}
    />

    {#if activeTab === 'configuration'}
        <div class="config-tab-sections">
            <div class="config-column">
                <!-- Visual Editor -->
                <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="config-card">
                    <div slot="header" class="section-header">
                        <div class="section-header-icon" aria-hidden="true">
                            <Wrench class="icon-md" />
                        </div>
                        <div class="section-header-content">
                            <h2 class="section-title-sm">Visual Editor</h2>
                            <p class="section-subtitle">Drag and resize zone within tracking area.</p>
                        </div>
                    </div>
                    <div class="config-card-body">
                        {#if trackingArea}
                            <div class="visual-editor-wrap">
                                <RadarVisualEditor
                                    arena={trackingArea}
                                    zones={zones}
                                    maxZones={5}
                                    readonly={true}
                                />
                            </div>
                        {:else}
                            <div class="visual-editor-placeholder">
                                <p class="config-placeholder-text">No tracking area defined.</p>
                            </div>
                        {/if}
                    </div>
                </Card>
                <!-- Device Settings -->
                <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="config-card">
                    <div slot="header" class="section-header">
                        <div class="section-header-icon" aria-hidden="true">
                            <Braces class="icon-md" />
                        </div>
                        <div class="section-header-content">
                            <h2 class="section-title-sm">Device Settings</h2>
                            <p class="section-subtitle">Configuration sensor behavior and data collection.</p>
                        </div>
                    </div>
                    <div class="config-card-body">
                        <div class="config-label-value-list">
                            <div class="config-label-value-row">
                                <span class="config-label">Device Mode</span>
                                <span class="config-value">Live Preview</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Timezone</span>
                                <span class="config-value">Ho Chi Minh (UTC+7)</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Path Tracking</span>
                                <span class="config-value">Enable</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Data Reporting Interval</span>
                                <span class="config-value">100 ms</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
            <div class="config-column">
                <!-- Tracking Area Configuration -->
                <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="config-card">
                    <div slot="header" class="section-header">
                        <div class="section-header-icon" aria-hidden="true">
                            <Braces class="icon-md" />
                        </div>
                        <div class="section-header-content">
                            <h2 class="section-title-sm">Tracking Area Configuration</h2>
                            <p class="section-subtitle">Define detection boundaries relative to sensor position.</p>
                        </div>
                    </div>
                    <div class="config-card-body">
                        <div class="config-label-value-list config-tracking-rows">
                            <div class="config-label-value-row">
                                <span class="config-label">Left Range</span>
                                <span class="config-value">{trackingAreaDisplay.leftM} m</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Right Range</span>
                                <span class="config-value">{trackingAreaDisplay.rightM} m</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Forward Start Offset</span>
                                <span class="config-value">{trackingAreaDisplay.fwdStart} m</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Forward Range</span>
                                <span class="config-value">{trackingAreaDisplay.fwdRange} m</span>
                            </div>
                        </div>
                        <div class="config-computed-box">
                            <div class="config-computed-title">Computed Coordinates (Sensor-Relative)</div>
                            <div class="config-computed-row">
                                <span class="config-computed-cell"><span class="config-computed-label">x Min:</span> <span class="config-computed-value">{trackingAreaDisplay.xMin} m</span></span>
                                <span class="config-computed-cell"><span class="config-computed-label">x Max:</span> <span class="config-computed-value">{trackingAreaDisplay.xMax} m</span></span>
                            </div>
                            <div class="config-computed-row">
                                <span class="config-computed-cell"><span class="config-computed-label">y Min:</span> <span class="config-computed-value">{trackingAreaDisplay.yMin} m</span></span>
                                <span class="config-computed-cell"><span class="config-computed-label">y Max:</span> <span class="config-computed-value">{trackingAreaDisplay.yMax} m</span></span>
                            </div>
                        </div>
                    </div>
                </Card>
                <!-- Zones Configuration -->
                <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="config-card">
                    <div slot="header" class="section-header section-header-with-action">
                        <div class="section-header-icon" aria-hidden="true">
                            <Layers class="icon-md" />
                        </div>
                        <div class="section-header-content">
                            <h2 class="section-title-sm">Zones Configuration</h2>
                            <p class="section-subtitle">Configuration up to 5 custom zones.</p>
                        </div>
                        <Button
                            variant="outline"
                            color="primary"
                            size="sm"
                            iconLeft={true}
                            disabled={zones.length >= 5}
                            on:click={() => (showAddZoneModal = true)}
                        >
                            <Plus class="icon-sm" slot="icon-left" />
                            Add Zone
                        </Button>
                    </div>
                    <div class="config-card-body">
                        {#if zones.length > 0}
                            <TabGroup
                                tabs={zoneTabs}
                                activeTab={activeZoneTab}
                                type="button"
                                size="sm"
                                fullWidth={false}
                                on:change={(e) => (activeZoneTab = e.detail)}
                            />
                            <div class="config-zone-tab-content">
                                <div class="config-zone-list">
                                    {#each zones as zone, zoneIndex}
                                        {@const zoneColors = getZoneColors(zone.zoneNumber ?? zoneIndex + 1)}
                                        {@const active = zone.active !== false}
                                        <div class="config-zone-row">
                                            <div
                                                class="config-zone-color"
                                                style="background: {zoneColors.fill}; border-color: {zoneColors.border};"
                                            ></div>
                                            <div class="config-zone-info">
                                                <span class="config-zone-name">{zone.name || `Zone ${zone.zoneNumber}`}</span>
                                                <span class="config-zone-detail">Position: ({zone.startX}, {zone.startY}) | Size: {(zone.endX - zone.startX).toFixed(1)} × {(zone.endY - zone.startY).toFixed(1)} m</span>
                                            </div>
                                            <Badge variant="filled" color={active ? 'success' : 'gray'} size="sm" label={active ? 'Active' : 'Inactive'} />
                                            <ActionMenu
                                                triggerIcon="dots-vertical"
                                                align="right"
                                                width="auto"
                                                items={[
                                                    { id: 'edit', label: 'Edit' },
                                                    { id: 'delete', label: 'Delete', destructive: true }
                                                ]}
                                                on:select={() => {}}
                                            />
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <div class="config-empty-zones">
                                <p class="config-placeholder-text">No zones configured.</p>
                                <Button variant="outline" color="primary" size="sm" on:click={() => (showAddZoneModal = true)}>
                                    Add Zone
                                </Button>
                            </div>
                        {/if}
                    </div>
                </Card>
            </div>
        </div>
    {:else if activeTab === 'assigned-sensor'}
        <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="assigned-card">
            <div slot="header" class="section-header">
                <div class="section-header-icon" aria-hidden="true">
                    <Radio class="icon-md" />
                </div>
                <div class="section-header-content">
                    <h2 class="section-title-sm">Assigned Sensor</h2>
                    <p class="section-subtitle">lorem</p>
                </div>
            </div>
            <div class="assigned-card-body">
                <DataTable
                    columns={assignedSensorColumns}
                    data={assignedSensors}
                    keyField="id"
                    selectable={false}
                    sortable={true}
                    bind:sort={assignedSort}
                    paginated={true}
                    pagination={assignedPagination}
                    loading={false}
                    emptyMessage="No assigned sensors"
                />
            </div>
        </Card>
    {/if}
</div>

<!-- Remove Sensor ConfirmModal -->
<ConfirmModal
    open={showRemoveSensorModal}
    title="Remove Sensor"
    description="Are you sure you want to remove this sensor?"
    cancelText="Cancel"
    confirmText="Remove"
    type="warning"
    confirmLoading={removeSensorLoading}
    confirmDisabled={removeSensorLoading}
    on:close={closeRemoveSensorModal}
    on:confirm={confirmRemoveSensor}
/>

<style>
    .template-detail-wrap {
        padding: var(--ds-space-6);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
    }

    .template-detail-header {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        width: 100%;
    }

    .section-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .section-header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: var(--ds-space-3);
        border-radius: var(--ds-radius-lg);
        color: var(--ds-color-neutral-true-400);
    }

    .section-header-icon :global(svg) {
        width: 20px;
        height: 20px;
    }

    .section-header-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
    }

    .section-header-with-action .section-header-content {
        flex: 1;
        min-width: 0;
    }

    .section-title-sm {
        margin: 0;
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
    }

    .section-subtitle {
        margin: 0;
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-card-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .info-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
    }

    .info-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-value {
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
        text-align: right;
    }

    .info-audit {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        margin-top: var(--ds-space-2);
    }

    .info-audit-line {
        margin: 0;
        font: var(--ds-text-xs-regular);
        color: var(--ds-color-neutral-true-600);
    }

    .config-tab-sections {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-4);
        width: 100%;
    }

    .config-column {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        min-width: 0;
    }

    .config-card :global(.card-header) {
        padding: 0;
        border-bottom-color: var(--ds-border-subtle);
    }

    .config-card :global(.card-body) {
        padding: var(--ds-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .config-card-body {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .visual-editor-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        min-width: 0;
    }

    .visual-editor-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--ds-space-4);
        min-height: 200px;
        background: var(--ds-bg-tertiary);
        border-radius: var(--ds-radius-lg);
    }

    .config-placeholder-text {
        margin: 0;
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .config-label-value-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .config-label-value-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
    }

    .config-label {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: #525252;
    }

    .config-value {
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        font-weight: 500;
        line-height: 24px;
        color: #141414;
        text-align: right;
    }

    .config-tracking-rows {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px 16px;
        width: 100%;
    }

    .config-tracking-rows .config-label-value-row {
        flex: 1 1 auto;
    }

    .config-computed-box {
        background: #FAFAFA;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .config-computed-title {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
        color: #292929;
    }

    .config-computed-row {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
    }

    .config-computed-cell {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: #737373;
    }

    .config-computed-label,
    .config-computed-value {
        color: #737373;
    }

    .config-computed-value {
        text-align: right;
        flex-shrink: 0;
    }

    .config-zone-tab-content {
        margin-top: var(--ds-space-4);
    }

    .config-zone-list {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .config-zone-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        min-height: 52px;
    }

    .config-zone-color {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 8px;
        border: 1px solid var(--ds-color-primary-700, #004EEB);
    }

    .config-zone-info {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex: 1;
        min-width: 0;
    }

    .config-zone-name {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        color: #141414;
    }

    .config-zone-detail {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: #737373;
    }

    .config-empty-zones {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ds-space-4);
        padding: var(--ds-space-4);
    }

    .assigned-card-body {
        padding: var(--ds-space-4);
        min-width: 0;
    }

    .icon-sm {
        width: 20px;
        height: 20px;
    }

    .icon-md {
        width: 20px;
        height: 20px;
    }
</style>
