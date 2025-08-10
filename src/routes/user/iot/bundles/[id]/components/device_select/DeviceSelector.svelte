<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  // Remove URL-coupled stores; keep selector state internal
  import { Button } from '$lib/components/ui/button';
  import { X } from 'lucide-svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  // No navigation side-effects for internal pagination
  import { toast } from 'svelte-sonner';
  import DeviceTable from "./table.svelte";
  // Remove URL-mutating utilities; handle sort/pagination locally
  import { Skeleton } from '$lib/components/ui/skeleton';
  
  interface TableMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }
  
  interface TableData {
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
  }
  
  interface ApiResponse {
    devices: Device[];
    meta: TableMeta;
  }

  interface Device {
    id: string;
    name: string;
    status: string;
    model?: string;
    description?: string;
    createdAt?: string;
    lastUsedAt?: string;
  }

  export let bundleId: string;
  
  // Table data
  let tableData: TableData = {
    records: [],
    pagination: {
      page: 1,
      per_page: 5,
      total_records: 0,
      total_pages: 1
    },
    sort: {
      field: 'name',
      order: 'asc'
    },
    loading: false
  };
  
  // Local table state (decoupled from URL)
  let currentPage = 1;
  const perPage = 5;
  let sortField: keyof Device | 'lastUsedAt' | 'name' | 'status' = 'name';
  let sortOrder: 'asc' | 'desc' = 'asc';
  let filterSearch: string = '';
  let filterStatus: string | null = null;
  let controller: AbortController | null = null;

  // Load when dialog opens
  $: if (browser && open) {
    loadDevices();
  }
  
  // Initialize data loading when component mounts
  onMount(() => {
    if (browser && open) {
      loadDevices();
    }
  });
  
  async function loadDevices() {
    try {
      console.log('[DeviceSelector] Loading devices...');
      
      // Set loading state
      tableData = {
        ...tableData,
        loading: true
      };
      
      // Build params from local state only
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('per_page', String(perPage));
      params.append('sort', sortField);
      params.append('order', sortOrder);
      if (filterSearch) params.append('search', filterSearch);
      if (filterStatus) params.append('status', filterStatus);
      
      // Make the API request
      const apiUrl = `/api/user/iot/bundles/${bundleId}/components/device_select?${params}`;
      console.log('[DeviceSelector] Fetching from:', apiUrl);
      // Abort previous in-flight request to keep UI responsive
      if (controller) controller.abort();
      controller = new AbortController();
      const response = await fetch(apiUrl, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      console.log('[DeviceSelector] API response meta:', data?.meta, 'count:', data?.devices?.length);
      
      // Update table data with the response following standard pattern
      tableData = {
        ...tableData,
        loading: false,
        records: data.devices || [],
        pagination: {
          page: data.meta?.current_page || currentPage,
          per_page: data.meta?.per_page || perPage,
          total_records: data.meta?.total || 0,
          total_pages: data.meta?.last_page || 1
        },
        sort: {
          field: sortField,
          order: sortOrder
        }
      };
      
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      console.error('[DeviceSelector] Failed to load devices:', error);
      toast.error('Failed to load devices. Please try again.');
      tableData = {
        ...tableData,
        loading: false
      };
    }
  }
  
  export let open = false;
  
  let loading = false;
  let selectedDevices: Device[] = [];
  
  // Define events
  const dispatch = createEventDispatcher<{
    select: { id: string; name: string }[];
    close: void;
  }>();
  
  // Close the dialog
  function closeDialog() {
    open = false;
    selectedDevices = [];
    dispatch('close');
    // No URL cleanup necessary; state is internal
  }
  
  // Handle row click - toggle selection
  function handleRowClick(device: Device) {
    console.log('[DeviceSelector] row clicked', device?.id, device?.name);
    const existingIndex = selectedDevices.findIndex(d => d.id === device.id);
    if (existingIndex >= 0) {
      console.log('[DeviceSelector] unselect device', device?.id);
      selectedDevices = selectedDevices.filter(d => d.id !== device.id);
    } else {
      console.log('[DeviceSelector] select device', device?.id);
      selectedDevices = [...selectedDevices, device];
    }
    console.log('[DeviceSelector] selected count:', selectedDevices.length);
  }
  
  // Use standard table sort handler
  function handleTableSort(event: CustomEvent<{ field: string; order: 'asc'|'desc' }>) {
    console.log('[DeviceSelector] sort event', event.detail);
    sortField = event.detail.field as any;
    sortOrder = event.detail.order;
    currentPage = 1;
    loadDevices();
  }
  
  // Use standard table pagination handler
  function handleTablePagination(event: CustomEvent<{ page: number; per_page: number }>) {
    console.log('[DeviceSelector] pagination event', event.detail);
    currentPage = event.detail.page;
    // Force perPage to 5 regardless
    loadDevices();
  }

  function handleTableFilter(event: CustomEvent<{ search?: string; status?: string | null }>) {
    console.log('[DeviceSelector] filter event', event.detail);
    filterSearch = event.detail.search ?? '';
    filterStatus = event.detail.status ?? null;
    currentPage = 1;
    loadDevices();
  }
  
  // Handle confirm button click
  function handleConfirm() {
    console.log('[DeviceSelector] confirm clicked, selected:', selectedDevices.map(d => d.id));
    if (selectedDevices.length > 0) {
      // Dispatch select event with the selected devices
      dispatch('select', selectedDevices.map(device => ({ 
        id: device.id,
        name: device.name
      })));
      // Close the dialog
      closeDialog();
    }
  }
  
  // Handle cancel button click
  function handleCancel() {
    open = false;
    selectedDevices = [];
    dispatch('close');
  }
  
  // Handle dialog close
  function handleClose() {
    open = false;
    selectedDevices = [];
    dispatch('close');
    // Reset filters when closing modal
    filterSearch = '';
    filterStatus = null;
    currentPage = 1;
  }
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
  <Dialog.Content class="sm:max-w-4xl">
    <Dialog.Header>
      <Dialog.Title>Select Devices</Dialog.Title>
      <Dialog.Description>
        Choose devices to add to the bundle (click to select/deselect)
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Selected Devices Review Section -->
      {#if selectedDevices.length > 0}
        <div class="border rounded-md p-4 bg-muted/30">
          <h4 class="font-medium mb-3">Selected Devices ({selectedDevices.length})</h4>
          <div class="flex flex-wrap gap-2">
            {#each selectedDevices as device}
              <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                <span>{device.name}</span>
                <button 
                  type="button"
                  class="text-muted-foreground hover:text-destructive"
                  on:click={() => handleRowClick(device)}
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Available Devices Section -->
      <div>
        <h4 class="font-medium mb-3">Available Devices</h4>
        <div class="border rounded-md overflow-hidden">
            <DeviceTable
              props={{
                records: tableData.records,
                pagination: tableData.pagination,
                sort: tableData.sort,
                loading: tableData.loading,
                selectedDeviceIds: selectedDevices.map(d => d.id)
              }}
              on:rowClick={({ detail }) => {
                if (detail) {
                  handleRowClick(detail);
                }
              }}
              on:sort={handleTableSort}
              on:pagination={handleTablePagination}
              on:filter={handleTableFilter}
            />
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={handleClose}>
        Cancel
      </Button>
      <Button 
        on:click={handleConfirm} 
        disabled={selectedDevices.length === 0}
        class="ml-2"
      >
        Select
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
