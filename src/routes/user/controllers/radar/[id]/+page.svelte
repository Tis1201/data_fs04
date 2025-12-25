<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import {
    Radio,
    ArrowLeft,
    MapPin,
    Grid3x3,
    Clock,
    Settings,
    Info,
    Activity,
  } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
  import RadarSensorConfigDialog from "$lib/components/ui_components_sveltekit/radar/RadarSensorConfigDialog.svelte";
  import RadarPreview from "$lib/components/ui_components_sveltekit/radar/RadarPreview.svelte";
  import type { PageData } from "./$types";
  import { superForm } from "sveltekit-superforms/client";

  export let data: PageData;

  const title = `Radar Controller: ${data.radarSensor.name}`;
  
  interface RadarConfig {
    trackingArea?: { id?: string; name: string; startX: number; startY: number; endX: number; endY: number; description?: string };
    zones?: Array<{ id?: string; name: string; zoneNumber: number; startX: number; startY: number; endX: number; endY: number; color?: string; description?: string }>;
    dwellBuckets?: Array<{ id?: string; name: string; minDuration: number; maxDuration?: number; description?: string }>;
  }
  
  $: config = (data.radarSensor.config as RadarConfig) || null;

  let showSensorConfigDialog = false;

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

  // Bundle form states for Dialog
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
  }
  
  // Initialize editorZonesValue from config.zones once, then manage locally
  let editorZonesValue: ZoneData[] = [];
  let zonesInitialized = false;
  
  $: if (config?.zones && !zonesInitialized) {
    editorZonesValue = config.zones.map((z: ZoneData) => ({
      id: z.id,
      name: z.name,
      startX: z.startX,
      startY: z.startY,
      endX: z.endX,
      endY: z.endY,
      color: z.color,
      zoneNumber: z.zoneNumber,
    }));
    zonesInitialized = true;
  }
  
  // Initialize editorArenaValue from config.trackingArea once, then manage locally
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
  
  // Re-initialize when dialog closes (after save)
  function reinitializeFromConfig(): void {
    if (config?.zones) {
      editorZonesValue = config.zones.map((z: ZoneData) => ({
        id: z.id,
        name: z.name,
        startX: z.startX,
        startY: z.startY,
        endX: z.endX,
        endY: z.endY,
        color: z.color,
        zoneNumber: z.zoneNumber,
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
  
  // Handle zones change from dialog
  function handleZonesChange(event: CustomEvent<ZoneData[]>): void {
    editorZonesValue = event.detail;
  }

  function handleDeleteZone(zoneId: string, zoneName: string): void {
    if (!confirm(`Are you sure you want to delete zone "${zoneName}"?`)) return;
    const formData = new FormData();
    formData.append("zoneId", zoneId);
    fetch(`?/deleteZone`, { method: "POST", body: formData }).then(
      (response) => {
        if (response.ok) {
          toast.success("Zone deleted successfully!");
          invalidateAll();
        } else {
          toast.error("Failed to delete zone");
        }
      },
    );
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
      (response) => {
        if (response.ok) {
          toast.success("Layout saved successfully!");
          invalidateAll();
        } else {
          toast.error("Failed to save layout");
        }
      },
    );
  }
</script>

<div class="container mx-auto py-6 space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <Button variant="outline" size="sm" on:click={() => goto("/user/controllers/radar")}>
        <ArrowLeft class="h-4 w-4 mr-2" />
        Back
      </Button>
      <div>
        <h1 class="text-2xl font-bold">{data.radarSensor.name}</h1>
        <p class="text-muted-foreground">Radar Controller Details</p>
      </div>
    </div>
  </div>

  <!-- Controller Overview Card -->
  <div class="border rounded-lg p-6 bg-card">
    <div class="space-y-4">
      <!-- Controller Header with Status -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <h3 class="text-lg font-semibold">{data.radarSensor.name}</h3>
            <StatusBadge status={data.radarSensor.status} />
          </div>
          <div class="text-sm text-muted-foreground">
            Serial: {data.radarSensor.serialNumber}
          </div>
        </div>
      </div>

      <!-- Controller Details Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div class="text-xs text-muted-foreground mb-1">Account</div>
          <div class="font-medium">
            {data.radarSensor.account?.name || "N/A"}
          </div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground mb-1">Firmware</div>
          <div class="font-medium">{data.radarSensor.firmware || "N/A"}</div>
        </div>
        {#if data.radarSensor.location}
          <div>
            <div class="text-xs text-muted-foreground mb-1">Location</div>
            <div class="font-medium flex items-center gap-1">
              <MapPin class="h-3 w-3" />
              {data.radarSensor.location}
            </div>
          </div>
        {/if}
        {#if data.radarSensor.controller?.device}
          <div>
            <div class="text-xs text-muted-foreground mb-1">
              Linked Device
            </div>
            <div class="font-medium">{data.radarSensor.controller.device.name}</div>
          </div>
        {/if}
      </div>

      {#if data.radarSensor.description}
        <div class="pt-2 border-t">
          <div class="text-xs text-muted-foreground mb-1">Description</div>
          <div class="text-sm">{data.radarSensor.description}</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Sensor Configuration Card -->
  <div class="border rounded-lg p-6 bg-card">
    <div class="space-y-4">
      <!-- Sensor Header -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <div class="h-2 w-2 rounded-full bg-blue-500"></div>
            <span class="text-sm font-medium">Single Integrated Sensor</span>
          </div>
          <div class="text-xs text-muted-foreground">
            This radar controller includes one built-in sensor for area
            monitoring
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          on:click={() => (showSensorConfigDialog = true)}
        >
          <Settings class="h-4 w-4 mr-2" />
          Configure
        </Button>
      </div>

      <!-- Configuration Status -->
      <div class="grid gap-3">
        <!-- Tracking Area Status -->
        <div
          class="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
            >
              <MapPin class="h-4 w-4 text-primary" />
            </div>
            <div>
              <div class="text-sm font-medium">Tracking Area</div>
              {#if config?.trackingArea}
                <div class="text-xs text-muted-foreground">
                  {config.trackingArea.name}
                </div>
              {:else}
                <div class="text-xs text-muted-foreground">
                  Not configured
                </div>
              {/if}
            </div>
          </div>
          <Badge variant={config?.trackingArea ? "default" : "secondary"}>
            {config?.trackingArea ? "Configured" : "Pending"}
          </Badge>
        </div>

        <!-- Zones Status -->
        <div
          class="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
            >
              <Grid3x3 class="h-4 w-4 text-primary" />
            </div>
            <div>
              <div class="text-sm font-medium">Detection Zones</div>
              <div class="text-xs text-muted-foreground">
                {config?.zones?.length || 0} of 5 zones configured
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if config?.zones && config.zones.length > 0}
              <div class="flex gap-1">
                {#each config.zones.slice(0, 3) as zone}
                  <span
                    class="h-2 w-2 rounded-full"
                    style="background-color: {zone.color || '#10b981'}"
                  ></span>
                {/each}
                {#if config.zones.length > 3}
                  <span class="text-xs text-muted-foreground"
                    >+{config.zones.length - 3}</span
                  >
                {/if}
              </div>
            {/if}
            <Badge
              variant={(config?.zones?.length || 0) > 0 ? "default" : "secondary"}
            >
              {config?.zones?.length || 0} Zones
            </Badge>
          </div>
        </div>

        <!-- Dwell Buckets Status -->
        <div
          class="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
            >
              <Clock class="h-4 w-4 text-primary" />
            </div>
            <div>
              <div class="text-sm font-medium">Dwell Analysis</div>
              <div class="text-xs text-muted-foreground">
                {config?.dwellBuckets?.length || 0} time buckets configured
              </div>
            </div>
          </div>
          <Badge
            variant={(config?.dwellBuckets?.length || 0) > 0
              ? "default"
              : "secondary"}
          >
            {config?.dwellBuckets?.length || 0} Buckets
          </Badge>
        </div>
      </div>
    </div>
  </div>

  <!-- Live Sensor Preview Card -->
  {#if data.radarSensor.controller?.device?.id}
    <div class="border rounded-lg p-6 bg-card">
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Live Sensor Preview</h3>
        <div class="text-sm text-muted-foreground">
          View real-time radar data from this sensor. Requires the device to
          be online and connected.
        </div>
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
    </div>
  {:else}
    <div class="border rounded-lg p-6 bg-card">
      <div class="p-4 text-center text-muted-foreground">
        <Info class="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No device linked to this controller.</p>
        <p class="text-xs">Link a device to enable live sensor preview.</p>
      </div>
    </div>
  {/if}
</div>

<RadarSensorConfigDialog
  bind:open={showSensorConfigDialog}
  {config}
  sensorName={data.radarSensor.name}
  sensorId={data.radarSensor.id || ""}
  syncStatus={data.radarSensor.syncStatus || "SYNCED"}
  isDeviceOnline={data.radarSensor.controller?.device?.connected || false}
  trackingAreaForm={{...$trackingAreaForm, description: $trackingAreaForm.description ?? undefined}}
  zoneForm={{...$zoneForm, description: $zoneForm.description ?? undefined, color: $zoneForm.color ?? undefined}}
  dwellBucketForm={{...$dwellBucketForm, description: $dwellBucketForm.description ?? undefined}}
  {formStates}
  bind:editorArena={editorArenaValue}
  bind:editorZones={editorZonesValue}
  onDeleteZone={handleDeleteZone}
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


