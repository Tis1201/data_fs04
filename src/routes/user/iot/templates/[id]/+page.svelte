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
        Radio,
        ShieldAlert,
        BellRing
    } from 'lucide-svelte';
    import RadarVisualEditor from '$lib/components/ui_components_sveltekit/radar/RadarVisualEditor.svelte';
    import AddZoneModal from '$lib/components/ui_components_sveltekit/radar/AddZoneModal.svelte';
    import EditZoneModal from '$lib/components/ui_components_sveltekit/radar/EditZoneModal.svelte';
    import EditTemplateModal from '$lib/components/ui_components_sveltekit/templates/EditTemplateModal.svelte';
    import { getZoneColors } from '$lib/components/ui_components_sveltekit/radar/zoneColors';
    import { RADAR_CONSTRAINTS } from '$lib/components/ui_components_sveltekit/radar/constraints';
    import { formatTableDateTime } from '$lib/utils/format';
    import type { PageData } from './$types';
    import type { TemplateDetail, TemplateConfig, TemplateAlertSettings } from './+page.server';
    import { toast } from '$lib/stores/alertToast';
    import { invalidate } from '$app/navigation';
    import { deserialize } from '$app/forms';

    function parseActionResult(result: ReturnType<typeof deserialize>): Record<string, unknown> {
        if (result.type === 'success' && result.data) {
            return result.data as Record<string, unknown>;
        }
        if (result.type === 'failure' && result.data) {
            return result.data as Record<string, unknown>;
        }
        return {};
    }

    export let data: PageData;

    $: template = data.template as TemplateDetail | null;
    $: config = (template?.config ?? null) as TemplateConfig | null;
    $: trackingArea = config?.trackingArea ?? null;
    $: zones = config?.zones ?? [];
    $: alertSettings = (config?.alertSettings ?? null) as TemplateAlertSettings | null;

    // Zone data interface (same as Sensor Detail)
    interface ZoneData {
        id?: string;
        name: string;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        color?: string;
        zoneNumber?: number;
        active?: boolean;
        // Support both formats
        xMin?: number;
        xMax?: number;
        yMin?: number;
        yMax?: number;
    }

    interface CoordinateBounds {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    }

    // Editor state - mutable copies for visual editor
    let editorZonesValue: ZoneData[] = [];
    let editorArenaValue: CoordinateBounds | null = null;
    let zonesInitialized = false;
    let arenaInitialized = false;
    let configSaving = false;

    // Initialize editor values from config
    $: if (config?.zones && !zonesInitialized) {
        editorZonesValue = config.zones.map((z, i) => ({
            id: z.id,
            name: z.name ?? `Zone ${z.zoneNumber ?? i + 1}`,
            startX: z.startX ?? z.xMin ?? 0,
            startY: z.startY ?? z.yMin ?? 0,
            endX: z.endX ?? z.xMax ?? 0,
            endY: z.endY ?? z.yMax ?? 0,
            color: z.color,
            zoneNumber: z.zoneNumber ?? i + 1,
            active: z.active ?? true
        }));
        zonesInitialized = true;
    }

    $: if (!arenaInitialized) {
        const ta = trackingArea;
        editorArenaValue = ta
            ? {
                startX: ta.startX ?? ta.xMin ?? -4,
                startY: ta.startY ?? ta.yMin ?? 0,
                endX: ta.endX ?? ta.xMax ?? 4,
                endY: ta.endY ?? ta.yMax ?? 7
            }
            : {
                startX: RADAR_CONSTRAINTS.X_MIN,
                startY: RADAR_CONSTRAINTS.Y_MIN,
                endX: RADAR_CONSTRAINTS.X_MAX,
                endY: RADAR_CONSTRAINTS.Y_MAX
            };
        arenaInitialized = true;
    }

    // Reinitialize from config (after save)
    function reinitializeFromConfig(): void {
        if (config?.zones) {
            editorZonesValue = config.zones.map((z, i) => ({
                id: z.id,
                name: z.name ?? `Zone ${z.zoneNumber ?? i + 1}`,
                startX: z.startX ?? z.xMin ?? 0,
                startY: z.startY ?? z.yMin ?? 0,
                endX: z.endX ?? z.xMax ?? 0,
                endY: z.endY ?? z.yMax ?? 0,
                color: z.color,
                zoneNumber: z.zoneNumber ?? i + 1,
                active: z.active ?? true
            }));
        }
        if (trackingArea) {
            editorArenaValue = {
                startX: trackingArea.startX ?? trackingArea.xMin ?? -4,
                startY: trackingArea.startY ?? trackingArea.yMin ?? 0,
                endX: trackingArea.endX ?? trackingArea.xMax ?? 4,
                endY: trackingArea.endY ?? trackingArea.yMax ?? 7
            };
        }
    }

    // Handle arena change from visual editor
    function handleArenaChange(event: CustomEvent<CoordinateBounds>): void {
        editorArenaValue = event.detail;
    }

    // Handle zones change from visual editor
    function handleZonesChange(event: CustomEvent<ZoneData[]>): void {
        editorZonesValue = event.detail;
    }

    let activeTab = 'configuration';
    let activeZoneTab = 'all';
    let showAddZoneModal = false;
    let showEditZoneModal = false;
    let zoneToEdit: ZoneData | null = null;
    let showZoneConfirmModal = false;
    let zoneConfirmKind: 'deactivate' | 'activate' | 'delete' | null = null;
    let pendingZoneId = '';
    let pendingZoneName = '';
    let showRemoveSensorModal = false;
    let sensorToRemove: { id: string; name: string } | null = null;
    let removeSensorLoading = false;
    let showEditModal = false;
    let editSaving = false;

    // Prepare template data for EditTemplateModal
    interface EditTemplateData {
        id: string;
        name: string;
        type: 'Alert' | 'Configuration';
        description?: string | null;
        config?: TemplateConfig | null;
        assignedSensors?: { id: string; name: string; mac?: string }[];
    }
    
    let editTemplateData: EditTemplateData | null = null;
    $: {
        if (template && assignedSensors) {
            editTemplateData = {
                id: template.id,
                name: template.name,
                type: template.type as 'Alert' | 'Configuration',
                description: template.description,
                config: config,
                assignedSensors: assignedSensors.map(s => ({
                    id: s.id,
                    name: s.name,
                    mac: undefined
                }))
            };
        } else {
            editTemplateData = null;
        }
    }

    // Available sensors for edit modal (all sensors from the account)
    $: availableSensorsForEdit = (data.availableSensors ?? []) as { id: string; name: string; mac?: string }[];

    function openEditModal() {
        showEditModal = true;
    }

    function closeEditModal() {
        showEditModal = false;
    }

    // Zone tabs for Zones Configuration: All + one per zone
    $: zoneTabs = (() => {
        const zoneList = editorZonesValue;
        if (zoneList.length === 0) return [];
        const allTab = { id: 'all', label: 'All' };
        const zoneItems = zoneList.map((z) => ({
            id: z.id ?? `zone-${z.zoneNumber ?? 0}`,
            label: z.name ?? `Zone ${z.zoneNumber ?? 0}`
        }));
        return [allTab, ...zoneItems];
    })();

    // Next zone number for Add Zone modal
    $: nextZoneNumberForAdd = (() => {
        const existing = editorZonesValue.map((z) => z.zoneNumber || 0);
        if (existing.length === 0) return 1;
        return Math.max(...existing) + 1;
    })();

    // Tracking area dimensions for Add Zone modal
    $: addZoneTrackingArea = (() => {
        const a = editorArenaValue;
        if (a) return { width: Math.abs(a.endX - a.startX), height: Math.abs(a.endY - a.startY) };
        return { width: 8, height: 7 };
    })();

    // Build ActionMenu items for a zone row
    function getZoneMenuItems(active: boolean): Array<{ id: string; label: string; destructive?: boolean }> {
        return [
            { id: 'edit', label: 'Edit' },
            { id: active ? 'deactivate' : 'activate', label: active ? 'Deactivate' : 'Activate' },
            { id: 'delete', label: 'Delete', destructive: true }
        ];
    }

    // Handle zone action menu selection
    function handleZoneAction(zoneId: string, zoneName: string, action: string, active: boolean): void {
        if (action === 'edit') {
            const zone = editorZonesValue.find((z) => (z.id ?? `zone-${z.zoneNumber}`) === zoneId);
            if (zone) {
                zoneToEdit = zone;
                showEditZoneModal = true;
            }
        } else if (action === 'deactivate' || action === 'activate') {
            pendingZoneId = zoneId;
            pendingZoneName = zoneName;
            zoneConfirmKind = action === 'deactivate' ? 'deactivate' : 'activate';
            showZoneConfirmModal = true;
        } else if (action === 'delete') {
            pendingZoneId = zoneId;
            pendingZoneName = zoneName;
            zoneConfirmKind = 'delete';
            showZoneConfirmModal = true;
        }
    }

    // Add a new zone from Add Zone modal
    function handleAddZoneFromModal(zone: {
        name: string;
        zoneNumber: number;
        color: string;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        active: boolean;
    }): void {
        const newZone: ZoneData = {
            id: `zone-${zone.zoneNumber}`,
            name: zone.name,
            zoneNumber: zone.zoneNumber,
            color: zone.color,
            startX: zone.startX,
            startY: zone.startY,
            endX: zone.endX,
            endY: zone.endY,
            active: zone.active
        };
        editorZonesValue = [...editorZonesValue, newZone];
        showAddZoneModal = false;
        toast.success('Zone added! Click "Save Configuration" to persist changes.');
    }

    // Save zone from Edit Zone modal
    function handleEditZoneSave(updated: {
        id?: string;
        name: string;
        zoneNumber: number;
        color: string;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        active: boolean;
    }): void {
        const zoneId = zoneToEdit?.id ?? (zoneToEdit != null ? `zone-${zoneToEdit.zoneNumber}` : null);
        if (zoneId == null) return;

        editorZonesValue = editorZonesValue.map((z) => {
            const key = z.id ?? `zone-${z.zoneNumber}`;
            if (key === zoneId) {
                return {
                    ...z,
                    name: updated.name,
                    color: updated.color,
                    startX: updated.startX,
                    startY: updated.startY,
                    endX: updated.endX,
                    endY: updated.endY,
                    active: updated.active
                };
            }
            return z;
        });
        showEditZoneModal = false;
        zoneToEdit = null;
        toast.success('Zone updated! Click "Save Configuration" to persist changes.');
    }

    // Confirm zone action (deactivate/activate/delete)
    function confirmZoneAction(): void {
        if (zoneConfirmKind === 'delete') {
            editorZonesValue = editorZonesValue.filter((z) => (z.id ?? `zone-${z.zoneNumber}`) !== pendingZoneId);
            activeZoneTab = 'all';
            toast.success('Zone deleted! Click "Save Configuration" to persist changes.');
        } else if (zoneConfirmKind === 'deactivate' || zoneConfirmKind === 'activate') {
            editorZonesValue = editorZonesValue.map((z) => {
                const key = z.id ?? `zone-${z.zoneNumber}`;
                if (key === pendingZoneId) {
                    return { ...z, active: zoneConfirmKind === 'activate' };
                }
                return z;
            });
            toast.success(`Zone ${zoneConfirmKind === 'activate' ? 'activated' : 'deactivated'}! Click "Save Configuration" to persist changes.`);
        }
        showZoneConfirmModal = false;
        zoneConfirmKind = null;
        pendingZoneId = '';
        pendingZoneName = '';
    }

    // Save configuration (tracking area + zones) to database
    async function saveConfiguration(): Promise<void> {
        if (!template) return;
        configSaving = true;
        try {
            const fd = new FormData();
            fd.set('id', template.id);
            fd.set('trackingArea', JSON.stringify(editorArenaValue ? {
                xMin: editorArenaValue.startX,
                xMax: editorArenaValue.endX,
                yMin: editorArenaValue.startY,
                yMax: editorArenaValue.endY,
                startX: editorArenaValue.startX,
                startY: editorArenaValue.startY,
                endX: editorArenaValue.endX,
                endY: editorArenaValue.endY
            } : null));
            fd.set('zones', JSON.stringify(editorZonesValue.map((z) => ({
                id: z.id,
                name: z.name,
                zoneNumber: z.zoneNumber,
                startX: z.startX,
                startY: z.startY,
                endX: z.endX,
                endY: z.endY,
                xMin: z.startX,
                xMax: z.endX,
                yMin: z.startY,
                yMax: z.endY,
                color: z.color,
                active: z.active
            }))));

            const res = await fetch('?/saveConfig', { method: 'POST', body: fd });
            const result = parseActionResult(deserialize(await res.text()));
            if (result?.success === false) {
                toast.error((result?.error as string) || 'Unable to save configuration. Please try again!');
                return;
            }
            toast.success('Configuration saved successfully!');
            await invalidate('app:userTemplates');
            zonesInitialized = false;
            arenaInitialized = false;
        } catch {
            toast.error('Unable to save configuration. Please try again!');
        } finally {
            configSaving = false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function handleSaveTemplate(event: CustomEvent<any>) {
        editSaving = true;
        try {
            const detail = event.detail;
            const fd = new FormData();
            fd.set('id', detail.id);
            fd.set('name', detail.name);
            fd.set('description', detail.description);
            fd.set('trackingArea', JSON.stringify({
                xMin: parseFloat(detail.trackingArea.xMin) || 0,
                xMax: parseFloat(detail.trackingArea.xMax) || 0,
                yMin: parseFloat(detail.trackingArea.yMin) || 0,
                yMax: parseFloat(detail.trackingArea.yMax) || 0
            }));
            // Preserve all zone data including position
            fd.set('zones', JSON.stringify(detail.zones.map((z: ZoneData) => ({
                id: z.id,
                name: z.name,
                active: z.active,
                zoneNumber: z.zoneNumber,
                startX: z.startX ?? z.xMin,
                startY: z.startY ?? z.yMin,
                endX: z.endX ?? z.xMax,
                endY: z.endY ?? z.yMax,
                xMin: z.xMin ?? z.startX,
                xMax: z.xMax ?? z.endX,
                yMin: z.yMin ?? z.startY,
                yMax: z.yMax ?? z.endY,
                color: z.color
            }))));
            fd.set('deviceSettings', JSON.stringify(detail.deviceSettings));
            fd.set('selectedSensors', JSON.stringify(detail.selectedSensors));
            // Send alertSettings whenever the modal included it (EditTemplateModal sends it for Alert type)
            if (detail.alertSettings != null) {
                fd.set('alertSettings', JSON.stringify(detail.alertSettings));
            }

            const res = await fetch('?/update', { method: 'POST', body: fd });
            const result = parseActionResult(deserialize(await res.text()));
            if (result?.success === false) {
                toast.error((result?.error as string) || 'Unable to save template. Please try again!');
                return;
            }
            toast.success('Template updated successfully!');
            closeEditModal();
            await invalidate('app:userTemplates');
            zonesInitialized = false;
            arenaInitialized = false;
        } catch {
            toast.error('Unable to save template. Please try again!');
        } finally {
            editSaving = false;
        }
    }

    const TABS = [
        { id: 'configuration', label: 'Configuration' },
        { id: 'assigned-sensor', label: 'Assigned Sensor' }
    ];

    // Device settings from config
    $: deviceSettings = config?.deviceSettings ?? null;

    /** Alert tab: display values from config.alertSettings (same shape as Sensor detail Alert tab). */
    $: alertDisplay = (() => {
        const as = alertSettings ?? {};
        const so = as.sensorOffline ?? { enabled: false, threshold: '5', unit: 'minutes' };
        const nd = as.noData ?? { enabled: false, threshold: '30', unit: 'minutes' };
        const dt = as.dwellTime ?? { enabled: false, zoneId: '', threshold: '120' };
        const zoneName = zones?.find((z) => (z.id ?? `zone-${z.zoneNumber}`) === dt.zoneId)?.name ?? dt.zoneId ?? '—';
        const em = as.email ?? { enabled: false, address: '' };
        const wh = as.webhook ?? { enabled: false, url: '' };
        return {
            sensorOffline: { enabled: so.enabled, text: so.enabled ? 'Enable' : 'Disable', threshold: `${so.threshold ?? '5'} ${so.unit ?? 'minutes'}` },
            noData: { enabled: nd.enabled, text: nd.enabled ? 'Enable' : 'Disable', threshold: `${nd.threshold ?? '30'} ${nd.unit ?? 'minutes'}` },
            dwellTime: { enabled: dt.enabled, text: dt.enabled ? 'Enable' : 'Disable', zoneLabel: zoneName, threshold: `${dt.threshold ?? '120'} seconds` },
            email: { enabled: em.enabled, text: em.enabled ? 'Enable' : 'Disable', address: em.address ?? '—' },
            webhook: { enabled: wh.enabled, text: wh.enabled ? 'Enable' : 'Disable', url: wh.url ?? '—' }
        };
    })();

    $: trackingAreaDisplay = (() => {
        const ta = editorArenaValue;
        if (!ta) {
            return {
                leftM: 0,
                rightM: 0,
                fwdStart: 0,
                fwdRange: 0,
                xMin: 0,
                xMax: 0,
                yMin: 0,
                yMax: 0
            };
        }
        const xMin = ta.startX;
        const xMax = ta.endX;
        const yMin = ta.startY;
        const yMax = ta.endY;
        return {
            leftM: Math.abs(xMin),
            rightM: Math.abs(xMax),
            fwdStart: yMin,
            fwdRange: yMax - yMin,
            xMin,
            xMax,
            yMin,
            yMax
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
            const result = parseActionResult(deserialize(await res.text()));
            if (result?.success === false) {
                toast.error((result?.error as string) || 'Unable to remove sensor. Please try again!');
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
        { id: 'lastSeen', header: 'Last ping', accessor: (r) => r.lastSeen, type: 'text', sortable: true, width: '140px' },
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
            on:click={openEditModal}
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
                <p class="section-subtitle">View and manage template details</p>
            </div>
        </div>
        <div class="info-card-body">
            <!-- Row 1: Template Name + Type -->
            <div class="info-grid-row">
                <div class="info-field">
                    <span class="info-label">Template Name</span>
                    <span class="info-value">{template?.name ?? '—'}</span>
                </div>
                <div class="info-field">
                    <span class="info-label">Type</span>
                    <span class="info-value">{template?.type ? `${template.type} Template` : '—'}</span>
                </div>
            </div>
            <!-- Row 2: Description -->
            <div class="info-field info-field-full">
                <span class="info-label">Description</span>
                <span class="info-value">{template?.description || '–'}</span>
            </div>
            <!-- Divider -->
            <div class="info-divider"></div>
            <!-- Audit info -->
            <div class="info-audit">
                <p class="info-audit-line">Created by {template?.createdBy ?? '—'} at {formatAuditDate(template?.createdAt)}</p>
                <p class="info-audit-line">Last updated by {template?.updatedBy ?? '—'} at {formatAuditDate(template?.updatedAt)}</p>
            </div>
        </div>
    </Card>

    <TabGroup
        tabs={TABS}
        activeTab={activeTab}
        type="underline"
        size="md"
        fullWidth={false}
        on:change={(e) => (activeTab = e.detail)}
    />

    {#if activeTab === 'configuration'}
        {#if template?.type === 'Alert'}
            <!-- Alert template: same UI as Sensor detail Alert tab (read-only) -->
            <div class="alert-tab-wrap">
                <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="alert-card">
                    <div class="alert-card-header">
                        <div class="alert-card-icon-wrap" aria-hidden="true">
                            <ShieldAlert class="alert-card-icon" size={20} strokeWidth={2} />
                        </div>
                        <div class="alert-card-content-wrap">
                            <h2 class="alert-card-title">Alert Rules</h2>
                            <p class="alert-card-subtitle">Configure when sensor stops responding</p>
                        </div>
                    </div>
                    <div class="alert-card-body">
                        <div class="alert-table-wrap">
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-label">Sensor Offline Alert</span>
                                    <span class="alert-desc">Alert when sensor stops responding</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-value">{alertDisplay.sensorOffline.text}</span>
                                </div>
                            </div>
                            {#if alertDisplay.sensorOffline.enabled}
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-text">Threshold</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-text">{alertDisplay.sensorOffline.threshold}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                        <div class="alert-table-wrap">
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-label">No Data Alert</span>
                                    <span class="alert-desc">Alert when no detections received</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-value">{alertDisplay.noData.text}</span>
                                </div>
                            </div>
                            {#if alertDisplay.noData.enabled}
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-text">Threshold</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-text">{alertDisplay.noData.threshold}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                        <div class="alert-table-wrap">
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-label">Dwell Time Alert</span>
                                    <span class="alert-desc">Alert when dwell time exceeds threshold</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-value">{alertDisplay.dwellTime.text}</span>
                                </div>
                            </div>
                            {#if alertDisplay.dwellTime.enabled}
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-text">{alertDisplay.dwellTime.zoneLabel}</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-text">{alertDisplay.dwellTime.threshold}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                    </div>
                </Card>
                <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="alert-card alert-card-notification">
                    <div class="alert-card-header">
                        <div class="alert-card-icon-wrap" aria-hidden="true">
                            <BellRing class="alert-card-icon" size={20} strokeWidth={2} />
                        </div>
                        <div class="alert-card-content-wrap">
                            <h2 class="alert-card-title">Notification Channels</h2>
                            <p class="alert-card-subtitle">Configure how alerts are delivered</p>
                        </div>
                    </div>
                    <div class="alert-card-body">
                        <div class="alert-table-wrap">
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-label">Email Notifications</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-value">{alertDisplay.email.text}</span>
                                </div>
                            </div>
                            {#if alertDisplay.email.enabled}
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-full">
                                    <span class="alert-text">{alertDisplay.email.address}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                        <div class="alert-table-wrap alert-table-wrap-last">
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-left">
                                    <span class="alert-label">Webhook</span>
                                </div>
                                <div class="alert-cell alert-cell-right">
                                    <span class="alert-value">{alertDisplay.webhook.text}</span>
                                </div>
                            </div>
                            {#if alertDisplay.webhook.enabled}
                            <div class="alert-row">
                                <div class="alert-cell alert-cell-full">
                                    <span class="alert-text">{alertDisplay.webhook.url}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                    </div>
                </Card>
            </div>
        {:else}
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
                        {#if editorArenaValue}
                            <div class="visual-editor-wrap">
                                <RadarVisualEditor
                                    arena={editorArenaValue}
                                    zones={editorZonesValue}
                                    maxZones={5}
                                    readonly={false}
                                    highlightZoneId={activeZoneTab === 'all' ? null : activeZoneTab}
                                    on:arenaChange={handleArenaChange}
                                    on:zonesChange={handleZonesChange}
                                />
                            </div>
                            <div class="visual-editor-actions">
                                <Button
                                    variant="filled"
                                    color="primary"
                                    size="md"
                                    loading={configSaving}
                                    disabled={configSaving}
                                    on:click={saveConfiguration}
                                >
                                    Save Configuration
                                </Button>
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
                                <span class="config-value">{deviceSettings?.deviceMode === 'BACKGROUND' ? 'Background' : deviceSettings?.deviceMode === 'LIVE_PREVIEW' ? 'Live Preview' : '—'}</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Timezone</span>
                                <span class="config-value">{deviceSettings?.timezone || '—'}</span>
                            </div>
                            <div class="config-label-value-row">
                                <span class="config-label">Path Tracking</span>
                                <span class="config-value">{deviceSettings?.pathTracking ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            {#if deviceSettings?.dataReportingInterval}
                            <div class="config-label-value-row">
                                <span class="config-label">Data Reporting Interval</span>
                                <span class="config-value">{deviceSettings.dataReportingInterval} ms</span>
                            </div>
                            {/if}
                            {#if deviceSettings?.dwellThreshold}
                            <div class="config-label-value-row">
                                <span class="config-label">Dwell Threshold</span>
                                <span class="config-value">{deviceSettings.dwellThreshold} s</span>
                            </div>
                            {/if}
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
                            disabled={editorZonesValue.length >= 5}
                            on:click={() => (showAddZoneModal = true)}
                        >
                            <Plus class="icon-sm" slot="icon-left" />
                            Add Zone
                        </Button>
                    </div>
                    <div class="config-card-body">
                        {#if editorZonesValue.length > 0}
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
                                    {#each editorZonesValue.filter(z => activeZoneTab === 'all' || (z.id ?? `zone-${z.zoneNumber}`) === activeZoneTab) as zone, zoneIndex}
                                        {@const zoneId = zone.id ?? `zone-${zone.zoneNumber}`}
                                        {@const zoneColors = getZoneColors(zone.zoneNumber ?? zoneIndex + 1)}
                                        {@const active = zone.active !== false}
                                        <div class="config-zone-row">
                                            <div
                                                class="config-zone-color"
                                                style="background: {zoneColors.fill}; border-color: {zoneColors.border};"
                                            ></div>
                                            <div class="config-zone-info">
                                                <span class="config-zone-name">{zone.name || `Zone ${zone.zoneNumber}`}</span>
                                                <span class="config-zone-detail">Position: ({zone.startX.toFixed(1)}, {zone.startY.toFixed(1)}) | Size: {(zone.endX - zone.startX).toFixed(1)} × {(zone.endY - zone.startY).toFixed(1)} m</span>
                                            </div>
                                            <Badge variant="filled" color={active ? 'success' : 'gray'} size="sm" label={active ? 'Active' : 'Inactive'} />
                                            <ActionMenu
                                                triggerIcon="dots-vertical"
                                                align="right"
                                                width="auto"
                                                items={getZoneMenuItems(active)}
                                                on:select={(e) => handleZoneAction(zoneId, zone.name, e.detail.id, active)}
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
        {/if}
    {:else if activeTab === 'assigned-sensor'}
        <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="assigned-card">
            <div slot="header" class="section-header">
                <div class="section-header-icon" aria-hidden="true">
                    <Radio class="icon-md" />
                </div>
                <div class="section-header-content">
                    <h2 class="section-title-sm">Assigned Sensor</h2>
                    <p class="section-subtitle">Sensors using this template configuration</p>
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

<!-- Edit Template Modal -->
<EditTemplateModal
    open={showEditModal}
    template={editTemplateData}
    availableSensors={availableSensorsForEdit}
    existingTemplateNames={data.existingTemplateNames ?? []}
    loading={editSaving}
    on:close={closeEditModal}
    on:save={handleSaveTemplate}
/>

<!-- Add Zone Modal -->
<AddZoneModal
    open={showAddZoneModal}
    nextZoneNumber={nextZoneNumberForAdd}
    trackingAreaWidth={addZoneTrackingArea.width}
    trackingAreaHeight={addZoneTrackingArea.height}
    trackingArena={editorArenaValue}
    existingZoneNames={editorZonesValue.map(z => z.name || '')}
    onClose={() => (showAddZoneModal = false)}
    onAdd={handleAddZoneFromModal}
/>

<!-- Edit Zone Modal -->
{#if zoneToEdit}
    <EditZoneModal
        open={showEditZoneModal}
        existingZoneNames={editorZonesValue.filter(z => (z.id ?? `zone-${z.zoneNumber}`) !== (zoneToEdit?.id ?? '')).map(z => z.name || '')}
        zone={{
            id: zoneToEdit.id,
            name: zoneToEdit.name,
            zoneNumber: zoneToEdit.zoneNumber ?? 1,
            color: zoneToEdit.color ?? '',
            startX: zoneToEdit.startX,
            startY: zoneToEdit.startY,
            endX: zoneToEdit.endX,
            endY: zoneToEdit.endY,
            active: zoneToEdit.active ?? true
        }}
        trackingAreaWidth={addZoneTrackingArea.width}
        trackingAreaHeight={addZoneTrackingArea.height}
        trackingArena={editorArenaValue}
        onClose={() => { showEditZoneModal = false; zoneToEdit = null; }}
        onSave={handleEditZoneSave}
    />
{/if}

<!-- Zone Confirm Modal (Deactivate/Activate/Delete) -->
<ConfirmModal
    open={showZoneConfirmModal}
    title={zoneConfirmKind === 'delete' ? 'Delete Zone' : zoneConfirmKind === 'deactivate' ? 'Deactivate Zone' : 'Activate Zone'}
    description={zoneConfirmKind === 'delete' 
        ? `Are you sure you want to delete "${pendingZoneName}"? This action cannot be undone.`
        : zoneConfirmKind === 'deactivate'
        ? `Are you sure you want to deactivate "${pendingZoneName}"?`
        : `Are you sure you want to activate "${pendingZoneName}"?`}
    cancelText="Cancel"
    confirmText={zoneConfirmKind === 'delete' ? 'Delete' : zoneConfirmKind === 'deactivate' ? 'Deactivate' : 'Activate'}
    type={zoneConfirmKind === 'delete' ? 'warning' : 'info'}
    on:close={() => { showZoneConfirmModal = false; zoneConfirmKind = null; pendingZoneId = ''; pendingZoneName = ''; }}
    on:confirm={confirmZoneAction}
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

    .info-grid-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-6);
    }

    .info-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .info-field-full {
        width: 100%;
    }

    .info-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-value {
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
    }

    .info-divider {
        height: 1px;
        background: var(--ds-border-default);
        margin: var(--ds-space-2) 0;
    }

    .info-audit {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
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

    /* Alert tab: same as Sensor detail Alert tab (Alert Rules + Notification Channels) */
    .alert-tab-wrap {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--ds-space-4);
        width: 100%;
    }
    .alert-card {
        width: 100%;
    }
    .alert-card :global(.ds-card) {
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-2xl);
        background: var(--ds-bg-primary);
    }
    .alert-card :global(.card-body) {
        padding: 0 !important;
        display: flex;
        flex-direction: column;
    }
    .alert-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 8px;
        border-bottom: 1px solid var(--ds-border-default);
    }
    .alert-card-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        flex-shrink: 0;
    }
    .alert-card-icon {
        color: var(--ds-text-tertiary);
    }
    .alert-card-content-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .alert-card-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-text-primary);
        margin: 0;
    }
    .alert-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-tertiary);
        margin: 0;
    }
    .alert-card-body {
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
    }
    .alert-card-notification .alert-card-body .alert-table-wrap:last-child {
        border-bottom: 1px solid var(--ds-border-default);
    }
    .alert-table-wrap {
        display: flex;
        flex-direction: column;
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
    }
    .alert-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        min-height: 52px;
        border-bottom: 1px solid var(--ds-border-default);
    }
    .alert-row:last-child {
        border-bottom: none;
    }
    .alert-cell {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 16px;
    }
    .alert-cell-left {
        flex: 1;
        min-width: 0;
        flex-direction: column;
        align-items: flex-start;
        gap: 0;
    }
    .alert-cell-right {
        flex-shrink: 0;
    }
    .alert-cell-full {
        flex: 1;
        min-width: 0;
    }
    .alert-label {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-primary);
    }
    .alert-desc {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-tertiary);
        margin-top: 2px;
    }
    .alert-value {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-primary);
    }
    .alert-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-primary);
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

    .visual-editor-actions {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        gap: var(--ds-space-2);
        padding-top: var(--ds-space-2);
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
