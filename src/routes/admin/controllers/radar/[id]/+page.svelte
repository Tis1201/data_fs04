<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import {
    Save,
    Radio,
    ArrowLeft,
    Trash,
    MapPin,
    Grid3x3,
    Clock,
    Plus,
    Eye,
    Pencil,
    Settings,
  } from "lucide-svelte";
  import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "$lib/components/ui/table";
  // Dialog imports for legacy use if needed, but new dialog handles its own

  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import RadarSensorConfigDialog from "./RadarSensorConfigDialog.svelte"; // Implemented
  import type { PageData } from "./$types";
  import { browser } from "$app/environment";

  export let data: PageData;

  /* Refactor: Sensors -> Controllers */
  const title = `Configure Radar Controller: ${data.radarSensor.name}`;
  // Helper to access config safely
  $: config = data.radarSensor.config as any;

  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Controllers", "/admin/controllers"],
    ["Radar", "/admin/controllers/radar"],
    data.radarSensor.name,
  ];

  let deleteState = {
    selectedRecord: null as typeof data.radarSensor | null,
    confirmationOpen: false,
  };

  function confirmDelete() {
    deleteState.selectedRecord = data.radarSensor;
    deleteState.confirmationOpen = true;
  }

  import { superForm } from "sveltekit-superforms/client";

  const { form, errors, enhance, submitting } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Radar Controller updated successfully!");
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

  let showSensorConfig = false;

  async function deleteZone(zoneId: string, zoneName: string) {
    if (!confirm(`Are you sure you want to delete zone "${zoneName}"?`)) {
      return;
    }

    const formData = new FormData();
    formData.append("zoneId", zoneId);

    try {
      const response = await fetch(`?/deleteZone`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Zone deleted successfully!");
        window.location.reload();
      } else {
        toast.error("Failed to delete zone");
      }
    } catch (error) {
      toast.error("An error occurred while deleting the zone");
      console.error(error);
    }
  }

  async function deleteDwellBucket(bucketId: string, bucketName: string) {
    if (
      !confirm(`Are you sure you want to delete dwell bucket "${bucketName}"?`)
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("bucketId", bucketId);

    try {
      const response = await fetch(`?/deleteDwellBucket`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Dwell Bucket deleted successfully!");
        window.location.reload();
      } else {
        toast.error("Failed to delete dwell bucket");
      }
    } catch (error) {
      toast.error("An error occurred while deleting the dwell bucket");
      console.error(error);
    }
  }

  // Visual editor state
  let editorArena = config?.trackingArea
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

  let editorZones =
    config?.zones?.map((z: any) => ({
      id: z.id,
      name: z.name,
      startX: z.startX,
      startY: z.startY,
      endX: z.endX,
      endY: z.endY,
    })) || [];

  // Unified Save Handler (Main Form)
  async function handleSave() {
    const sensorForm = document.querySelector(
      'form[action="?/updateSensor"]',
    ) as HTMLFormElement;
    if (sensorForm) sensorForm.requestSubmit();
  }

  // Layout Save Handler (Visual Editor)
  async function handleSaveLayout() {
    if (config?.trackingArea) {
      const layoutData = {
        arena: editorArena,
        zones: editorZones,
      };

      const formData = new FormData();
      formData.append("layout", JSON.stringify(layoutData));

      const response = await fetch("?/saveLayout", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.type === "success" || result.status === 200) {
          toast.success("Layout saved");
          window.location.reload(); // Refresh to ensure sync
        }
      } else {
        toast.error("Failed to save layout");
      }
    } else {
      toast.error("Please configure Tracking Area first via the form.");
    }
  }
</script>

