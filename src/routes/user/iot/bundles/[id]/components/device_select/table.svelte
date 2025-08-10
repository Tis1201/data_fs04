<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Search, ArrowUpDown } from 'lucide-svelte';
  import DebouncedTextFilter from '$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte';
  import PopoverFilter from '$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte';
  // URL and $page are not used; keep state internal
  const options = [
    { label: 'Online', value: 'ONLINE' },
    { label: 'Offline', value: 'OFFLINE' }
  ];
import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
import Pagination from "$lib/components/ui_components_sveltekit/table/pagination/Pagination.svelte";
  
  interface Device {
    id: string;
    name: string;
    status: string;
    model?: string;
    description?: string;
    createdAt?: string;
    lastUsedAt?: string;
  }
  
  interface TableProps {
    records: Device[];
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
  
  // Create event dispatcher
  const dispatch = createEventDispatcher<{
    rowClick: Device;
    sort: { field: string; order: 'asc' | 'desc' };
    pagination: { page: number; per_page: number };
    filter: { search?: string; status?: string | null };
  }>();
  
  // Handle row click
  function handleRowClick(device: Device) {
    dispatch('rowClick', device);
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
      ONLINE: 'success',
      OFFLINE: 'destructive',
      IDLE: 'outline'
    };
    return statusMap[status] ?? 'outline';
  }
  
  // Internal filter state; emit to parent
  let localSearch = '';
  let localStatus: string | null = null;
  function emitFilter() {
    dispatch('filter', { search: localSearch, status: localStatus });
  }

  function handleSearchChange(e: CustomEvent) {
    const detail: any = (e as any).detail;
    localSearch = typeof detail === 'string' ? detail : '';
    emitFilter();
  }
  
  // Handle pagination change
  function handlePaginationChange(event: CustomEvent) {
    console.log('[DeviceTable] pagination change', event.detail);
    dispatch('pagination', event.detail);
  }
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
  </div>
  

  
  <!-- Table -->
  <table class="w-full">
    <thead>
      <tr class="border-b">
        <th class="w-10 p-3"></th>
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
            on:click={() => handleSortClick('lastUsedAt')}
          >
            Last Used
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
      </tr>
    </thead>
    <tbody>
      {#if props.records.length === 0}
        <tr>
          <td colspan="4" class="text-center p-4 text-muted-foreground">
            No devices found
          </td>
        </tr>
      {:else}
        {#each props.records as device}
          <tr 
            class="border-b hover:bg-muted/50 cursor-pointer"
            on:click={() => dispatch('rowClick', device)}
          >
            <td class="p-3">
              <button type="button" class="inline-flex" on:click|stopPropagation={() => dispatch('rowClick', device)}>
                <Checkbox
                  checked={props.selectedDeviceIds?.includes(device.id)}
                  aria-label={`Select ${device.name}`}
                />
              </button>
            </td>
            <td class="p-3 flex items-center gap-2">
              {device.name}
            </td>
            <td class="p-3">
              <Badge variant={getStatusVariant(device.status)}>{device.status}</Badge>
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
  
  <!-- Pagination -->
  <div class="p-4 border-t">
    <Pagination
      pagination={props.pagination}
      emitOnly={true}
      on:change={handlePaginationChange}
    />
  </div>
</div>
