<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Search, ArrowUpDown } from 'lucide-svelte';
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import Pagination from "$lib/components/ui_components_sveltekit/table/pagination/Pagination.svelte";
  
  interface Device {
    id: string;
    name: string;
    status: string;
    lastSeen?: string;
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
    selectedDeviceId?: string;
  }
  
  export let props: TableProps;
  
  // Create event dispatcher
  const dispatch = createEventDispatcher<{
    rowClick: Device;
    sort: { field: string; order: 'asc' | 'desc' };
    pagination: { page: number; per_page: number };
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
  function getStatusVariant(status: string) {
    const statusMap = {
      'ONLINE': 'success',
      'OFFLINE': 'destructive',
      'IDLE': 'outline'
    };
    return statusMap[status] || 'outline';
  }
  
  // Handle search input
  let searchTerm = '';
  function handleSearch() {
    // Update URL with search term
    const url = new URL(window.location.href);
    if (searchTerm) {
      url.searchParams.set('search', searchTerm);
    } else {
      url.searchParams.delete('search');
    }
    url.searchParams.set('page', '1'); // Reset to first page on search
    window.history.pushState({}, '', url.toString());
    
    // Trigger reload via parent
    dispatch('sort', { field: props.sort.field, order: props.sort.order });
  }
  
  // Handle pagination change
  function handlePaginationChange(event: CustomEvent) {
    dispatch('pagination', event.detail);
  }
</script>

<div class="w-full">
  <!-- Search Bar -->
  <div class="p-4 border-b">
    <form on:submit|preventDefault={handleSearch} class="flex gap-2">
      <Input 
        type="text" 
        placeholder="Search devices..." 
        bind:value={searchTerm}
        class="flex-1"
      />
      <Button type="submit" variant="outline">
        <Search class="h-4 w-4 mr-2" />
        Search
      </Button>
    </form>
  </div>
  
  <!-- Table -->
  <table class="w-full">
    <thead>
      <tr class="border-b">
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
            on:click={() => handleSortClick('lastSeen')}
          >
            Last Seen
            <ArrowUpDown class="ml-2 h-4 w-4" />
          </Button>
        </th>
      </tr>
    </thead>
    <tbody>
      {#if props.records.length === 0}
        <tr>
          <td colspan="3" class="text-center p-4 text-muted-foreground">
            No devices found
          </td>
        </tr>
      {:else}
        {#each props.records as device}
          <tr 
            class="border-b hover:bg-muted/50 cursor-pointer"
            class:bg-muted={props.selectedDeviceId === device.id}
            on:click={() => handleRowClick(device)}
          >
            <td class="p-3">{device.name}</td>
            <td class="p-3">
              <Badge variant={getStatusVariant(device.status)}>{device.status}</Badge>
            </td>
            <td class="p-3">
              {#if device.lastSeen}
                <RelativeDate date={device.lastSeen} />
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
      currentPage={props.pagination.page}
      totalPages={props.pagination.total_pages}
      totalRecords={props.pagination.total_records}
      perPage={props.pagination.per_page}
      on:change={handlePaginationChange}
    />
  </div>
</div>
