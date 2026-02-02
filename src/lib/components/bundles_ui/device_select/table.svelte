<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Search, ArrowUpDown } from 'lucide-svelte';
  import DebouncedTextFilter from '$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte';
  import PopoverFilter from '$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte';
  import OnlineDot from "$lib/components/ui_components_sveltekit/devices/OnlineDot.svelte";
  import { mqttClient } from '$lib/client/mqtt/mqttClient';
import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";

  import type { DeviceTag } from '@prisma/client';
  
  interface Device {
    id: string;
    name: string;
    status: string;
    model?: string;
    description?: string;
    createdAt?: string;
    lastUsedAt?: string;
    connected?: boolean;
    macAddress?: string;
    wifiMac?: string;
    lanMac?: string;
  }
  
  interface TableProps {
    records: Device[];
    availableTags: DeviceTag[];
    pagination: {
      page: number;
      per_page: number;
      total_records: number;
      total_pages: number;
    };
    sort: {
      field: string;
      order: 'asc' | 'desc';
    };
    loading: boolean;
    selectedDeviceIds?: string[];
  }
  
  export let props: TableProps;

  // URL and $page are not used; keep state internal
  const options = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Disabled', value: 'DISABLED' },
  ];
  const tagOptions = props.availableTags.map(tag => {
        return {
            label: tag.name,
            value: tag.id
        }
    })
    console.log({tagOptions});
    
  
  // Create event dispatcher
  const dispatch = createEventDispatcher<{
    rowClick: Device;
    toggleSelectAllClick: any;
    sort: { field: string; order: 'asc' | 'desc' };
    pagination: { page: number; per_page: number };
    filter: { search?: string; status?: string | null, tag?: string | null };
  }>();
  
  // Handle row click
  function handleRowClick(device: Device) {
    dispatch('rowClick', device);
  }
  
  // Handle toggle select all
  function handleToggleSelectAllClick() {
    dispatch('toggleSelectAllClick');
  }
  
  // Handle sort click
  function handleSortClick(field: string) {
    const order = props.sort.field === field && props.sort.order === 'asc' ? 'desc' : 'asc';
    dispatch('sort', { field, order });
  }
  
  // Function to get badge variant based on status
  type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'success';
  function getStatusVariant(status: string): BadgeVariant {
    const statusMap: Record<string, BadgeVariant> = {
      ACTIVE: 'success',
      INACTIVE: 'destructive',
      DISABLED: 'outline'
    };
    return statusMap[status] ?? 'outline';
  }
  
  // Internal filter state; emit to parent
  let localSearch = '';
  let localStatus: string | null = null;
  let localTag: string | null = null;
  
  function emitFilter() {
    console.log({localTag})
    dispatch('filter', { search: localSearch, status: localStatus, tag: localTag });
  }
  
  // Reset filters function for parent component to call
  export function resetFilters() {
    localSearch = '';
    localStatus = null;
    localTag = null;
    emitFilter();
  }

  function handleSearchChange(e: CustomEvent) {
    const detail: any = (e as any).detail;
    localSearch = typeof detail === 'string' ? detail : '';
    emitFilter();
  }
  


  // Track which devices we've subscribed to
  const subscribedDeviceIds = new Set<string>();

  // Subscribe to device channels for real-time updates
  async function subscribeToDevices(deviceIds: string[]) {
    console.log('[DeviceSelectorTable] subscribeToDevices called with:', deviceIds);
    if (deviceIds.length === 0) {
      console.log('[DeviceSelectorTable] No device IDs, skipping subscription');
      return;
    }

    // Connection ID no longer needed - MQTT handles subscriptions automatically
    console.log('[DeviceSelectorTable] Device subscriptions handled automatically via MQTT');

    // Device subscriptions now handled via MQTT automatically
    // MQTT client automatically receives device notifications based on user permissions
    for (const deviceId of deviceIds) {
      if (subscribedDeviceIds.has(deviceId)) continue;
      subscribedDeviceIds.add(deviceId);
      console.log('[DeviceSelectorTable] Device', deviceId, 'will receive updates via MQTT');
    }
  }

  // Subscribe to connection events to update device status in real time
  onMount(() => {
    // Initial subscribe to devices
    subscribeToDevices(props.records.map((r) => r.id));

    // Subscribe to device connection/disconnection notifications via MQTT
    const unsubConnection = mqttClient.onNotification('device:connection', (payload: any) => {
      console.log('[DeviceSelectorTable] Received device:connection notification via MQTT:', payload);
      
      const deviceId = payload?.deviceId;
      if (!deviceId) return;
      
      // Update device status in the records
      const deviceIndex = props.records.findIndex((r) => r.id === deviceId);
      if (deviceIndex >= 0) {
        props.records[deviceIndex].connected = payload?.connected ?? true;
        props = { ...props }; // trigger re-render
        console.log('[DeviceSelectorTable] ✅ Device status updated (connected):', deviceId);
      }
    });

    const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
      console.log('[DeviceSelectorTable] Received device:disconnection notification via MQTT:', payload);
      
      const deviceId = payload?.deviceId;
      if (!deviceId) return;
      
      // Update device status in the records
      const deviceIndex = props.records.findIndex((r) => r.id === deviceId);
      if (deviceIndex >= 0) {
        props.records[deviceIndex].connected = false;
        props = { ...props }; // trigger re-render
        console.log('[DeviceSelectorTable] ✅ Device status updated (disconnected):', deviceId);
      }
    });

    return () => {
      try { 
        unsubConnection && unsubConnection();
        unsubDisconnection && unsubDisconnection();
      } catch {}
    };
  });

  // Note: We only subscribe in onMount. Subscribing on every props.records change
  // would create duplicate subscriptions on pagination/filtering/sorting.
  // The subscribedDeviceIds Set prevents duplicates within the same component instance.

  $: allSelected = props.records.length > 0 && props.records.every((d) => props.selectedDeviceIds?.includes(d.id));
