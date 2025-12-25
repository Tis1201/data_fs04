<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import {
    Radio,
    ArrowLeft,
    Trash,
    MapPin,
    Grid3x3,
    Clock,
    Pencil,
    Settings,
    Info,
    Activity,
  } from "lucide-svelte";
  import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
  import { Separator } from "$lib/components/ui/separator";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import RadarSensorConfigDialog from "$lib/components/ui_components_sveltekit/radar/RadarSensorConfigDialog.svelte";
  import RadarPreview from "$lib/components/ui_components_sveltekit/radar/RadarPreview.svelte";
  import type { PageData } from "./$types";
  import { superForm } from "sveltekit-superforms/client";
  import type { RadarConfig } from './+page.server';

  export let data: PageData;

  const title = `Radar Controller: ${data.radarSensor.name}`;
  
  $: config = (data.radarSensor.config as RadarConfig) || null;

  const pageCrumbs: [string, string][] = [
    ["Admin", "/admin"],
    ["Controllers", "/admin/controllers"],
    ["Radar", "/admin/controllers/radar"],
    [data.radarSensor.name, ""],
  ];

  let deleteState = {
    selectedRecord: null as typeof data.radarSensor | null,
    confirmationOpen: false,
  };

  function confirmDelete() {
    deleteState.selectedRecord = data.radarSensor;
    deleteState.confirmationOpen = true;
  }

  let showControllerEditDialog = false;
  let showSensorConfigDialog = false;

  const { form, errors, enhance, submitting } = superForm(data.form, {
    onResult: ({ result }) => {
      console.log('Form result:', result);
      if (result.type === "success") {
        toast.success("Radar Controller updated successfully!");
        showControllerEditDialog = false;
        invalidateAll();
      } else if (result.type === "failure") {
        // Handle validation errors
        const errorMsg = (result as { data?: { error?: string; form?: { message?: { text?: string } } } }).data?.error 
          || (result as { data?: { error?: string; form?: { message?: { text?: string } } } }).data?.form?.message?.text 
          || "Validation failed. Please check your input.";
        toast.error("Failed to update radar controller", {
          description: errorMsg
        });
      } else if (result.type === "error") {
        const errorMsg = (result as { data?: { error?: string } }).data?.error || "An unexpected error occurred";
        toast.error("Failed to update radar controller", {
          description: errorMsg
        });
      }
    },
    onError: ({ result }) => {
      console.error('Form submission error:', result);
      toast.error("Connection Error", {
        description: "Unable to connect to the server. Please check your connection."
      });
    }
  });

  const {
    form: trackingAreaForm,
    errors: trackingAreaErrors,
    enhance: trackingAreaEnhance,
    submitting: trackingAreaSubmitting,
  } = superForm(data.trackingAreaForm, {
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Tracking Area saved successfully!");
        window.location.reload();
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
        window.location.reload();
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
        window.location.reload();
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

  const accountOptions = data.accounts.map((account: { id: string; name: string }) => ({
    value: account.id,
    label: account.name,
  }));

  interface ZoneData {
    id?: string;
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color?: string;
    zoneNumber?: number;
    description?: string;
  }
  
  interface DeviceOption {
    value: string;
    label: string;
  }
  
  // Initialize editorZonesValue from config.zones once, then manage locally
  // Use a flag to prevent reactive re-derivation from overwriting local changes
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
  
  // Re-initialize when dialog closes (after save) by watching for config changes
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
  
  // Handle zones change from dialog (Visual Editor or Zone List)
  function handleZonesChange(event: CustomEvent<ZoneData[]>): void {
    editorZonesValue = event.detail;
  }

  // Device options - filter by selected account, radar controller must be linked to a device
  let deviceOptions: DeviceOption[] = [];
  $: deviceOptions = (data.devices || [])
    .filter((device) => {
      // If account is selected, only show devices from that account
      // Otherwise show all devices (for initial load)
      if ($form.accountId) {
        return device.account?.id === $form.accountId;
      }
      return true;
    })
    .map((device) => ({
      value: device.id,
      label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ""}${device.account ? ` - ${device.account.name}` : ""}`,
    }));

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

  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "MAINTENANCE", label: "Maintenance" },
  ];

</script>

<div class="w-full space-y-4">
  <AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Delete",
        icon: Trash,
        onClick: confirmDelete,
        variant: "destructive",
      },
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto("/admin/controllers/radar"),
        variant: "outline",
      },
    ]}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
  >
    <!-- Controller Overview Card -->
    <AdminCard title="Radar Controller" icon={Radio} compact={true}>
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
          <Button
            variant="outline"
            size="sm"
            on:click={() => (showControllerEditDialog = true)}
          >
            <Pencil class="h-4 w-4 mr-2" />
            Edit
          </Button>
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
    </AdminCard>

    <!-- Sensor Configuration Card -->
    <AdminCard title="Integrated Radar Sensor" icon={Activity} compact={true}>
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
    </AdminCard>

    <!-- Live Sensor Preview Card -->
    {#if data.radarSensor.controller?.device?.id}
      <AdminCard title="Live Sensor Preview" icon={Activity} compact={true}>
        <div class="space-y-4">
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
      </AdminCard>
    {:else}
      <AdminCard title="Live Sensor Preview" icon={Activity} compact={true}>
        <div class="p-4 text-center text-muted-foreground">
          <Info class="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No device linked to this controller.</p>
          <p class="text-xs">Link a device to enable live sensor preview.</p>
        </div>
      </AdminCard>
    {/if}
  </AdminPageLayout>
</div>

<Dialog bind:open={showControllerEditDialog}>
  <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Edit Controller Information</DialogTitle>
      <DialogDescription>Update the radar controller details</DialogDescription>
    </DialogHeader>

    <FormContainer method="POST" action="?/updateSensor" {enhance} novalidate>
      <div class="space-y-4">
        <FormRow columns={2}>
          <FormField
            id="name"
            label="Controller Name"
            error={$errors.name}
            required={true}
          >
            <Input
              id="name"
              name="name"
              type="text"
              bind:value={$form.name}
              placeholder="Enter sensor name"
              aria-invalid={$errors.name ? "true" : undefined}
            />
          </FormField>

          <FormField
            id="serialNumber"
            label="Serial Number"
            error={$errors.serialNumber}
            required={true}
          >
            <Input
              id="serialNumber"
              name="serialNumber"
              type="text"
              bind:value={$form.serialNumber}
              placeholder="Enter serial number"
              aria-invalid={$errors.serialNumber ? "true" : undefined}
            />
          </FormField>
        </FormRow>

        <FormRow columns={2}>
          <FormField
            id="accountId"
            label="Account"
            error={$errors.accountId}
            required={true}
          >
            <EnhancedSelect
              name="accountId"
              options={accountOptions}
              bind:value={$form.accountId}
              placeholder="Select an account"
              aria-invalid={$errors.accountId ? "true" : undefined}
            />
          </FormField>

          <FormField
            id="status"
            label="Status"
            error={$errors.status}
            required={true}
          >
            <EnhancedSelect
              name="status"
              options={statusOptions}
              bind:value={$form.status}
              placeholder="Select status"
              aria-invalid={$errors.status ? "true" : undefined}
            />
          </FormField>
        </FormRow>

        <FormRow columns={2}>
          <FormField id="location" label="Location" error={$errors.location}>
            <Input
              id="location"
              name="location"
              type="text"
              bind:value={$form.location}
              placeholder="Enter location"
            />
          </FormField>

          <FormField
            id="firmware"
            label="Firmware Version"
            error={$errors.firmware}
          >
            <Input
              id="firmware"
              name="firmware"
              type="text"
              bind:value={$form.firmware}
              placeholder="Enter firmware version"
            />
          </FormField>
        </FormRow>

        <FormRow columns={1}>
          <FormField
            id="deviceId"
            label="Linked Device"
            error={$errors.deviceId}
            required={true}
          >
            <EnhancedSelect
              name="deviceId"
              options={deviceOptions}
              value={$form.deviceId ?? undefined}
              on:change={(e) => { $form.deviceId = e.detail ?? null; }}
              placeholder="Select a device"
            />
          </FormField>
        </FormRow>

        <FormRow columns={1}>
          <FormField
            id="description"
            label="Description"
            error={$errors.description}
          >
            <Textarea
              id="description"
              name="description"
              bind:value={$form.description}
              placeholder="Enter sensor description"
              class="w-full h-24"
            />
          </FormField>
        </FormRow>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          on:click={() => {
            showControllerEditDialog = false;
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={$submitting}>
          {$submitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </FormContainer>
  </DialogContent>
</Dialog>

<RadarSensorConfigDialog
  bind:open={showSensorConfigDialog}
  {config}
  sensorName={data.radarSensor.name}
  sensorId={data.radarSensor.id || ""}
  syncStatus={data.radarSensor.syncStatus || "SYNCED"}
  isDeviceOnline={data.radarSensor.controller?.device?.connected || false}
  trackingAreaForm={{
    ...$trackingAreaForm,
    description: $trackingAreaForm.description ?? undefined
  }}
  zoneForm={{
    ...$zoneForm,
    description: $zoneForm.description ?? undefined,
    color: $zoneForm.color ?? undefined
  }}
  dwellBucketForm={{
    ...$dwellBucketForm,
    description: $dwellBucketForm.description ?? undefined
  }}
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

<RecordDeleteDialog
  state={deleteState}
  action="?/deleteSensor"
  actionName="deleteSensor"
  onConfirm={() => {
    goto("/admin/controllers/radar");
  }}
/>
