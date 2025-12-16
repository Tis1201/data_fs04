<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Save, Radio, ArrowLeft, Trash, MapPin, Grid3x3, Clock, Plus } from "lucide-svelte";
  import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import type { PageData } from "./$types";
  
  export let data: PageData;
  
  const title = `Configure Radar Sensor: ${data.radarSensor.name}`;
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Sensors", "/admin/sensors"],
    ["Radar", "/admin/sensors/radar"],
    data.radarSensor.name,
  ];

  let deleteState = {
    selectedRecord: null as typeof data.radarSensor | null,
    confirmationOpen: false
  };

  function confirmDelete() {
    deleteState.selectedRecord = data.radarSensor;
    deleteState.confirmationOpen = true;
  }
  
  import { superForm } from 'sveltekit-superforms/client';
  
  const { form, errors, enhance, submitting } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Radar Sensor updated successfully!");
      } else if (result.type === 'error') {
        toast.error("Failed to update radar sensor");
      }
    }
  });

  const { form: trackingAreaForm, errors: trackingAreaErrors, enhance: trackingAreaEnhance, submitting: trackingAreaSubmitting } = superForm(data.trackingAreaForm, {
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Tracking Area saved successfully!");
        window.location.reload();
      } else if (result.type === 'error') {
        toast.error("Failed to save tracking area");
      }
    }
  });

  const { form: zoneForm, errors: zoneErrors, enhance: zoneEnhance, submitting: zoneSubmitting } = superForm(data.zoneForm, {
    resetForm: true,
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Zone created successfully!");
        showZoneForm = false;
        window.location.reload();
      } else if (result.type === 'error') {
        toast.error("Failed to create zone");
      }
    }
  });

  const { form: dwellBucketForm, errors: dwellBucketErrors, enhance: dwellBucketEnhance, submitting: dwellBucketSubmitting } = superForm(data.dwellBucketForm, {
    resetForm: true,
    onResult: ({ result }) => {
      if (result.type === 'success') {
        toast.success("Dwell Bucket created successfully!");
        showDwellBucketForm = false;
        window.location.reload();
      } else if (result.type === 'error') {
        toast.error("Failed to create dwell bucket");
      }
    }
  });
  
  const accountOptions = data.accounts.map(account => ({
    value: account.id,
    label: account.name
  }));

  const statusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "MAINTENANCE", label: "Maintenance" }
  ];
  
  let showZoneForm = false;
  let showDwellBucketForm = false;

  async function deleteZone(zoneId: string, zoneName: string) {
    if (!confirm(`Are you sure you want to delete zone "${zoneName}"?`)) {
      return;
    }
    
    const formData = new FormData();
    formData.append('zoneId', zoneId);
    
    try {
      const response = await fetch(`?/deleteZone`, {
        method: 'POST',
        body: formData
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
    if (!confirm(`Are you sure you want to delete dwell bucket "${bucketName}"?`)) {
      return;
    }
    
    const formData = new FormData();
    formData.append('bucketId', bucketId);
    
    try {
      const response = await fetch(`?/deleteDwellBucket`, {
        method: 'POST',
        body: formData
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

  $: nextZoneNumber = data.radarSensor.trackingArea?.zones 
    ? Math.max(0, ...data.radarSensor.trackingArea.zones.map(z => z.zoneNumber)) + 1 
    : 1;
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
        disabled: $submitting
      },
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/sensors/radar'),
        variant: "outline"
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/updateSensor"]');
          if (form) form.requestSubmit();
        }
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <FormContainer 
    method="POST" 
    action="?/updateSensor" 
    {enhance} 
    novalidate
  >
    <AdminCard
      title="Sensor Information"
      description="Edit radar sensor details"
      icon={Radio}
      compact={true}
    >
      <div class="space-y-6">
        <FormRow columns={2}>
          <FormField 
            id="name" 
            label="Sensor Name" 
            error={$errors.name}
            required={true}
          >
            <Input 
              id="name" 
              name="name" 
              type="text" 
              bind:value={$form.name} 
              placeholder="Enter sensor name" 
              aria-invalid={$errors.name ? 'true' : undefined}
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
              aria-invalid={$errors.serialNumber ? 'true' : undefined}
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
              aria-invalid={$errors.accountId ? 'true' : undefined}
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
              aria-invalid={$errors.status ? 'true' : undefined}
            />
          </FormField>
        </FormRow>
        
        <FormRow columns={2}>
          <FormField 
            id="location" 
            label="Location" 
            error={$errors.location}
          >
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
                ...data.devices.map(device => ({
                  value: device.id,
                  label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ''}`
                }))
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
    title="Tracking Area (Arena)"
    description="Define the tracking area with origin at the sensor"
    icon={MapPin}
    compact={true}
  >
    <FormContainer 
      method="POST" 
      action={data.radarSensor.trackingArea ? "?/updateTrackingArea" : "?/createTrackingArea"}
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
          <p class="text-sm font-medium mb-3">Arena Coordinates (Origin: Sensor)</p>
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
                placeholder="e.g., -5.0" 
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
                placeholder="e.g., 10.0" 
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
            {$trackingAreaSubmitting ? 'Saving...' : (data.radarSensor.trackingArea ? 'Update Area' : 'Create Area')}
          </Button>
        </div>
      </div>
    </FormContainer>
  </AdminCard>
  
  <AdminCard
    title="Zones (Max 5)"
    description="Define zones within the tracking area (Origin: Area top-left [0,0])"
    icon={Grid3x3}
    compact={true}
  >
    {#if !data.radarSensor.trackingArea}
      <div class="text-center py-8 text-muted-foreground">
        <p>Please create a tracking area first before adding zones.</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#if data.radarSensor.trackingArea.zones.length === 0}
          <div class="text-center py-4 text-muted-foreground">
            <p>No zones configured yet.</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each data.radarSensor.trackingArea.zones as zone}
              <div class="flex items-center justify-between p-3 bg-card border rounded-md">
                <div class="flex items-center gap-3">
                  <Badge variant="outline">Zone {zone.zoneNumber}</Badge>
                  <div>
                    <p class="font-medium">{zone.name}</p>
                    <p class="text-sm text-muted-foreground">
                      ({zone.startX}, {zone.startY}) → ({zone.endX}, {zone.endY})
                      {#if zone.color}
                        <span class="inline-block w-3 h-3 rounded-full ml-2" style="background-color: {zone.color}"></span>
                      {/if}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  class="text-destructive hover:text-destructive hover:bg-destructive/10"
                  on:click={() => deleteZone(zone.id, zone.name)}
                >
                  <Trash class="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            {/each}
          </div>
        {/if}
        
        <Separator />
        
        {#if data.radarSensor.trackingArea.zones.length < 5}
          {#if !showZoneForm}
            <Button on:click={() => showZoneForm = true} variant="outline" class="w-full">
              <Plus class="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          {:else}
            <FormContainer 
              method="POST" 
              action="?/createZone" 
              enhance={zoneEnhance} 
              novalidate
            >
              <div class="border rounded-md p-4 bg-card space-y-4">
                <FormRow columns={2}>
                  <FormField 
                    id="zoneName" 
                    label="Zone Name" 
                    error={$zoneErrors.name}
                    required={true}
                  >
                    <Input 
                      id="zoneName" 
                      name="name" 
                      type="text" 
                      bind:value={$zoneForm.name} 
                      placeholder="e.g., Entry Zone" 
                    />
                  </FormField>
                  
                  <FormField 
                    id="zoneNumber" 
                    label="Zone Number" 
                    error={$zoneErrors.zoneNumber}
                    required={true}
                  >
                    <Input 
                      id="zoneNumber" 
                      name="zoneNumber" 
                      type="number" 
                      min="1"
                      max="5"
                      bind:value={$zoneForm.zoneNumber} 
                      placeholder={nextZoneNumber.toString()}
                    />
                  </FormField>
                </FormRow>
                
                <div class="bg-muted/50 p-3 rounded-md">
                  <p class="text-sm font-medium mb-3">Zone Coordinates (All ≥ 0)</p>
                  <FormRow columns={2}>
                    <FormField id="zoneStartX" label="Start X" error={$zoneErrors.startX} required={true}>
                      <Input id="zoneStartX" name="startX" type="number" step="0.1" min="0" bind:value={$zoneForm.startX} placeholder="0.0" />
                    </FormField>
                    <FormField id="zoneStartY" label="Start Y" error={$zoneErrors.startY} required={true}>
                      <Input id="zoneStartY" name="startY" type="number" step="0.1" min="0" bind:value={$zoneForm.startY} placeholder="0.0" />
                    </FormField>
                  </FormRow>
                  <FormRow columns={2}>
                    <FormField id="zoneEndX" label="End X" error={$zoneErrors.endX} required={true}>
                      <Input id="zoneEndX" name="endX" type="number" step="0.1" min="0" bind:value={$zoneForm.endX} placeholder="5.0" />
                    </FormField>
                    <FormField id="zoneEndY" label="End Y" error={$zoneErrors.endY} required={true}>
                      <Input id="zoneEndY" name="endY" type="number" step="0.1" min="0" bind:value={$zoneForm.endY} placeholder="5.0" />
                    </FormField>
                  </FormRow>
                </div>
                
                <FormRow columns={2}>
                  <FormField id="zoneColor" label="Color (optional)" error={$zoneErrors.color}>
                    <Input id="zoneColor" name="color" type="color" bind:value={$zoneForm.color} />
                  </FormField>
                </FormRow>
                
                <div class="flex justify-end space-x-2">
                  <Button type="button" variant="outline" on:click={() => showZoneForm = false}>Cancel</Button>
                  <Button type="submit" disabled={$zoneSubmitting}>
                    {$zoneSubmitting ? 'Creating...' : 'Create Zone'}
                  </Button>
                </div>
              </div>
            </FormContainer>
          {/if}
        {:else}
          <div class="text-center py-2 text-muted-foreground text-sm">
            Maximum 5 zones reached
          </div>
        {/if}
      </div>
    {/if}
  </AdminCard>
  
  <AdminCard
    title="Dwell Buckets"
    description="Configure dwell time buckets for analytics"
    icon={Clock}
    compact={true}
  >
    <div class="space-y-4">
      {#if data.radarSensor.dwellBuckets.length === 0}
        <div class="text-center py-4 text-muted-foreground">
          <p>No dwell buckets configured yet.</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each data.radarSensor.dwellBuckets as bucket}
            <div class="flex items-center justify-between p-3 bg-card border rounded-md">
              <div>
                <p class="font-medium">{bucket.name}</p>
                <p class="text-sm text-muted-foreground">
                  {bucket.minDuration}s - {bucket.maxDuration ? `${bucket.maxDuration}s` : 'unlimited'}
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
        <Button on:click={() => showDwellBucketForm = true} variant="outline" class="w-full">
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
              <Button type="button" variant="outline" on:click={() => showDwellBucketForm = false}>Cancel</Button>
              <Button type="submit" disabled={$dwellBucketSubmitting}>
                {$dwellBucketSubmitting ? 'Creating...' : 'Create Bucket'}
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
    goto('/admin/sensors/radar');
  }}
/>
