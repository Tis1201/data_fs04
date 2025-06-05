<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { X } from 'lucide-svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import { goto } from "$app/navigation";
  import { toast } from 'svelte-sonner';
  import DeviceTable from "./table.svelte";
  import { handleTableSort as utilHandleTableSort, handleTablePagination as utilHandleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
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
    lastSeen?: string;
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
  
  // Single reactive statement to handle all loading conditions
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
      // Set loading state
      tableData = {
        ...tableData,
        loading: true
      };
      
      // Get current URL params from the page URL
      const currentUrl = $page.url;
      const params = new URLSearchParams();
      
      // Add pagination parameters - always use 5 per page
      const urlPage = currentUrl.searchParams.get('page');
      
      const page = urlPage ? parseInt(urlPage) : tableData.pagination?.page || 1;
      // Always use 5 per page
      const perPage = 5;
      
      params.append('page', page.toString());
      params.append('per_page', '5');
      
      // Add sort parameters - prefer URL values over state values
      const urlSort = currentUrl.searchParams.get('sort');
      const urlOrder = currentUrl.searchParams.get('order');
      
      const sortField = urlSort || tableData.sort?.field || 'name';
      const sortOrder = urlOrder || tableData.sort?.order || 'asc';
      
      params.append('sort', sortField);
      params.append('order', sortOrder);
      
      // Add filter parameters if they exist
      const search = currentUrl.searchParams.get('search');
      if (search) params.append('search', search);
      
      const status = currentUrl.searchParams.get('status');
      if (status) params.append('status', status);
      
      // Make the API request
      const response = await fetch(`/admin/iot/bundles/${bundleId}/components/device_select?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      // Update table data with the response following standard pattern
      tableData = {
        ...tableData,
        loading: false,
        records: data.devices || [],
        pagination: {
          page: data.meta?.current_page || 1,
          per_page: data.meta?.per_page || 5,
          total_records: data.meta?.total || 0,
          total_pages: data.meta?.last_page || 1
        },
        sort: {
          field: $page.url.searchParams.get('sort') || 'name',
          order: ($page.url.searchParams.get('order') as 'asc' | 'desc') || 'asc'
        }
      };
      
    } catch (error) {
      console.error('Failed to load devices:', error);
      toast.error('Failed to load devices. Please try again.');
      tableData = {
        ...tableData,
        loading: false
      };
    }
  }
  
  export let open = false;
  
  let loading = false;
  let selectedDevice: Device | null = null;
  
  // Define events
  const dispatch = createEventDispatcher<{
    select: { id: string; name: string };
    close: void;
  }>();
  
  // Close the dialog
  function closeDialog() {
    open = false;
    selectedDevice = null;
    dispatch('close');
  }
  
  // Handle row click
  function handleRowClick(device: Device) {
    selectedDevice = device;
    // Dispatch select event with the selected device
    dispatch('select', { 
      id: device.id, 
      name: device.name
    });
    // Close the dialog
    closeDialog();
  }
  
  // Use standard table sort handler
  function handleTableSort(event: CustomEvent) {
    // Use standard utility function for URL update and navigation
    utilHandleTableSort(event, true);
    
    // Reload data after URL update
    loadDevices();
  }
  
  // Use standard table pagination handler
  function handleTablePagination(event: CustomEvent) {
    // Override the per_page in the event detail to always use 5
    const modifiedEvent = new CustomEvent('pagination', {
      detail: { ...event.detail, per_page: 5 }
    });
    
    // Use standard utility function for URL update and navigation
    utilHandleTablePagination(modifiedEvent, 'deviceSelectorPageSize', true);
    
    // Reload data after URL update
    loadDevices();
  }
  
  // Handle confirm button click
  function handleConfirm() {
    if (selectedDevice) {
      // Dispatch select event with the selected device
      dispatch('select', { 
        id: selectedDevice.id,
        name: selectedDevice.name
      });
      // Close the dialog
      closeDialog();
    }
  }
  
  // Handle cancel button click
  function handleCancel() {
    closeDialog();
  }
  
  // Handle dialog close
  function handleClose() {
    closeDialog();
  }
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
  <Dialog.Content class="sm:max-w-4xl">
    <Dialog.Header>
      <Dialog.Title>Select a Device</Dialog.Title>
      <Dialog.Description>
        Choose a device to add to the bundle
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Table Container - Following standard pattern from factory tokens -->
      <div class="mt-4 border rounded-md overflow-hidden">
        {#if tableData.loading}
          <div class="p-4 space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-4 w-2/3" />
            <Skeleton class="h-4 w-3/4" />
          </div>
        {:else}
          <DeviceTable
            props={{
              records: tableData.records,
              pagination: tableData.pagination,
              sort: tableData.sort,
              loading: tableData.loading,
              selectedDeviceId: selectedDevice?.id
            }}
            on:rowClick={({ detail }) => {
              if (detail) {
                handleRowClick(detail);
              }
            }}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
          />
        {/if}
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={handleClose}>
        Cancel
      </Button>
      <Button 
        on:click={handleConfirm} 
        disabled={!selectedDevice}
        class="ml-2"
      >
        Select
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
