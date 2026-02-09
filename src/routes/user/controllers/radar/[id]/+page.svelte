<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { toast } from "$lib/stores/alertToast";
  import {
    MapPin,
    Settings,
    Info,
    PenLine,
    ChartNetwork,
    SquareActivity,
    PackageOpen,
    Logs,
    Cable,
    Braces,
    Layers,
    Plus,
    CalendarDays,
    Download,
    Route,
    ShieldAlert,
    BellRing,
    ScanSearch,
    ClipboardList,
  } from "lucide-svelte";
  import {
    Button,
    Badge,
    Card,
    TabGroup,
    Divider,
    DataTable,
    ActionMenu,
    ConfirmModal,
  } from "$lib/design-system/components";
  import EditDeviceModal from "$lib/components/ui_components_sveltekit/radar/EditDeviceModal.svelte";
  import AddZoneModal from "$lib/components/ui_components_sveltekit/radar/AddZoneModal.svelte";
  import EditZoneModal from "$lib/components/ui_components_sveltekit/radar/EditZoneModal.svelte";
  import RadarSensorConfigDialog from "$lib/components/ui_components_sveltekit/radar/RadarSensorConfigDialog.svelte";
  import RadarPreview from "$lib/components/ui_components_sveltekit/radar/RadarPreview.svelte";
  import RadarVisualEditor from "$lib/components/ui_components_sveltekit/radar/RadarVisualEditor.svelte";
  import { getZoneColors, getZoneBorderColor } from "$lib/components/ui_components_sveltekit/radar/zoneColors";
  import { RADAR_CONSTRAINTS } from "$lib/components/ui_components_sveltekit/radar/constraints";
  import type { PageData } from "./$types";
  import { superForm } from "sveltekit-superforms/client";

  export let data: PageData;

  interface RadarConfig {
    trackingArea?: { id?: string; name: string; startX: number; startY: number; endX: number; endY: number; description?: string };
    zones?: Array<{ id?: string; name: string; zoneNumber: number; startX: number; startY: number; endX: number; endY: number; color?: string; description?: string; active?: boolean }>;
    dwellBuckets?: Array<{ id?: string; name: string; minDuration: number; maxDuration?: number; description?: string }>;
  }

  $: config = (data.radarSensor.config as RadarConfig) || null;

  $: trackingAreaDisplay = (() => {
    const ta = config?.trackingArea;
    return {
      leftM: ta ? Math.abs(ta.startX) : 5,
      rightM: ta ? Math.abs(ta.endX) : 5,
      fwdStart: ta ? ta.startY : 0,
      fwdRange: ta ? (ta.endY - ta.startY) : 10,
      xMin: ta ? ta.startX : -5,
      xMax: ta ? ta.endX : 5,
      yMin: ta ? ta.startY : 0,
      yMax: ta ? ta.endY : 10,
    };
  })();

  let showSensorConfigDialog = false;
  /** Shared Edit Device modal (same as Listing) – opened by header "Edit Device" button */
  let showEditDeviceModal = false;
  /** Add Zone modal – opened by Add Zone button in Zones Configuration */
  let showAddZoneModal = false;
  /** Edit Zone modal – opened by Edit in zone row ActionMenu */
  let showEditZoneModal = false;
  let zoneToEdit: ZoneData | null = null;
  /** Zone confirm modal: Deactivate | Reactivate | Delete – opened from zone row ActionMenu */
  let showZoneConfirmModal = false;
  let zoneConfirmKind: 'deactivate' | 'activate' | 'delete' | null = null;
  let pendingZoneId = '';
  let pendingZoneName = '';
  let pendingZonePersisted = false;
  let activeTab = "summary";
  /** Active tab in Zones Configuration: 'all' or zone id (zone.id ?? `zone-${zone.zoneNumber}`) */
  let activeZoneTab = "all";

  const TABS = [
    { id: "summary", label: "Summary" },
    { id: "configuration", label: "Configuration" },
    { id: "analytics", label: "Analytics" },
    { id: "alert", label: "Alert" },
    { id: "live-preview", label: "Live Preview" },
  ];

  /** Zone tabs for Zones Configuration: All + one per zone. Use editorZonesValue so new zones appear before Save. */
  $: zoneTabs = (() => {
    const zones = editorZonesValue;
    if (zones.length === 0) return [];
    const allTab = { id: "all", label: "All" };
    const zoneItems = zones.map((z: ZoneData) => ({
      id: z.id ?? `zone-${z.zoneNumber ?? 0}`,
      label: z.name ?? `Zone ${z.zoneNumber ?? 0}`,
    }));
    return [allTab, ...zoneItems];
  })();

  /** Selected zone when a zone tab is active (for Zone tab detail view). From editorZonesValue. */
  $: selectedZoneDetail = (() => {
    if (activeZoneTab === "all" || !editorZonesValue.length) return null;
    const zone = editorZonesValue.find(
      (z: ZoneData) => (z.id ?? `zone-${z.zoneNumber ?? 0}`) === activeZoneTab
    );
    return zone ?? null;
  })();

  /** True if zone is persisted (exists in config.zones). Used to show Deactivate/Activate and to decide delete behavior. */
  function isZonePersisted(zone: ZoneData): boolean {
    const key = zone.id ?? `zone-${zone.zoneNumber ?? 0}`;
    return (config?.zones ?? []).some((z: ZoneData) => (z.id ?? `zone-${z.zoneNumber ?? 0}`) === key);
  }

  /** Tracking area dimensions for display (e.g. "10.0 x 10.0 m") */
  $: trackingAreaSizeDisplay = (() => {
    const ta = config?.trackingArea;
    if (!ta) return "—";
    const w = (ta.endX - ta.startX).toFixed(1);
    const h = (ta.endY - ta.startY).toFixed(1);
    return `${w} × ${h} m`;
  })();

  // Placeholder recent events (no backend yet)
  const recentEvents: Array<{ zone: string; eventType: string; dwellTime: string; occurredTime: string }> = [];

  const {
    form: trackingAreaForm,
    errors: trackingAreaErrors,
    enhance: trackingAreaEnhance,
    submitting: trackingAreaSubmitting,
  } = superForm(data.trackingAreaForm, {
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Tracking Area saved successfully!");
        invalidateAll();
      } else if (result.type === "error") {
        toast.error("Failed to save tracking area");
      }
    },
  });

  const {
    form: zoneForm,
    errors: zoneErrors,
    enhance: zoneEnhance,
    submitting: zoneSubmitting,
  } = superForm(data.zoneForm, {
    resetForm: true,
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Zone saved successfully!");
        invalidateAll();
      } else if (result.type === "error") {
        toast.error("Failed to save zone");
      }
    },
  });

  const {
    form: dwellBucketForm,
    errors: dwellBucketErrors,
    enhance: dwellBucketEnhance,
    submitting: dwellBucketSubmitting,
  } = superForm(data.dwellBucketForm, {
    resetForm: true,
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Dwell Bucket created successfully!");
        invalidateAll();
      } else if (result.type === "error") {
        toast.error("Failed to create dwell bucket");
      }
    },
  });

  $: formStates = {
    trackingArea: {
      submitting: $trackingAreaSubmitting,
      errors: $trackingAreaErrors,
      enhance: trackingAreaEnhance,
    },
    zone: {
      submitting: $zoneSubmitting,
      errors: $zoneErrors,
      enhance: zoneEnhance,
    },
    dwellBucket: {
      submitting: $dwellBucketSubmitting,
      errors: $dwellBucketErrors,
      enhance: dwellBucketEnhance,
    },
  };

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
  }

  /** Build ActionMenu items for a zone row (Edit, optional Deactivate/Activate, Delete). */
  function getZoneMenuItems(persisted: boolean, active: boolean): Array<{ id: string; label: string; destructive?: boolean }> {
    const items: Array<{ id: string; label: string; destructive?: boolean }> = [
      { id: 'edit', label: 'Edit' },
      { id: 'delete', label: 'Delete', destructive: true },
    ];
    if (persisted) {
      items.splice(1, 0, { id: active ? 'deactivate' : 'activate', label: active ? 'Deactivate' : 'Activate' });
    }
    return items;
  }

  let editorZonesValue: ZoneData[] = [];
  let zonesInitialized = false;

  $: if (config?.zones && !zonesInitialized) {
    editorZonesValue = config.zones.map((z: ZoneData & { active?: boolean }) => ({
      id: z.id,
      name: z.name,
      startX: z.startX,
      startY: z.startY,
      endX: z.endX,
      endY: z.endY,
      color: z.color,
      zoneNumber: z.zoneNumber,
      active: z.active,
    }));
    zonesInitialized = true;
  }

  interface CoordinateBounds {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }

  let editorArenaValue: CoordinateBounds | null = null;
  let arenaInitialized = false;

  $: if (!arenaInitialized) {
    editorArenaValue = config?.trackingArea
      ? {
          startX: config.trackingArea.startX,
          startY: config.trackingArea.startY,
          endX: config.trackingArea.endX,
          endY: config.trackingArea.endY,
        }
      : {
          startX: -4,
          startY: 0,
          endX: 4,
          endY: 4,
        };
    arenaInitialized = true;
  }

  function reinitializeFromConfig(): void {
    if (config?.zones) {
      editorZonesValue = config.zones.map((z: ZoneData & { active?: boolean }) => ({
        id: z.id,
        name: z.name,
        startX: z.startX,
        startY: z.startY,
        endX: z.endX,
        endY: z.endY,
        color: z.color,
        zoneNumber: z.zoneNumber,
        active: z.active,
      }));
    }
    if (config?.trackingArea) {
      editorArenaValue = {
        startX: config.trackingArea.startX,
        startY: config.trackingArea.startY,
        endX: config.trackingArea.endX,
        endY: config.trackingArea.endY,
      };
    }
  }

  function handleArenaChange(event: CustomEvent<CoordinateBounds>): void {
    editorArenaValue = event.detail;
  }

  function handleZonesChange(event: CustomEvent<ZoneData[]>): void {
    editorZonesValue = event.detail;
  }

  /** Next zone number for Add Zone modal (1-based). */
  $: nextZoneNumberForAdd = (() => {
    const existing = editorZonesValue.map((z) => z.zoneNumber || 0);
    return Math.max(1, ...existing, 0) + 1;
  })();

  /** Tracking area dimensions for Add Zone modal read-only display. */
  $: addZoneTrackingArea = (() => {
    const a = editorArenaValue;
    if (a) return { width: Math.abs(a.endX - a.startX), height: Math.abs(a.endY - a.startY) };
    const ta = config?.trackingArea;
    if (ta) return { width: Math.abs(ta.endX - ta.startX), height: Math.abs(ta.endY - ta.startY) };
    return { width: 10, height: 10 };
  })();

  /** Add a new zone from Add Zone modal. User must click Save layout to persist. */
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
      name: zone.name,
      zoneNumber: zone.zoneNumber,
      color: zone.color,
      startX: zone.startX,
      startY: zone.startY,
      endX: zone.endX,
      endY: zone.endY,
      active: zone.active,
    };
    editorZonesValue = [...editorZonesValue, newZone];
    toast.success("Zone added successfully!");
  }

  /** Save zone from Edit Zone modal. Persisted zones: call updateZone (and setZoneActive if active changed); then update local state. */
  async function handleEditZoneSave(updated: {
    id?: string;
    name: string;
    zoneNumber: number;
    color: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    active: boolean;
  }): Promise<void> {
    const zoneId = zoneToEdit?.id ?? (zoneToEdit != null ? `zone-${zoneToEdit.zoneNumber}` : null);
    if (zoneId == null) return;

    if (updated.id) {
      const formData = new FormData();
      formData.append("zoneId", updated.id);
      formData.append("name", updated.name);
      formData.append("zoneNumber", String(updated.zoneNumber));
      formData.append("startX", String(updated.startX));
      formData.append("startY", String(updated.startY));
      formData.append("endX", String(updated.endX));
      formData.append("endY", String(updated.endY));
      formData.append("color", updated.color);
      const res = await fetch("?/updateZone", { method: "POST", body: formData });
      if (!res.ok) {
        toast.error("Unable to update zone. Please try again!");
        return;
      }
      if (zoneToEdit && updated.active !== (zoneToEdit.active !== false)) {
        const activeFormData = new FormData();
        activeFormData.append("zoneId", updated.id);
        activeFormData.append("active", updated.active ? "true" : "false");
        await fetch("?/setZoneActive", { method: "POST", body: activeFormData });
      }
    }

    editorZonesValue = editorZonesValue.map((z) => {
      const zId = z.id ?? `zone-${z.zoneNumber}`;
      if (zId !== zoneId) return z;
      return {
        ...z,
        id: updated.id ?? z.id,
        name: updated.name,
        zoneNumber: updated.zoneNumber,
        color: updated.color,
        startX: updated.startX,
        startY: updated.startY,
        endX: updated.endX,
        endY: updated.endY,
        active: updated.active,
      };
    });
    toast.success("Zone updated successfully!");
    showEditZoneModal = false;
    zoneToEdit = null;
    invalidateAll();
  }

  /** Perform zone delete (called after ConfirmModal confirm). Persisted: API; local: remove from list. */
  function performDeleteZone(zoneId: string): void {
    const formData = new FormData();
    formData.append("zoneId", zoneId);
    fetch(`?/deleteZone`, { method: "POST", body: formData }).then(
      (response) => {
        if (response.ok) {
          if (activeZoneTab === zoneId) activeZoneTab = "all";
          toast.success("Zone deleted successfully!");
          invalidateAll();
        } else {
          toast.error("Unable to delete zone. Please try again!");
        }
      },
    );
  }

  function handleSetZoneActive(zoneId: string, zoneName: string, active: boolean): void {
    const formData = new FormData();
    formData.append("zoneId", zoneId);
    formData.append("active", active ? "true" : "false");
    fetch(`?/setZoneActive`, { method: "POST", body: formData }).then(
      (response) => {
        if (response.ok) {
          editorZonesValue = editorZonesValue.map((z) =>
            (z.id ?? `zone-${z.zoneNumber}`) === zoneId ? { ...z, active } : z
          );
          toast.success(active ? "Zone reactivated successfully!" : "Zone deactivated successfully!");
          invalidateAll();
        } else {
          toast.error(active ? "Unable to reactivate zone. Please try again!" : "Unable to deactivate zone. Please try again!");
        }
      },
    );
  }

  function closeZoneConfirmModal(): void {
    showZoneConfirmModal = false;
    zoneConfirmKind = null;
    pendingZoneId = '';
    pendingZoneName = '';
    pendingZonePersisted = false;
  }

  function handleZoneConfirmModalConfirm(): void {
    if (zoneConfirmKind === 'deactivate') {
      handleSetZoneActive(pendingZoneId, pendingZoneName, false);
    } else if (zoneConfirmKind === 'activate') {
      handleSetZoneActive(pendingZoneId, pendingZoneName, true);
    } else if (zoneConfirmKind === 'delete') {
      if (pendingZonePersisted) {
        performDeleteZone(pendingZoneId);
      } else {
        editorZonesValue = editorZonesValue.filter((z) => (z.id ?? `zone-${z.zoneNumber}`) !== pendingZoneId);
        if (activeZoneTab === pendingZoneId) activeZoneTab = "all";
        toast.success("Zone deleted successfully!");
      }
    }
    closeZoneConfirmModal();
  }

  function handleDeleteDwellBucket(bucketId: string, bucketName: string): void {
    if (
      !confirm(`Are you sure you want to delete dwell bucket "${bucketName}"?`)
    )
      return;
    const formData = new FormData();
    formData.append("bucketId", bucketId);
    fetch(`?/deleteDwellBucket`, { method: "POST", body: formData }).then(
      (response) => {
        if (response.ok) {
          toast.success("Dwell Bucket deleted successfully!");
          invalidateAll();
        } else {
          toast.error("Failed to delete dwell bucket");
        }
      },
    );
  }

  function handleSaveLayout(layoutData: { arena: { startX: number; startY: number; endX: number; endY: number } | null; zones: Array<{ id?: string; name: string; startX: number; startY: number; endX: number; endY: number }> }): void {
    const formData = new FormData();
    formData.append("layout", JSON.stringify(layoutData));
    fetch(`?/saveLayout`, { method: "POST", body: formData }).then(
      async (response) => {
        if (response.ok) {
          toast.success("Layout saved successfully!");
          await invalidateAll();
          reinitializeFromConfig();
        } else {
          toast.error("Failed to save layout");
        }
      },
    );
  }

  $: connectionStatus = data.radarSensor.controller?.device?.connected === true ? "Online" : "Offline";
  $: connectionBadgeColor =
    data.radarSensor.controller?.device?.connected === true ? "success" as const : "gray" as const;

  function formatDate(d: Date | string | null | undefined): string {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const eventsColumns = [
    { id: "zone", header: "Zone", accessor: (r: { zone: string }) => r.zone, type: "text" as const, width: "25%" },
    { id: "eventType", header: "Event Type", accessor: (r: { eventType: string }) => r.eventType, type: "text" as const, width: "25%" },
    { id: "dwellTime", header: "Dwell Time", accessor: (r: { dwellTime: string }) => r.dwellTime, type: "text" as const, width: "25%" },
    { id: "occurredTime", header: "Occurred Time", accessor: (r: { occurredTime: string }) => r.occurredTime, type: "text" as const, width: "25%" },
  ];

  /** Session Logs: Target ID (link), Dwell (sec), Proximity (m), Sensor, Timezone. Data from API /api/sensor-data/radar_session. */
  const sessionLogsColumns = [
    { id: "targetId", header: "Target ID", accessor: (r: { targetId: string }) => r.targetId, type: "custom" as const, sortable: true, width: "20%", render: (val: string) => `<a href="#" class="analytics-table-link">${val ?? ""}</a>` },
    { id: "dwellSec", header: "Dwell (sec)", accessor: (r: { dwellSec: string | number }) => r.dwellSec, type: "text" as const, sortable: true, width: "15%" },
    { id: "proximityM", header: "Proximity (m)", accessor: (r: { proximityM: string }) => r.proximityM, type: "text" as const, sortable: true, width: "15%" },
    { id: "sensor", header: "Sensor", accessor: (r: { sensor: string }) => r.sensor, type: "text" as const, width: "25%" },
    { id: "timezone", header: "Timezone", accessor: (r: { timezone: string }) => r.timezone, type: "text" as const, width: "25%" },
  ];
  /** Path Tracking: Date, Target ID, X (m), Y (m), Sensor, Timezone. Data from API /api/sensor-data/radar_path. */
  const pathTrackingColumns = [
    { id: "date", header: "Date", accessor: (r: { date: string }) => r.date, type: "text" as const, sortable: true, width: "18%" },
    { id: "targetId", header: "Target ID", accessor: (r: { targetId: string }) => r.targetId, type: "text" as const, width: "18%" },
    { id: "xM", header: "X (m)", accessor: (r: { xM: string }) => r.xM, type: "text" as const, width: "12%" },
    { id: "yM", header: "Y (m)", accessor: (r: { yM: string }) => r.yM, type: "text" as const, width: "12%" },
    { id: "sensor", header: "Sensor", accessor: (r: { sensor: string }) => r.sensor, type: "text" as const, width: "22%" },
    { id: "timezone", header: "Timezone", accessor: (r: { timezone: string }) => r.timezone, type: "text" as const, width: "18%" },
  ];

  const ANALYTICS_PAGE_SIZE = 10;
  let sessionLogsData: Array<{ id: string; targetId: string; dwellSec: string; proximityM: string; sensor: string; timezone: string }> = [];
  let pathTrackingData: Array<{ id: string; date: string; targetId: string; xM: string; yM: string; sensor: string; timezone: string }> = [];
  let sessionLogsPagination = { page: 1, pageSize: ANALYTICS_PAGE_SIZE, totalItems: 0, totalPages: 0 };
  let pathTrackingPagination = { page: 1, pageSize: ANALYTICS_PAGE_SIZE, totalItems: 0, totalPages: 0 };
  let sessionLogsLoading = false;
  let pathTrackingLoading = false;

  function formatAnalyticsDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }

  async function fetchSessionLogs(page: number) {
    const sensorId = data?.radarSensor?.id;
    if (!sensorId) return;
    sessionLogsLoading = true;
    try {
      const params = new URLSearchParams({ sensorId, page: String(page), per_page: String(ANALYTICS_PAGE_SIZE) });
      const res = await fetch(`/api/sensor-data/radar_session?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch session logs");
      const rows = (json.data || []).map((r: { target_id: string; log_creation_time?: string; dwell_tracking_area_sec: number; proximity_m: number | null; sensor_name: string; timezone_label: string }, i: number) => ({
        id: `${r.target_id ?? i}-${r.log_creation_time ?? i}`.replace(/\s/g, "_"),
        targetId: r.target_id ?? "",
        dwellSec: r.dwell_tracking_area_sec != null ? String(r.dwell_tracking_area_sec) : "—",
        proximityM: r.proximity_m != null ? String(r.proximity_m) : "—",
        sensor: r.sensor_name ?? "—",
        timezone: r.timezone_label ?? "—",
      }));
      sessionLogsData = rows;
      const p = json.pagination || {};
      sessionLogsPagination = {
        page: p.page ?? page,
        pageSize: p.per_page ?? ANALYTICS_PAGE_SIZE,
        totalItems: p.total_records ?? 0,
        totalPages: p.total_pages ?? 0,
      };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load session logs.");
      sessionLogsData = [];
    } finally {
      sessionLogsLoading = false;
    }
  }

  async function fetchPathTracking(page: number) {
    const sensorId = data?.radarSensor?.id;
    if (!sensorId) return;
    pathTrackingLoading = true;
    try {
      const params = new URLSearchParams({ sensorId, page: String(page), per_page: String(ANALYTICS_PAGE_SIZE) });
      const res = await fetch(`/api/sensor-data/radar_path?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch path tracking");
      const rows = (json.data || []).map((r: { target_id: string; log_creation_time: string; x_m: number; y_m: number; sensor_name: string; timezone_label: string }, i: number) => ({
        id: `${r.target_id}-${r.log_creation_time ?? i}`.replace(/\s/g, "_"),
        date: formatAnalyticsDate(r.log_creation_time),
        targetId: r.target_id ? `${r.target_id.slice(0, 6)}...${r.target_id.slice(-4)}` : "—",
        xM: r.x_m != null ? r.x_m.toFixed(2) : "—",
        yM: r.y_m != null ? r.y_m.toFixed(2) : "—",
        sensor: r.sensor_name ?? "—",
        timezone: r.timezone_label ?? "—",
      }));
      pathTrackingData = rows;
      const p = json.pagination || {};
      pathTrackingPagination = {
        page: p.page ?? page,
        pageSize: p.per_page ?? ANALYTICS_PAGE_SIZE,
        totalItems: p.total_records ?? 0,
        totalPages: p.total_pages ?? 0,
      };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load path tracking.");
      pathTrackingData = [];
    } finally {
      pathTrackingLoading = false;
    }
  }

  let prevAnalyticsSensorId = "";
  $: if (activeTab !== "analytics") prevAnalyticsSensorId = "";
  $: analyticsSensorId = activeTab === "analytics" ? data?.radarSensor?.id : "";
  $: if (analyticsSensorId && prevAnalyticsSensorId !== analyticsSensorId) {
    prevAnalyticsSensorId = analyticsSensorId;
    fetchSessionLogs(1);
    fetchPathTracking(1);
  }

  /** Live Preview – Live Track Details columns (ID, Dwell Time, Seen On) */
  const liveTrackColumns = [
    { id: "id", header: "ID", accessor: (r: { id: string }) => r.id, type: "text" as const, width: "33%" },
    { id: "dwellTime", header: "Dwell Time", accessor: (r: { dwellTime: string }) => r.dwellTime, type: "text" as const, width: "33%" },
    { id: "seenOn", header: "Seen On", accessor: (r: { seenOn: string }) => r.seenOn, type: "text" as const, width: "34%" },
  ];
  const liveTrackData = [
    { id: "annon-001", dwellTime: "1m 45s", seenOn: "xx min ago" },
    { id: "annon-002", dwellTime: "2m 12s", seenOn: "8 min ago" },
    { id: "annon-003", dwellTime: "1m 58s", seenOn: "15 min ago" },
  ];
  let liveTrackPagination = { page: 1, pageSize: 10, totalItems: 439, totalPages: 44 };
</script>

<!-- Main wrap: flex column, padding 24px, gap 16px (design) -->
<div class="radar-detail-wrap">
  <!-- Top row: Edit Device button right (title/subtitle are in the app header) -->
  <div class="radar-detail-header">
    <div class="radar-detail-actions">
      <Button
        variant="filled"
        color="primary"
        size="md"
        iconLeft={true}
        on:click={() => (showEditDeviceModal = true)}
      >
        <PenLine class="icon-sm" slot="icon-left" />
        Edit Device
      </Button>
    </div>
  </div>

  <!-- Device Information card (per design) -->
  <Card variant="default" radius="2xl" padding="md" fullWidth={true}>
    <div slot="header" class="section-header">
      <div class="section-header-icon" aria-hidden="true">
        <Info class="icon-md" />
      </div>
      <div class="section-header-content">
        <h2 class="section-title">Device Information</h2>
        <p class="section-subtitle">Key information about this device.</p>
      </div>
    </div>
    <!-- 4 columns: Col1 Device Name + Config Template | Col2 Device Code (if any) + empty row2 | Col3 Connection Status + Alert Template | Col4 Location + Firmware/Linked Device. -->
    <div class="details-wrap">
      <div class="details-row">
        <div class="text-display">
          <span class="text-display-label">Device Name</span>
          <span class="text-display-value">{data.radarSensor.name}</span>
        </div>
        <div class="text-display">
          <span class="text-display-label">Device Code</span>
          <span class="text-display-value">{data.radarSensor.serialNumber || "—"}</span>
        </div>
        <div class="text-display">
          <span class="text-display-label">Connection Status</span>
          <div class="text-display-value">
            <Badge color={connectionBadgeColor} size="md" variant="filled" label={connectionStatus} />
          </div>
        </div>
        <div class="text-display">
          <span class="text-display-label">Location</span>
          <span class="text-display-value">{data.radarSensor.location || "—"}</span>
        </div>
      </div>
      <div class="details-row">
        <div class="text-display">
          <span class="text-display-label">Configuration Template</span>
          <span class="text-display-value">Custom</span>
        </div>
        <div class="text-display text-display-placeholder" aria-hidden="true">
          <!-- Col 2 row 2: empty -->
        </div>
        <div class="text-display">
          <span class="text-display-label">Alert Template</span>
          <span class="text-display-value">—</span>
        </div>
        <div class="text-display text-display-stack">
          <div class="text-display-item">
            <span class="text-display-label">Firmware</span>
            <span class="text-display-value">{data.radarSensor.firmware || "—"}</span>
          </div>
          <div class="text-display-item">
            <span class="text-display-label">Linked Device</span>
            <span class="text-display-value">{data.radarSensor.controller?.device?.name || "—"}</span>
          </div>
        </div>
      </div>
      <Divider />
      <div class="meta-wrap">
        <span class="meta-text">Created at {formatDate(data.radarSensor.createdAt)}</span>
        <span class="meta-text">Last updated at {formatDate(data.radarSensor.updatedAt)}</span>
      </div>
    </div>
  </Card>

  <!-- Tabs: Summary | Configuration | Live Preview -->
  <TabGroup
    tabs={TABS}
    bind:activeTab
    type="underline"
    size="md"
    fullWidth={false}
  />

  <!-- Tab content -->
  {#if activeTab === "summary"}
    <div class="wrap-sections">
      <!-- Real time Detection (left card) -->
      <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="summary-card">
        <div slot="header" class="section-header">
          <div class="section-header-icon" aria-hidden="true">
            <ChartNetwork class="icon-md" />
          </div>
          <div class="section-header-content">
            <h2 class="section-title-sm">Real time Detection</h2>
            <p class="section-subtitle">Last 24 hours of detection activity.</p>
          </div>
        </div>
        <div class="empty-state-wrap">
          <div class="empty-state">
            <PackageOpen class="empty-state-icon" size={72} strokeWidth={1} aria-hidden="true" />
            <p class="empty-state-text">No Data Available.</p>
          </div>
        </div>
      </Card>

      <!-- Zone Activity (right card) -->
      <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="summary-card">
        <div slot="header" class="section-header">
          <div class="section-header-icon" aria-hidden="true">
            <SquareActivity class="icon-md" />
          </div>
          <div class="section-header-content">
            <h2 class="section-title-sm">Zone Activity</h2>
            <p class="section-subtitle">Detection distribution across zones.</p>
          </div>
        </div>
        <div class="zone-activity-content">
          {#if config?.zones && config.zones.length > 0}
            {#each config.zones as zone}
              <div class="zone-row">
                <span class="zone-label">{zone.name || `Zone ${zone.zoneNumber}`}</span>
                <span class="zone-value">—</span>
              </div>
            {/each}
          {:else}
            <p class="empty-state-text">No zones configured.</p>
          {/if}
        </div>
      </Card>
    </div>

    <!-- Recent Events table (Figma Frame 34: padding 16px, gap 10px, radius 16px, border 1px #E5E5E5) -->
    <div class="recent-events-card">
      <Card variant="default" radius="2xl" padding="lg" fullWidth={true}>
        <div class="section-header standalone">
          <div class="section-header-icon" aria-hidden="true">
            <Logs class="icon-md" />
          </div>
          <div class="section-header-content">
            <h2 class="section-title">Recent Events</h2>
            <p class="section-subtitle">Last 10 detection events from this sensor.</p>
          </div>
        </div>
        <div class="table-wrap">
          {#if recentEvents.length > 0}
            <DataTable
              columns={eventsColumns}
              data={recentEvents}
              keyField="zone"
            />
          {:else}
            <div class="empty-state-wrap">
              <div class="empty-state">
                <PackageOpen class="empty-state-icon" size={72} strokeWidth={1} aria-hidden="true" />
                <p class="empty-state-text">No events yet.</p>
              </div>
            </div>
          {/if}
        </div>
      </Card>
    </div>
  {:else if activeTab === "configuration"}
    <!-- Configuration tab: two-column layout per Figma (Visual Editor + Device Settings | Tracking Area + Zones) -->
    <div class="wrap-sections config-tab-sections">
      <!-- Left column -->
      <div class="config-column">
        <!-- Visual Editor: drag and resize zone within tracking area. Save Layout persists changes. -->
        <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="config-card">
          <div slot="header" class="section-header">
            <div class="section-header-icon" aria-hidden="true">
              <Cable class="icon-md" />
            </div>
            <div class="section-header-content">
              <h2 class="section-title-sm">Visual Editor</h2>
              <p class="section-subtitle">Drag and resize zone within tracking area.</p>
            </div>
          </div>
          <div class="config-card-body">
            {#if (config?.trackingArea || editorArenaValue)}
              <div class="visual-editor-wrap">
                <RadarVisualEditor
                  arena={editorArenaValue ?? config?.trackingArea ?? null}
                  zones={editorZonesValue.length > 0 ? editorZonesValue : (config?.zones ?? [])}
                  maxZones={5}
                  readonly={false}
                  on:arenaChange={handleArenaChange}
                  on:zonesChange={handleZonesChange}
                />
                <div class="visual-editor-actions">
                  <Button
                    variant="outline"
                    color="primary"
                    size="sm"
                    on:click={() => (showSensorConfigDialog = true)}
                  >
                    <Settings class="icon-sm" slot="icon-left" />
                    Configure
                  </Button>
                  <Button
                    variant="filled"
                    color="primary"
                    size="sm"
                    on:click={() => handleSaveLayout({ arena: editorArenaValue, zones: editorZonesValue })}
                  >
                    Save layout
                  </Button>
                </div>
              </div>
            {:else}
              <div class="visual-editor-placeholder">
                <Button
                  variant="filled"
                  color="primary"
                  size="md"
                  on:click={() => (showSensorConfigDialog = true)}
                >
                  <Settings class="icon-sm" slot="icon-left" />
                  Configure
                </Button>
                <p class="config-placeholder-text">Open configuration to define tracking area and zones.</p>
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
      <!-- Right column -->
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
              <p class="section-subtitle">Configuration up to 5 custom zones</p>
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
                {#if activeZoneTab === "all" || !selectedZoneDetail}
                  <div class="config-zone-list">
                    {#each editorZonesValue as zone, zoneIndex (zone.id ?? zone.zoneNumber)}
                      {@const zoneColors = getZoneColors(zone.zoneNumber ?? zoneIndex + 1)}
                      {@const persisted = isZonePersisted(zone)}
                      {@const active = zone.active !== false}
                      <div class="config-zone-row">
                        <div
                          class="config-zone-color"
                          style="background: {zoneColors.fill}; border-color: {zoneColors.border};"
                        ></div>
                        <div class="config-zone-info">
                          <span class="config-zone-name">{zone.name || `Zone ${zone.zoneNumber}`}</span>
                          <span class="config-zone-detail">Position: ({zone.startX}m, {zone.startY}m) | Size: {zone.endX - zone.startX} × {zone.endY - zone.startY} m</span>
                        </div>
                        <Badge variant="filled" color={active ? 'success' : 'gray'} size="sm" label={active ? 'Active' : 'Inactive'} />
                        <ActionMenu
                          triggerIcon="dots-vertical"
                          align="right"
                          width="auto"
                          items={getZoneMenuItems(persisted, active)}
                          on:select={(e) => {
                            const zoneId = zone.id ?? `zone-${zone.zoneNumber}`;
                            const zoneName = zone.name || `Zone ${zone.zoneNumber}`;
                            if (e.detail.id === 'edit') {
                              zoneToEdit = { ...zone, zoneNumber: zone.zoneNumber ?? zoneIndex + 1 };
                              showEditZoneModal = true;
                            }
                            if (e.detail.id === 'deactivate') {
                              zoneConfirmKind = 'deactivate';
                              pendingZoneId = zoneId;
                              pendingZoneName = zoneName;
                              showZoneConfirmModal = true;
                            }
                            if (e.detail.id === 'activate') {
                              zoneConfirmKind = 'activate';
                              pendingZoneId = zoneId;
                              pendingZoneName = zoneName;
                              showZoneConfirmModal = true;
                            }
                            if (e.detail.id === 'delete') {
                              zoneConfirmKind = 'delete';
                              pendingZoneId = zoneId;
                              pendingZoneName = zoneName;
                              pendingZonePersisted = persisted;
                              showZoneConfirmModal = true;
                            }
                          }}
                        />
                      </div>
                    {/each}
                  </div>
                {:else if selectedZoneDetail}
                  <!-- Zone tab detail: summary, config params, tracking area, computed bounds -->
                  {@const selectedZoneColors = getZoneColors(selectedZoneDetail.zoneNumber ?? 1)}
                  {@const selectedPersisted = isZonePersisted(selectedZoneDetail)}
                  {@const selectedActive = selectedZoneDetail.active !== false}
                  <div class="config-zone-detail-panel">
                    <div class="config-zone-summary-row">
                      <div
                        class="config-zone-color"
                        style="background: {selectedZoneColors.fill}; border-color: {selectedZoneColors.border};"
                      ></div>
                      <div class="config-zone-info">
                        <span class="config-zone-name">{selectedZoneDetail.name || `Zone ${selectedZoneDetail.zoneNumber}`}</span>
                        <span class="config-zone-detail">Position: ({selectedZoneDetail.startX}m, {selectedZoneDetail.startY}m) | Size: {(selectedZoneDetail.endX - selectedZoneDetail.startX).toFixed(1)} × {(selectedZoneDetail.endY - selectedZoneDetail.startY).toFixed(1)} m</span>
                      </div>
                      <Badge variant="filled" color={selectedActive ? 'success' : 'gray'} size="sm" label={selectedActive ? 'Active' : 'Inactive'} />
                      <ActionMenu
                        triggerIcon="dots-vertical"
                        align="right"
                        width="auto"
                        items={getZoneMenuItems(selectedPersisted, selectedActive)}
                        on:select={(e) => {
                          const zoneId = selectedZoneDetail.id ?? `zone-${selectedZoneDetail.zoneNumber}`;
                          const zoneName = selectedZoneDetail.name || `Zone ${selectedZoneDetail.zoneNumber}`;
                          if (e.detail.id === 'edit') {
                            zoneToEdit = { ...selectedZoneDetail, zoneNumber: selectedZoneDetail.zoneNumber ?? 1 };
                            showEditZoneModal = true;
                          }
                          if (e.detail.id === 'deactivate') {
                            zoneConfirmKind = 'deactivate';
                            pendingZoneId = zoneId;
                            pendingZoneName = zoneName;
                            showZoneConfirmModal = true;
                          }
                          if (e.detail.id === 'activate') {
                            zoneConfirmKind = 'activate';
                            pendingZoneId = zoneId;
                            pendingZoneName = zoneName;
                            showZoneConfirmModal = true;
                          }
                          if (e.detail.id === 'delete') {
                            zoneConfirmKind = 'delete';
                            pendingZoneId = zoneId;
                            pendingZoneName = zoneName;
                            pendingZonePersisted = selectedPersisted;
                            showZoneConfirmModal = true;
                          }
                        }}
                      />
                    </div>
                    <div class="config-zone-params">
                      <div class="config-tracking-rows">
                        <div class="config-label-value-row">
                          <span class="config-label">X Position</span>
                          <span class="config-value">{selectedZoneDetail.startX} m</span>
                        </div>
                        <div class="config-label-value-row">
                          <span class="config-label">Y Position</span>
                          <span class="config-value">{selectedZoneDetail.startY} m</span>
                        </div>
                        <div class="config-label-value-row">
                          <span class="config-label">Width</span>
                          <span class="config-value">{(selectedZoneDetail.endX - selectedZoneDetail.startX).toFixed(1)} m</span>
                        </div>
                        <div class="config-label-value-row">
                          <span class="config-label">Height</span>
                          <span class="config-value">{(selectedZoneDetail.endY - selectedZoneDetail.startY).toFixed(1)} m</span>
                        </div>
                      </div>
                    </div>
                    <div class="config-zone-tracking-area-line">
                      <span class="config-label">Tracking Area:</span>
                      <span class="config-value">{trackingAreaSizeDisplay}</span>
                    </div>
                    <div class="config-computed-box">
                      <div class="config-computed-title">Computed Bounds</div>
                      <div class="config-computed-row">
                        <span class="config-computed-cell"><span class="config-computed-label">Top – Left:</span> <span class="config-computed-value">({selectedZoneDetail.startX.toFixed(2)}m, {selectedZoneDetail.startY.toFixed(2)}m)</span></span>
                      </div>
                      <div class="config-computed-row">
                        <span class="config-computed-cell"><span class="config-computed-label">Bottom – Right:</span> <span class="config-computed-value">({selectedZoneDetail.endX.toFixed(2)}m, {selectedZoneDetail.endY.toFixed(2)}m)</span></span>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="config-empty-zones">
                <p class="config-placeholder-text">No zones configured.</p>
                <Button
                  variant="outline"
                  color="primary"
                  size="sm"
                  on:click={() => (showAddZoneModal = true)}
                >
                  Add Zone
                </Button>
              </div>
            {/if}
          </div>
        </Card>
      </div>
    </div>
  {:else if activeTab === "analytics"}
    <div class="analytics-tab-wrap">
      <!-- Session Logs (Frame 34) -->
      <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="analytics-card">
        <div class="analytics-card-header">
          <div class="analytics-card-header-left">
            <div class="analytics-card-icon-wrap" aria-hidden="true">
              <Logs class="analytics-card-icon" size={20} strokeWidth={2} />
            </div>
            <div class="analytics-card-content-wrap">
              <h2 class="analytics-card-title">Session Logs</h2>
              <p class="analytics-card-subtitle">Individual detection events and sessions</p>
            </div>
          </div>
          <div class="analytics-card-actions">
            <Button variant="outline" color="gray" size="md" class="analytics-date-btn" icon={CalendarDays} iconPosition="left">
              MM DD, YYYY
            </Button>
            <Button variant="outline" color="primary" size="md" icon={Download} iconPosition="left">
              Export Data
            </Button>
          </div>
        </div>
        <div class="analytics-table-wrap">
          <DataTable
            columns={sessionLogsColumns}
            data={sessionLogsData}
            keyField="id"
            sortable={true}
            paginated={sessionLogsPagination.totalPages > 0}
            pagination={sessionLogsPagination}
            loading={sessionLogsLoading}
            bordered={true}
            cellBorders={true}
            emptyMessage="No session logs yet."
            on:pageChange={(e) => { sessionLogsPagination = { ...sessionLogsPagination, page: e.detail }; fetchSessionLogs(e.detail); }}
          />
        </div>
      </Card>
      <!-- Path Tracking (Frame 41) -->
      <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="analytics-card">
        <div class="analytics-card-header">
          <div class="analytics-card-header-left">
            <div class="analytics-card-icon-wrap" aria-hidden="true">
              <Route class="analytics-card-icon" size={20} strokeWidth={2} />
            </div>
            <div class="analytics-card-content-wrap">
              <h2 class="analytics-card-title analytics-card-title-sm">Path Tracking</h2>
              <p class="analytics-card-subtitle">2D movement path playback and analysis</p>
            </div>
          </div>
          <div class="analytics-card-actions">
            <Button variant="outline" color="gray" size="md" class="analytics-date-btn" icon={CalendarDays} iconPosition="left">
              MM DD, YYYY
            </Button>
            <Button variant="outline" color="primary" size="md" icon={Download} iconPosition="left">
              Export Data
            </Button>
          </div>
        </div>
        <div class="analytics-table-wrap">
          <DataTable
            columns={pathTrackingColumns}
            data={pathTrackingData}
            keyField="id"
            sortable={true}
            paginated={pathTrackingPagination.totalPages > 0}
            pagination={pathTrackingPagination}
            loading={pathTrackingLoading}
            bordered={true}
            cellBorders={true}
            emptyMessage="No path tracking data yet."
            on:pageChange={(e) => { pathTrackingPagination = { ...pathTrackingPagination, page: e.detail }; fetchPathTracking(e.detail); }}
          />
        </div>
      </Card>
    </div>
  {:else if activeTab === "alert"}
    <div class="alert-tab-wrap">
      <!-- Alert Rules card -->
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
          <!-- Sensor Offline Alert -->
          <div class="alert-table-wrap">
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-label">Sensor Offline Alert</span>
                <span class="alert-desc">Alert when sensor stops responding</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-value">Enable</span>
              </div>
            </div>
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-text">Threshold</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-text">5 minutes</span>
              </div>
            </div>
          </div>
          <!-- No Data Alert -->
          <div class="alert-table-wrap">
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-label">No Data Alert</span>
                <span class="alert-desc">Alert when no detections received</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-value">Enable</span>
              </div>
            </div>
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-text">Threshold</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-text">30 minutes</span>
              </div>
            </div>
          </div>
          <!-- Dwell Time Alert -->
          <div class="alert-table-wrap">
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-label">Dwell Time Alert</span>
                <span class="alert-desc">Alert when dwell time exceeds threshold</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-value">Enable</span>
              </div>
            </div>
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-text">Zone 1: Entry</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-text">120 seconds</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <!-- Notification Channels card -->
      <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="alert-card">
        <div class="alert-card-header">
          <div class="alert-card-icon-wrap" aria-hidden="true">
            <BellRing class="alert-card-icon" size={20} strokeWidth={2} />
          </div>
          <div class="alert-card-content-wrap">
            <h2 class="alert-card-title">Notification Channels</h2>
            <p class="alert-card-subtitle">Configuration how alerts are delivered</p>
          </div>
        </div>
        <div class="alert-card-body">
          <!-- Email Notifications -->
          <div class="alert-table-wrap">
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-label">Email Notifications</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-value">Enable</span>
              </div>
            </div>
            <div class="alert-row">
              <div class="alert-cell alert-cell-full">
                <span class="alert-text">administrator@inrealities.com</span>
              </div>
            </div>
          </div>
          <!-- Webhook -->
          <div class="alert-table-wrap">
            <div class="alert-row">
              <div class="alert-cell alert-cell-left">
                <span class="alert-label">Webhook</span>
              </div>
              <div class="alert-cell alert-cell-right">
                <span class="alert-value">Enable</span>
              </div>
            </div>
            <div class="alert-row">
              <div class="alert-cell alert-cell-full">
                <span class="alert-text">https://api.example.com/webhook</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  {:else if activeTab === "live-preview"}
    <div class="live-preview-wrap">
      <!-- Left: Radar Tracking View -->
      <div class="live-preview-left">
        {#if data.radarSensor.controller?.device?.id}
          <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="live-preview-card">
            <div class="live-preview-card-header">
              <div class="live-preview-card-icon-wrap" aria-hidden="true">
                <ScanSearch class="live-preview-card-icon" size={20} strokeWidth={2} />
              </div>
              <div class="live-preview-card-content-wrap">
                <h2 class="live-preview-card-title">Radar Tracking View</h2>
                <p class="live-preview-card-subtitle">{data.radarSensor.name || "Live radar detection area"}</p>
              </div>
            </div>
            <div class="live-preview-card-body">
              <RadarPreview
                deviceId={data.radarSensor.controller.device.id}
                controllerId={data.radarSensor.controller.id}
                sensorId={data.radarSensor.id}
                duration={60}
                width={400}
                height={400}
                trackingArea={config?.trackingArea || null}
                zones={config?.zones || []}
                showOverlay={true}
              />
            </div>
          </Card>
        {:else}
          <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="live-preview-card">
            <div class="live-preview-card-header">
              <div class="live-preview-card-icon-wrap" aria-hidden="true">
                <ScanSearch class="live-preview-card-icon" size={20} strokeWidth={2} />
              </div>
              <div class="live-preview-card-content-wrap">
                <h2 class="live-preview-card-title">Radar Tracking View</h2>
                <p class="live-preview-card-subtitle">Live radar detection area</p>
              </div>
            </div>
            <div class="live-preview-card-body">
              <div class="empty-state-wrap">
                <div class="empty-state">
                  <Info class="empty-state-icon" aria-hidden="true" />
                  <p class="empty-state-text">No device linked to this controller.</p>
                  <p class="empty-state-text secondary">Link a device to enable live sensor preview.</p>
                </div>
              </div>
            </div>
          </Card>
        {/if}
      </div>
      <!-- Right: Live Track Details -->
      <div class="live-preview-right">
        <Card variant="default" radius="2xl" padding="none" fullWidth={true} class="live-preview-card">
          <div class="live-preview-card-header">
            <div class="live-preview-card-icon-wrap" aria-hidden="true">
              <ClipboardList class="live-preview-card-icon" size={20} strokeWidth={2} />
            </div>
            <div class="live-preview-card-content-wrap">
              <h2 class="live-preview-card-title">Live Track Details</h2>
              <p class="live-preview-card-subtitle">Current tracks from this sensor</p>
            </div>
          </div>
          <div class="live-preview-card-body">
            <div class="live-track-table-wrap">
              <DataTable
                columns={liveTrackColumns}
                data={liveTrackData}
                keyField="id"
                sortable={false}
                paginated={true}
                pagination={liveTrackPagination}
                bordered={true}
                cellBorders={true}
                emptyMessage="No tracks yet."
                on:pageChange={(e) => { liveTrackPagination = { ...liveTrackPagination, page: e.detail }; }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</div>

<!-- Edit Device modal – same as Listing (shared component) -->
<EditDeviceModal
  bind:open={showEditDeviceModal}
  sensor={data.radarSensor}
  onSave={async (payload) => {
    const fd = new FormData();
    fd.set("name", payload.name);
    fd.set("location", payload.location);
    const res = await fetch("?/updateSensorInfo", { method: "POST", body: fd });
    if (res.ok) {
      toast.success("Device updated.");
      showEditDeviceModal = false;
      invalidateAll();
    } else {
      toast.error("Unable to update device. Please try again.");
    }
  }}
  onClose={() => (showEditDeviceModal = false)}
/>

<AddZoneModal
  bind:open={showAddZoneModal}
  nextZoneNumber={nextZoneNumberForAdd}
  trackingAreaWidth={addZoneTrackingArea.width}
  trackingAreaHeight={addZoneTrackingArea.height}
  onAdd={handleAddZoneFromModal}
  onClose={() => (showAddZoneModal = false)}
/>

<EditZoneModal
  bind:open={showEditZoneModal}
  zone={zoneToEdit}
  trackingAreaWidth={addZoneTrackingArea.width}
  trackingAreaHeight={addZoneTrackingArea.height}
  onSave={handleEditZoneSave}
  onClose={() => { showEditZoneModal = false; zoneToEdit = null; }}
/>

{#if zoneConfirmKind}
  <ConfirmModal
    bind:open={showZoneConfirmModal}
    title={zoneConfirmKind === 'deactivate' ? 'Deactivate Zone' : zoneConfirmKind === 'activate' ? 'Reactivate Zone' : 'Delete Zone'}
    description={zoneConfirmKind === 'deactivate'
      ? 'Are you sure you want to deactivate this zone?'
      : zoneConfirmKind === 'activate'
        ? 'Are you sure you want to reactivate this zone?'
        : 'Are you sure you want to delete this zone? This action can not be reverse.'}
    confirmText={zoneConfirmKind === 'deactivate' ? 'Deactivate' : zoneConfirmKind === 'activate' ? 'Reactivate' : 'Delete'}
    cancelText="Cancel"
    type={zoneConfirmKind === 'activate' ? 'info' : 'error'}
    on:close={closeZoneConfirmModal}
    on:confirm={handleZoneConfirmModalConfirm}
  />
{/if}

<RadarSensorConfigDialog
  bind:open={showSensorConfigDialog}
  {config}
  sensorName={data.radarSensor.name}
  sensorLocation={data.radarSensor.location ?? ""}
  onSaveSensorInfo={async (data) => {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("location", data.location ?? "");
    const res = await fetch("?/updateSensorInfo", { method: "POST", body: fd });
    if (res.ok) {
      toast.success("Device updated.");
      invalidateAll();
    } else {
      toast.error("Unable to update device. Please try again.");
    }
  }}
  sensorId={data.radarSensor.id || ""}
  syncStatus={data.radarSensor.syncStatus || "SYNCED"}
  isDeviceOnline={data.radarSensor.controller?.device?.connected || false}
  trackingAreaForm={{ ...$trackingAreaForm, description: $trackingAreaForm.description ?? undefined }}
  zoneForm={{ ...$zoneForm, description: $zoneForm.description ?? undefined, color: $zoneForm.color ?? undefined }}
  dwellBucketForm={{ ...$dwellBucketForm, description: $dwellBucketForm.description ?? undefined }}
  {formStates}
  bind:editorArena={editorArenaValue}
  bind:editorZones={editorZonesValue}
  onDeleteZone={(zoneId) => performDeleteZone(zoneId)}
  onDeleteDwellBucket={handleDeleteDwellBucket}
  onSaveLayout={handleSaveLayout}
  on:zonesChange={handleZonesChange}
  on:success={() => {
    toast.success("Sensor configuration updated!");
    reinitializeFromConfig();
    invalidateAll();
  }}
  on:synced={() => {
    toast.success("Config synced with device!");
    reinitializeFromConfig();
    invalidateAll();
  }}
/>

<style>
  .radar-detail-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--ds-space-6);
    gap: var(--ds-space-4);
    width: 100%;
    font-family: var(--ds-font-family-primary);
  }

  .radar-detail-header {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: flex-start;
    width: 100%;
    gap: var(--ds-space-4);
  }

  .radar-detail-actions {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .radar-detail-title-text {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-0-5);
  }

  .radar-detail-title {
    margin: 0;
    font: var(--ds-text-lg-medium);
    color: var(--ds-text-primary);
  }

  .radar-detail-subtitle {
    margin: 0;
    font: var(--ds-text-sm-regular);
    color: var(--ds-text-tertiary);
  }

  .section-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .section-header.standalone {
    padding: var(--ds-space-2) 0;
    border-bottom: none;
    margin-bottom: var(--ds-space-4);
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

  .section-title {
    margin: 0;
    font: var(--ds-text-lg-medium);
    color: var(--ds-text-primary);
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

  /* Device Information: 4-column grid, 2 rows (design order) */
  .details-wrap {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ds-space-4) var(--ds-space-6);
    padding: var(--ds-space-4);
    width: 100%;
  }

  .details-row {
    display: contents;
  }

  .details-wrap .text-display {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-1);
    min-width: 0;
  }

  .details-wrap .text-display-placeholder {
    min-height: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .details-wrap .text-display-stack {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-3);
  }

  .details-wrap .text-display-stack .text-display-item {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-1);
  }

  .details-wrap > :global(hr),
  .details-wrap > .meta-wrap {
    grid-column: 1 / -1;
  }

  .text-display-label {
    font: var(--ds-text-sm-regular);
    color: var(--ds-color-neutral-true-600);
  }

  .text-display-value {
    font: var(--ds-text-md-medium);
    color: var(--ds-text-primary);
  }

  .meta-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-1);
  }

  .meta-text {
    font: var(--ds-text-xs-regular);
    color: var(--ds-color-neutral-true-600);
    letter-spacing: 0.01em;
  }

  .wrap-sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ds-space-4);
    width: 100%;
  }

  .summary-card {
    min-width: 0;
  }

  .empty-state-wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--ds-space-6);
    min-height: 180px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ds-space-4);
  }

  .empty-state-icon {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    color: var(--ds-color-neutral-true-400);
  }

  .empty-state-text {
    margin: 0;
    font: italic var(--ds-text-sm-regular);
    color: #A3A3A3;
    text-align: center;
    max-width: 240px;
  }

  .empty-state-text.secondary {
    font-size: var(--ds-text-xs);
    margin-top: var(--ds-space-0-5);
  }

  .zone-activity-content {
    display: flex;
    flex-direction: column;
    padding: var(--ds-space-4);
    gap: var(--ds-space-4);
  }

  .zone-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-4);
  }

  .zone-label {
    font: var(--ds-text-sm-regular);
    color: var(--ds-color-neutral-true-600);
  }

  .zone-value {
    font: var(--ds-text-md-medium);
    color: var(--ds-text-primary);
    text-align: right;
  }

  .table-wrap {
    margin-top: var(--ds-space-2);
  }

  /* Recent Events card – Figma Frame 34 (padding 16px, gap 10px, radius 16px, border 1px #E5E5E5) */
  .recent-events-card {
    width: 100%;
  }
  .recent-events-card :global(.card-body) {
    padding: 16px !important;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .recent-events-card :global(.ds-card) {
    width: 100%;
    border: 1px solid #E5E5E5;
    border-radius: 16px;
    background: #FFFFFF;
  }
  .recent-events-card .section-header.standalone {
    padding: 8px 0;
    gap: 8px;
  }
  .recent-events-card .section-title {
    font-size: 18px;
    font-weight: 500;
    line-height: 24px;
    color: #141414;
  }
  .recent-events-card .section-subtitle {
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: #475467;
  }
  .recent-events-card .table-wrap {
    background: #FFFFFF;
    border-radius: 9px;
  }

  /* Analytics tab: Session Logs + Path Tracking (Frame 34, Frame 41) */
  .analytics-tab-wrap {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--ds-space-4);
    width: 100%;
  }
  .analytics-card {
    width: 100%;
  }
  .analytics-card :global(.card-body) {
    padding: 16px !important;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .analytics-card :global(.ds-card) {
    border: 1px solid var(--ds-border-default);
    border-radius: var(--ds-radius-2xl);
    background: var(--ds-bg-primary);
  }
  .analytics-card-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 0;
    gap: 8px;
    flex-wrap: wrap;
  }
  .analytics-card-header-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .analytics-card-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--ds-radius-lg);
    flex-shrink: 0;
  }
  .analytics-card-icon {
    color: var(--ds-text-tertiary);
  }
  .analytics-card-content-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .analytics-card-title {
    font: var(--ds-font-family-primary);
    font-weight: 500;
    font-size: 18px;
    line-height: 24px;
    color: var(--ds-text-primary);
    margin: 0;
  }
  .analytics-card-title-sm {
    font-size: 16px;
  }
  .analytics-card-subtitle {
    font: var(--ds-font-family-primary);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: var(--ds-text-tertiary);
    margin: 0;
  }
  .analytics-card-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .analytics-date-btn {
    min-width: 100px;
  }
  .analytics-table-wrap {
    display: flex;
    flex-direction: column;
    background: var(--ds-bg-primary);
    border-radius: 9px;
    overflow: hidden;
  }
  .analytics-table-wrap :global(table) {
    border-radius: 9px;
  }
  :global(.analytics-table-link) {
    font-family: var(--ds-font-family-primary);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: #0040C1;
    text-decoration: none;
  }
  :global(.analytics-table-link:hover) {
    text-decoration: underline;
  }

  /* Alert tab: Alert Rules + Notification Channels (Figma section wrap, header, table wrap) */
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
  }
  .alert-cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 16px;
    gap: 16px;
    border-bottom: 1px solid var(--ds-border-default);
  }
  .alert-cell:last-child {
    border-bottom: none;
  }
  .alert-row:last-child .alert-cell {
    border-bottom: none;
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

  /* Live Preview tab: two-panel layout (Radar Tracking View | Live Track Details) */
  .live-preview-wrap {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 16px;
    width: 100%;
    min-height: 0;
  }
  .live-preview-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .live-preview-right {
    width: 426px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }
  .live-preview-card :global(.card-body) {
    padding: 0 !important;
    display: flex;
    flex-direction: column;
  }
  .live-preview-card-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 16px;
    gap: 8px;
    border-bottom: 1px solid var(--ds-border-default);
  }
  .live-preview-card-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--ds-radius-lg);
    flex-shrink: 0;
  }
  .live-preview-card-icon {
    color: var(--ds-text-tertiary);
  }
  .live-preview-card-content-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .live-preview-card-title {
    font-family: var(--ds-font-family-primary);
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
    color: var(--ds-text-primary);
    margin: 0;
  }
  .live-preview-card-subtitle {
    font-family: var(--ds-font-family-primary);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: var(--ds-text-tertiary);
    margin: 0;
  }
  .live-preview-card-body {
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }
  .live-track-table-wrap {
    background: var(--ds-bg-primary);
    border-radius: 9px;
    overflow: hidden;
  }
  .live-track-table-wrap :global(.ds-datatable) {
    border-radius: 9px;
  }

  /* Configuration tab: two-column grid, Figma layout */
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

  .visual-editor-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--ds-space-2);
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

  /* Wrap: flex row equivalent as 2x2 grid, gap 16px (Figma) */
  .config-tracking-rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 16px;
    width: 100%;
  }

  .config-tracking-rows .config-label-value-row {
    flex: 1 1 auto;
  }

  /* Info wrap: Figma padding 12px, gap 8px, #FAFAFA, 8px radius */
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
    min-width: 0;
    word-break: break-word;
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

  .config-computed-label {
    color: #737373;
  }

  .config-computed-value {
    color: #737373;
    text-align: right;
    flex-shrink: 0;
  }

  .config-zone-tab-content {
    margin-top: var(--ds-space-4);
  }

  .config-zone-detail-panel {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-4);
  }

  .config-zone-summary-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--ds-space-4);
    padding: var(--ds-space-2) 0;
  }

  .config-zone-summary-row .config-zone-color {
    flex-shrink: 0;
  }

  .config-zone-summary-row .config-zone-info {
    flex: 1;
    min-width: 0;
  }

  .config-zone-params {
    width: 100%;
  }

  .config-zone-tracking-area-line {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-4);
    font-family: var(--ds-font-family-primary);
  }

  .config-zone-tracking-area-line .config-label {
    font-size: 14px;
    font-weight: 400;
    color: var(--ds-text-tertiary);
  }

  .config-zone-tracking-area-line .config-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--ds-text-primary);
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

  .config-zone-menu {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 8px;
    color: var(--ds-text-primary);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }

  .config-zone-menu:hover {
    background: var(--ds-bg-secondary);
  }

  .config-empty-zones {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ds-space-4);
    padding: var(--ds-space-4);
  }

  .icon-sm {
    width: 20px;
    height: 20px;
  }

  .icon-md {
    width: 20px;
    height: 20px;
  }

  :global(.radar-detail-wrap .ds-card) {
    border: 1px solid var(--ds-color-neutral-true-200);
    border-radius: 16px;
  }
</style>
