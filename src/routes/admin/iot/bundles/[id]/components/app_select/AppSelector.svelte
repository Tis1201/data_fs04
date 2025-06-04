<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { X } from 'lucide-svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import AppTable from "./table.svelte";
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import type { Resource } from "@prisma/client";
  
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
  
  // Load apps when dialog opens or URL params change
  $: if (open) {
    loadApps();
  }
  
  // Watch for URL changes to reload data
  $: if (browser && open) {
    loadApps();
  }
  
  // Initialize component
  $: if (browser) {
    loadApps();
  }
  
  async function loadApps() {
    try {
      tableData.loading = true;
      
      // Get current URL params
      const params = new URLSearchParams();
      
      // Add pagination parameters safely
      if (tableData.pagination && tableData.pagination.page) {
        params.append('page', tableData.pagination.page.toString());
      } else {
        params.append('page', '1');
      }
      
      if (tableData.pagination && tableData.pagination.per_page) {
        params.append('per_page', tableData.pagination.per_page.toString());
      } else {
        params.append('per_page', '10');
      }
      
      // Add sort parameters
      if (tableData.sort && tableData.sort.field) {
        params.append('sort', tableData.sort.field);
        params.append('order', tableData.sort.order || 'asc');
      }
      
      // Add search parameters if they exist
      const search = $page.url.searchParams.get('search');
      if (search) params.append('search', search);
      
      const types = $page.url.searchParams.get('types');
      if (types) params.append('types', types);
      
      const statuses = $page.url.searchParams.get('statuses');
      if (statuses) params.append('statuses', statuses);
      
      // Make the API request
      console.log(`Making API request to: /admin/iot/bundles/${bundleId}/components/app_select?${params}`);
      const response = await fetch(`/admin/iot/bundles/${bundleId}/components/app_select?${params}`);
      
      if (!response.ok) {
        console.error(`API request failed with status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('API response status:', response.status);
      
      const data: ApiResponse = await response.json();
      
      console.log('API Response:', data);
      console.log('Resources count:', data.resources?.length || 0);
      
      // Update table data with the response
      tableData = {
        ...tableData,
        records: data.resources,
        pagination: {
          ...tableData.pagination,
          page: data.meta.current_page,
          per_page: data.meta.per_page,
          total_records: data.meta.total,
          total_pages: data.meta.last_page
        }
      };
      
    } catch (error) {
      console.error('Failed to load apps:', error);
      toast.error('Failed to load apps. Please try again.');
    } finally {
      tableData.loading = false;
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
  
  // Filter states have been moved to table.svelte
  
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
  
  // Handle table sort
  function handleTableSort(event: CustomEvent) {
    const { field, order } = event.detail;
    
    // Update local state
    tableData = {
      ...tableData,
      sort: { field, order },
      pagination: {
        ...tableData.pagination,
        page: 1 // Reset to first page when sorting changes
      }
    };
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('sort', field);
    url.searchParams.set('order', order);
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true, noScroll: true });
  }
  
  // Handle table pagination
  function handleTablePagination(event: CustomEvent) {
    const { page, per_page } = event.detail;
    
    // Update local state
    tableData = {
      ...tableData,
      pagination: {
        ...tableData.pagination,
        page,
        per_page
      }
    };
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', per_page.toString());
    goto(url.toString(), { replaceState: true, noScroll: true });
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

      <div class="mt-4 border rounded-md overflow-hidden">
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