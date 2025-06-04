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
  import AppTable from "./table.svelte";
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import type { Resource } from "@prisma/client";
  import { handleTableSort as utilHandleTableSort, handleTablePagination as utilHandleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
  import { Skeleton } from '$lib/components/ui/skeleton';
  
  interface TableMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }
  
  interface TableData {
    records: Resource[];
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
    resources: Resource[];
    meta: TableMeta;
  }

  export let bundleId: string;
  export let autoOpen = false;
  
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
    loadApps();
  }
  
  // Initialize data loading when component mounts
  onMount(() => {
    if (browser && open) {
      loadApps();
    }
  });
  
  async function loadApps() {
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
      
      const types = currentUrl.searchParams.get('types');
      if (types) params.append('types', types);
      
      // Make the API request
      const response = await fetch(`/admin/iot/bundles/${bundleId}/components/app_select?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      // Update table data with the response following standard pattern
      tableData = {
        ...tableData,
        loading: false,
        records: data.resources || [],
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
      console.error('Failed to load apps:', error);
      toast.error('Failed to load apps. Please try again.');
      tableData = {
        ...tableData,
        loading: false
      };
    }
  }
  export let open = false;
  
  let loading = false;
  let selectedResource: Resource | null = null;
  
  // Define events
  const dispatch = createEventDispatcher<{
    select: { id: string; name: string; autoOpen: boolean };
    close: void;
    autoOpenChange: boolean;
  }>();
  
  // Close the dialog
  function closeDialog() {
    open = false;
    selectedResource = null;
    dispatch('close');
  }
  
  // Handle row click
  function handleRowClick(resource: Resource) {
    selectedResource = resource;
    // Dispatch select event with the selected resource
    dispatch('select', { 
      id: resource.id, 
      name: resource.name, 
      autoOpen 
    });
    // Close the dialog
    closeDialog();
  }
  
  // Use standard table sort handler
  function handleTableSort(event: CustomEvent) {
    // Use standard utility function for URL update and navigation
    utilHandleTableSort(event, true);
    
    // Reload data after URL update
    loadApps();
  }
  
  // Use standard table pagination handler
  function handleTablePagination(event: CustomEvent) {
    // Override the per_page in the event detail to always use 5
    const modifiedEvent = new CustomEvent('pagination', {
      detail: { ...event.detail, per_page: 5 }
    });
    
    // Use standard utility function for URL update and navigation
    utilHandleTablePagination(modifiedEvent, 'appSelectorPageSize', true);
    
    // Reload data after URL update
    loadApps();
  }
  
  // Handle confirm button click
  function handleConfirm() {
    if (selectedResource) {
      // Dispatch select event with the selected resource and autoOpen setting
      dispatch('select', { 
        id: selectedResource.id,
        name: selectedResource.name,
        autoOpen 
      });
      // Close the dialog
      closeDialog();
    }
  }
  
  // Handle autoOpen toggle
  function handleAutoOpenChange(e: CustomEvent<boolean>) {
    autoOpen = e.detail;
    dispatch('autoOpenChange', autoOpen);
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
      <Dialog.Title>Select an App</Dialog.Title>
      <Dialog.Description>
        Choose an app to add to the bundle
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Auto Open Toggle -->
      <div class="flex items-center space-x-2 px-4">
        <Switch
          id="autoOpen"
          checked={autoOpen}
          on:change={handleAutoOpenChange}
        />
        <Label for="autoOpen">Automatically open app after installation</Label>
      </div>

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
          <AppTable
            props={{
              records: tableData.records,
              pagination: tableData.pagination,
              sort: tableData.sort,
              loading: tableData.loading,
              selectedResourceId: selectedResource?.id
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
        disabled={!selectedResource}
        class="ml-2"
      >
        Select
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>