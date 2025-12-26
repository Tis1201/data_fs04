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
  import RadarSensorConfigDialog from "./RadarSensorConfigDialog.svelte";
  import RadarPreview from "./RadarPreview.svelte";
  import type { PageData } from "./$types";
  import { superForm } from "sveltekit-superforms/client";
  import { truncateText } from "$lib/utils/text-utils";

  export let data: PageData;

  const title = `Radar Controller: ${truncateText(data.radarSensor.name, 40)}`;
  $: config = data.radarSensor.config as any;

  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Controllers", "/admin/controllers"],
    ["Radar", "/admin/controllers/radar"],
    truncateText(data.radarSensor.name, 40),
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
      if (result.type === "success") {
        toast.success("Radar Controller updated successfully!");
        showControllerEditDialog = false;
        invalidateAll();
      } else if (result.type === "error") {
        toast.error("Failed to update radar controller");
      }
    },
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

  const accountOptions = data.accounts.map((account: any) => ({
    value: account.id,
    label: account.name,
  }));

  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "MAINTENANCE", label: "Maintenance" },
  ];

  function getStatusColor(status: string) {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500";
      case "INACTIVE":
        return "bg-gray-500";
      case "MAINTENANCE":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  }
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
              <Badge
                variant="outline"
                class="{getStatusColor(
                  data.radarSensor.status,
                )} text-white border-0"
              >
                {data.radarSensor.status}
              </Badge>
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
          {#if data.radarSensor.device}
            <div>
              <div class="text-xs text-muted-foreground mb-1">
                Linked Device
              </div>
              <div class="font-medium">{data.radarSensor.device.name}</div>
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
                variant={config?.zones?.length > 0 ? "default" : "secondary"}
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
              variant={config?.dwellBuckets?.length > 0
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
          >
            <EnhancedSelect
              name="deviceId"
              options={[
                { value: "", label: "No device linked" },
                ...data.devices.map((device) => ({
                  value: device.id,
                  label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ""}`,
                })),
              ]}
              bind:value={$form.deviceId}
              placeholder="Select a device (optional)"
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
  trackingAreaForm={$trackingAreaForm}
  zoneForm={$zoneForm}
  dwellBucketForm={$dwellBucketForm}
  {formStates}
  editorArena={config?.trackingArea
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
      }}
  editorZones={config?.zones?.map((z) => ({
    id: z.id,
    name: z.name,
    startX: z.startX,
    startY: z.startY,
    endX: z.endX,
    endY: z.endY,
  })) || []}
  onDeleteZone={(zoneId, zoneName) => {
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
  }}
  onDeleteDwellBucket={(bucketId, bucketName) => {
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
  }}
  onSaveLayout={(layoutData) => {
    const formData = new FormData();
    formData.append("layout", JSON.stringify(layoutData));
    fetch("?/saveLayout", { method: "POST", body: formData }).then(
      (response) => {
        if (response.ok) {
          toast.success("Layout saved");
          invalidateAll();
        } else {
          toast.error("Failed to save layout");
        }
      },
    );
  }}
  on:success={() => {
    toast.success("Sensor configuration updated!");
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