</script>

<div class="w-full">
  <!-- Search/Filter Bar (match AppSelector pattern) -->
  <div class="p-4 border-b flex flex-wrap gap-2">
    <div class="w-1/3 min-w-[240px]">
      <DebouncedTextFilter
        placeholder="Search by device name..."
        value={localSearch}
        emitOnly={true}
        delay={0}
        on:change={handleSearchChange}
      />
    </div>
    <PopoverFilter
      label="Status"
      {options}
      selectedValues={localStatus ? [localStatus] : []}
      onChange={(values) => { localStatus = values[0] || null; emitFilter(); }}
    />
    <PopoverFilter
      label="Tags"
      options={tagOptions}
      selectedValues={localTag ? [localTag] : []}
      onChange={(values) => { localTag = values[0] || null; emitFilter(); }}
      searchable={true}
      singleSelect={true}
    />
  </div>
  

  
  <!-- Table with scrollable body -->
  <div class="overflow-y-auto max-h-[400px] border-t">
    <table class="w-full">
    <thead class="sticky top-0 bg-background z-10 border-b">
      <tr>
        <th class="text-left py-2 px-4 font-medium text-sm w-10">
                <button type="button" class="inline-flex" on:click|stopPropagation={() => dispatch('toggleSelectAllClick')} aria-label="Select all">
                  <Checkbox checked={allSelected} aria-label="Select all" />
                </button>
              </th>
        <th class="text-left p-3">
          <Button 
            variant="ghost" 
            class="p-0 font-medium text-sm flex items-center"
            on:click={() => handleSortClick('name')}
          >
            Name
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
        <th class="text-left p-3 w-16">Online</th>
        <th class="text-left p-3">
          <Button 
            variant="ghost" 
            class="p-0 font-medium text-sm flex items-center"
            on:click={() => handleSortClick('status')}
          >
            Status
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
        <th class="text-left p-3">
          <Button 
            variant="ghost" 
            class="p-0 font-medium text-sm flex items-center"
            on:click={() => handleSortClick('macAddress')}
          >
            MAC Address
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
        <th class="text-left p-3">
          <Button 
            variant="ghost" 
            class="p-0 font-medium text-sm flex items-center"
            on:click={() => handleSortClick('lastUsedAt')}
          >
            Last Used
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
      </tr>
    </thead>
            <tbody class="divide-y divide-border">
          {#if props.records.length === 0}
            <tr>
              <td colspan="6" class="text-center p-4 text-muted-foreground">
                No devices found
              </td>
            </tr>
          {:else}
            {#each props.records as device}
              <tr 
                class="hover:bg-muted/50 cursor-pointer"
                on:click={() => dispatch('rowClick', device)}
              >
            <td class="py-3 px-4 w-10">
              <button type="button" class="inline-flex" on:click|stopPropagation={() => dispatch('rowClick', device)}>
                <Checkbox checked={props.selectedDeviceIds?.includes(device.id)} />
              </button>
            </td>
            <td class="p-3 flex items-center gap-2">
              {device.name}
            </td>
            <td class="p-3">
              <OnlineDot online={!!device.connected} title={device.connected ? 'Online' : 'Offline'} />
            </td>
            <td class="p-3">
              <Badge variant={getStatusVariant(device.status)}>{device.status}</Badge>
            </td>
            <td class="p-3">
              <span class="font-mono text-sm">
                {device.macAddress || device.wifiMac || device.lanMac || 'N/A'}
              </span>
            </td>
            <td class="p-3">
              {#if device.lastUsedAt}
                <RelativeDate date={device.lastUsedAt} />
              {:else}
                <span class="text-muted-foreground">Never</span>
              {/if}
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
    </div>
</div>