<div class="w-full space-y-6">
  <AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Delete",
        icon: Trash,
        onClick: confirmDelete,
        variant: "destructive",
        disabled: $submitting,
      },
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto("/admin/controllers/radar"),
        variant: "outline",
      },
      {
        label: "Save",
        icon: Save,
        onClick: handleSave,
      },
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
  >
    <FormContainer method="POST" action="?/updateSensor" {enhance} novalidate>
      <AdminCard
        title="Controller Information"
        description="Edit radar controller details"
        icon={Radio}
        compact={true}
      >
        <div class="space-y-6">
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
      </AdminCard>
    </FormContainer>

    <AdminCard
      title="Tracking Area & Zones"
      description="Define the tracking area and zones visually or using coordinates"
      icon={MapPin}
      compact={true}
    >
      <Tabs value="visual" class="w-full">
        <TabsList class="mb-4">
          <TabsTrigger value="visual">
            <Eye class="h-4 w-4 mr-2" />
            Visual Editor
          </TabsTrigger>
          <TabsTrigger value="form">
            <Grid3x3 class="h-4 w-4 mr-2" />
            Form Editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" class="space-y-4">
          <RadarVisualEditor
            arena={editorArena}
            zones={editorZones}
            maxZones={5}
            on:arenaChange={handleArenaChange}
            on:zonesChange={handleZonesChange}
          />
          <p class="text-sm text-muted-foreground">
            Drag to reposition • Resize handles to adjust • Changes sync with
            form below
          </p>
        </TabsContent>

        <TabsContent value="form" class="space-y-6">
          <FormContainer
            method="POST"
            action={config?.trackingArea
              ? "?/updateTrackingArea"
              : "?/createTrackingArea"}
            enhance={trackingAreaEnhance}
            novalidate
          >
            <div class="space-y-6">
              <FormRow columns={2}>
                <FormField
                  id="trackingAreaName"
                  label="Area Name"
                  error={$trackingAreaErrors.name}
                  required={true}
                >
                  <Input
                    id="trackingAreaName"
                    name="name"
                    type="text"
                    bind:value={$trackingAreaForm.name}
                    placeholder="e.g., Main Hall"
                  />
                </FormField>
              </FormRow>

              <div class="bg-muted/50 p-4 rounded-md">
                <p class="text-sm font-medium mb-3">
                  Arena Coordinates (Origin: Sensor)
                </p>
                <FormRow columns={2}>
                  <FormField
                    id="startX"
                    label="Start X (can be negative)"
                    error={$trackingAreaErrors.startX}
                    required={true}
                  >
                    <Input
                      id="startX"
                      name="startX"
                      type="number"
                      step="0.1"
                      bind:value={$trackingAreaForm.startX}
                      placeholder="-4.0"
                    />
                  </FormField>

                  <FormField
                    id="startY"
                    label="Start Y (≥ 0)"
                    error={$trackingAreaErrors.startY}
                    required={true}
                  >
                    <Input
                      id="startY"
                      name="startY"
                      type="number"
                      step="0.1"
                      min="0"
                      bind:value={$trackingAreaForm.startY}
                      placeholder="e.g., 0.0"
                    />
                  </FormField>
                </FormRow>

                <FormRow columns={2}>
                  <FormField
                    id="endX"
                    label="End X (can be negative)"
                    error={$trackingAreaErrors.endX}
                    required={true}
                  >
                    <Input
                      id="endX"
                      name="endX"
                      type="number"
                      step="0.1"
                      bind:value={$trackingAreaForm.endX}
                      placeholder="4.0"
                    />
                  </FormField>

                  <FormField
                    id="endY"
                    label="End Y (≥ 0)"
                    error={$trackingAreaErrors.endY}
                    required={true}
                  >
                    <Input
                      id="endY"
                      name="endY"
                      type="number"
                      step="0.1"
                      min="0"
                      bind:value={$trackingAreaForm.endY}
                      placeholder="e.g., 15.0"
                    />
                  </FormField>
                </FormRow>
              </div>

              <FormRow columns={1}>
                <FormField
                  id="trackingAreaDescription"
                  label="Description"
                  error={$trackingAreaErrors.description}
                >
                  <Textarea
                    id="trackingAreaDescription"
                    name="description"
                    bind:value={$trackingAreaForm.description}
                    placeholder="Enter area description"
                    rows="2"
                    class="w-full"
                  />
                </FormField>
              </FormRow>

              <div class="flex justify-end">
                <Button type="submit" disabled={$trackingAreaSubmitting}>
                  {$trackingAreaSubmitting
                    ? "Saving..."
                    : config?.trackingArea
                      ? "Update Area"
                      : "Create Area"}
                </Button>
              </div>
            </div>
          </FormContainer>
        </TabsContent>
      </Tabs>
    </AdminCard>

    <AdminCard
      title="Zones (Max 5)"
      description="Define zones within the tracking area (Origin: Area top-left [0,0])"
      icon={Grid3x3}
      compact={true}
    >
      {#if !config?.trackingArea}
        <div class="text-center py-8 text-muted-foreground">
          <p>Please create a tracking area first before adding zones.</p>
        </div>
      {:else}
        <div class="space-y-4">
          <!-- Zone List/Table -->
          {#if !config?.trackingArea || !config?.zones || config.zones.length === 0}
            <div
              class="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md"
            >
              <p>No zones configured yet.</p>
              <Button
                variant="outline"
                class="mt-4"
                on:click={openCreateZone}
                disabled={!config?.trackingArea}
              >
                <Plus class="h-4 w-4 mr-2" /> Create First Zone
              </Button>
            </div>
          {:else}
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each config.zones as zone}
                <div
                  class="border rounded-lg p-4 bg-card text-card-foreground shadow-sm relative group"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="flex h-3 w-3 rounded-full"
                        style="background-color: {zone.color || '#10b981'}"
                      ></span>
                      <span class="font-semibold">{zone.name}</span>
                    </div>
                    <Badge variant="secondary">#{zone.zoneNumber}</Badge>
                  </div>

                  <div class="text-xs text-muted-foreground space-y-1">
                    <p>
                      Pos: ({zone.startX}, {zone.startY}) to ({zone.endX}, {zone.endY})
                    </p>
                    {#if zone.description}
                      <p class="truncate">{zone.description}</p>
                    {/if}
                  </div>

                  <div class="flex justify-end gap-2 mt-4 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      on:click={() => openEditZone(zone)}
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-destructive hover:text-destructive"
                      on:click={() => deleteZone(zone.id, zone.name)}
                    >
                      <Trash class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              {/each}

              <!-- Add Button Card -->
              {#if config.zones.length < 5}
                <button
                  class="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[140px]"
                  on:click={openCreateZone}
                >
                  <Plus class="h-8 w-8 mb-2" />
                  <span class="font-medium">Add Zone</span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </AdminCard>

    <!-- Zone Edit/Create Dialog -->
    <Dialog bind:open={showZoneDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            >{editingZoneId ? "Edit Zone" : "Create Zone"}</DialogTitle
          >
          <DialogDescription>
            Configure zone details. Position can also be adjusted in the visual
            editor.
          </DialogDescription>
        </DialogHeader>

        <form
          action={editingZoneId ? "?/updateZone" : "?/createZone"}
          method="POST"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === "success") {
                showZoneDialog = false;
                toast.success(editingZoneId ? "Zone updated" : "Zone created");
                await invalidateAll();
              } else {
                toast.error("Operation failed");
              }
            };
          }}
          class="space-y-4"
        >
          {#if editingZoneId}
            <input type="hidden" name="zoneId" value={editingZoneId} />
            <!-- Preserve existing coords when just editing props, or use what might be in form? -->
            <!-- Ideally we send current coords from server state to avoid overwriting with defaults if hidden fields aren't populated. -->
            <!-- Simplified: We just explicitly include the current/default fields required by Schema -->
            <!-- Note: The schema requires starX/Y etc. so we must include them even if hidden/unchanged in this view. -->
            {#if config?.zones}
              {#each config.zones as z}
                {#if z.id === editingZoneId}
                  <input type="hidden" name="startX" value={z.startX} />
                  <input type="hidden" name="startY" value={z.startY} />
                  <input type="hidden" name="endX" value={z.endX} />
                  <input type="hidden" name="endY" value={z.endY} />
                {/if}
              {/each}
            {/if}
          {:else}
            <!-- Defaults for new zone -->
            <input type="hidden" name="startX" value="0" />
            <input type="hidden" name="startY" value="2" />
            <input type="hidden" name="endX" value="2" />
            <input type="hidden" name="endY" value="4" />
          {/if}

          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="z-name" class="text-right">Name</Label>
              <Input
                id="z-name"
                name="name"
                bind:value={zoneDialogForm.name}
                class="col-span-3"
                required
              />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="z-number" class="text-right">Number</Label>
              <Input
                id="z-number"
                name="zoneNumber"
                type="number"
                min="1"
                max="5"
                bind:value={zoneDialogForm.zoneNumber}
                class="col-span-3"
                required
              />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="z-color" class="text-right">Color</Label>
              <div class="col-span-3 flex items-center gap-2">
                <Input
                  id="z-color"
                  name="color"
                  type="color"
                  bind:value={zoneDialogForm.color}
                  class="w-12 h-10 p-1"
                />
                <span class="text-xs text-muted-foreground"
                  >{zoneDialogForm.color}</span
                >
              </div>
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="z-desc" class="text-right">Description</Label>
              <Textarea
                id="z-desc"
                name="description"
                bind:value={zoneDialogForm.description}
                class="col-span-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              on:click={() => (showZoneDialog = false)}>Cancel</Button
            >
            <Button type="submit"
              >{editingZoneId ? "Save Changes" : "Create"}</Button
            >
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AdminCard
      title="Dwell Buckets"
      description="Configure dwell time buckets for analytics"
      icon={Clock}
      compact={true}
    >
      <div class="space-y-4">
        {#if !config?.dwellBuckets || config.dwellBuckets.length === 0}
          <div class="text-center py-4 text-muted-foreground">
            <p>No dwell buckets configured yet.</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each config.dwellBuckets as bucket}
              <div
                class="flex items-center justify-between p-3 bg-card border rounded-md"
              >
                <div>
                  <p class="font-medium">{bucket.name}</p>
                  <p class="text-sm text-muted-foreground">
                    {bucket.minDuration}s - {bucket.maxDuration
                      ? `${bucket.maxDuration}s`
                      : "unlimited"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive hover:bg-destructive/10"
                  on:click={() => deleteDwellBucket(bucket.id, bucket.name)}
                >
                  <Trash class="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            {/each}
          </div>
        {/if}

        <Separator />

        {#if !showDwellBucketForm}
          <Button
            on:click={() => (showDwellBucketForm = true)}
            variant="outline"
            class="w-full"
          >
            <Plus class="h-4 w-4 mr-2" />
            Add Dwell Bucket
          </Button>
        {:else}
          <FormContainer
            method="POST"
            action="?/createDwellBucket"
            enhance={dwellBucketEnhance}
            novalidate
          >
            <div class="border rounded-md p-4 bg-card space-y-4">
              <FormRow columns={1}>
                <FormField
                  id="bucketName"
                  label="Bucket Name"
                  error={$dwellBucketErrors.name}
                  required={true}
                >
                  <Input
                    id="bucketName"
                    name="name"
                    type="text"
                    bind:value={$dwellBucketForm.name}
                    placeholder="e.g., Short Stay"
                  />
                </FormField>
              </FormRow>

              <FormRow columns={2}>
                <FormField
                  id="minDuration"
                  label="Min Duration (seconds)"
                  error={$dwellBucketErrors.minDuration}
                  required={true}
                >
                  <Input
                    id="minDuration"
                    name="minDuration"
                    type="number"
                    min="0"
                    bind:value={$dwellBucketForm.minDuration}
                    placeholder="0"
                  />
                </FormField>

                <FormField
                  id="maxDuration"
                  label="Max Duration (seconds, optional)"
                  error={$dwellBucketErrors.maxDuration}
                >
                  <Input
                    id="maxDuration"
                    name="maxDuration"
                    type="number"
                    min="0"
                    bind:value={$dwellBucketForm.maxDuration}
                    placeholder="Leave empty for unlimited"
                  />
                </FormField>
              </FormRow>

              <FormRow columns={1}>
                <FormField
                  id="bucketDescription"
                  label="Description"
                  error={$dwellBucketErrors.description}
                >
                  <Textarea
                    id="bucketDescription"
                    name="description"
                    bind:value={$dwellBucketForm.description}
                    placeholder="Enter bucket description"
                    rows="2"
                    class="w-full"
                  />
                </FormField>
              </FormRow>

              <div class="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  on:click={() => (showDwellBucketForm = false)}>Cancel</Button
                >
                <Button type="submit" disabled={$dwellBucketSubmitting}>
                  {$dwellBucketSubmitting ? "Creating..." : "Create Bucket"}
                </Button>
              </div>
            </div>
          </FormContainer>
        {/if}
      </div>
    </AdminCard>
  </AdminPageLayout>
</div>

<RecordDeleteDialog
  state={deleteState}
  action="?/deleteSensor"
  actionName="deleteSensor"
  onConfirm={() => {
    goto("/admin/controllers/radar");
  }}
/>
