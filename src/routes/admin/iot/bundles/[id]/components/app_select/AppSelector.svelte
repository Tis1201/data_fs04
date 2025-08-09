<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  // Remove URL-coupled store usage; internalize state
  import { Button } from '$lib/components/ui/button';
  import { X } from 'lucide-svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  // No navigation side-effects for internal pagination
  import { toast } from 'svelte-sonner';
  import AppTable from "./table.svelte";
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import type { Resource } from "@prisma/client";
  // Remove URL-mutating utilities; handle sort/pagination locally
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
  
  // Local table state (decoupled from URL)
  let currentPage = 1;
  const perPage = 5;
  let sortField: keyof Resource | 'name' = 'name';
  let sortOrder: 'asc' | 'desc' = 'asc';
  let filterSearch: string = '';
  let filterFormats: string[] = [];
  let controller: AbortController | null = null;

  // Load when dialog opens
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
      
      // Build params from local state only
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('per_page', String(perPage));
      params.append('sort', sortField);
      params.append('order', sortOrder);
      if (filterSearch) params.append('search', filterSearch);
      if (filterFormats.length > 0) params.append('formats', filterFormats.join(','));
      
      // Make the API request
      // Abort previous in-flight request to keep UI responsive
      if (controller) controller.abort();
      controller = new AbortController();
      const response = await fetch(`/admin/iot/bundles/${bundleId}/components/app_select?${params}`, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      // Update table data with the response following standard pattern
      const metaPag = (data as any)?.meta?.pagination ?? {
        page: currentPage,
        per_page: perPage,
        total_records: 0,
        total_pages: 1
      };
      tableData = {
        ...tableData,
        loading: false,
        records: data.resources || [],
        pagination: {
          page: metaPag.page,
          per_page: metaPag.per_page,
          total_records: metaPag.total_records,
          total_pages: metaPag.total_pages
        },
        sort: {
          field: sortField,
          order: sortOrder
        }
      };
      
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
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
  let selectedResources: Resource[] = [];
  
  // Define events
  const dispatch = createEventDispatcher<{
    select: { id: string; name: string; autoOpen: boolean }[];
    close: void;
    autoOpenChange: boolean;
  }>();
  
  // Close the dialog
  function closeDialog() {
    open = false;
    selectedResources = [];
    dispatch('close');
    // No URL cleanup necessary; state is internal
  }
  
  // Handle row click - toggle selection
  function handleRowClick(resource: Resource) {
    const idx = selectedResources.findIndex(r => r.id === resource.id);
    if (idx >= 0) {
      selectedResources = selectedResources.filter(r => r.id !== resource.id);
    } else {
      selectedResources = [...selectedResources, resource];
    }
  }
  
  // Use standard table sort handler
  function handleTableSort(event: CustomEvent<{ field: string; order: 'asc'|'desc' }>) {
    sortField = event.detail.field as any;
    sortOrder = event.detail.order;
    currentPage = 1;
    loadApps();
  }
  
  // Use standard table pagination handler
  function handleTablePagination(event: CustomEvent<{ page: number; per_page: number }>) {
    currentPage = event.detail.page;
    loadApps();
  }

  function handleTableFilter(event: CustomEvent<{ search?: string; formats?: string[] }>) {
    filterSearch = event.detail.search ?? '';
    filterFormats = event.detail.formats ?? [];
    currentPage = 1;
    loadApps();
  }
  
  // Handle confirm button click
  function handleConfirm() {
    if (selectedResources.length > 0) {
      dispatch('select', selectedResources.map(r => ({ id: r.id, name: r.name, autoOpen })));
      // Optimistically clear local selection and reload list so selected items disappear
      selectedResources = [];
      loadApps();
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
    // Reset filters when closing modal
    filterSearch = '';
    filterFormats = [];
    currentPage = 1;
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
        <Switch id="autoOpen" bind:checked={autoOpen} />
        <Label for="autoOpen">Automatically open app after installation</Label>
      </div>

      <!-- Selected Apps Review Section -->
      {#if selectedResources.length > 0}
        <div class="border rounded-md p-4 bg-muted/30">
          <h4 class="font-medium mb-3">Selected Apps ({selectedResources.length})</h4>
          <div class="flex flex-wrap gap-2">
            {#each selectedResources as res}
              <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                <span>{res.name}</span>
                <button 
                  type="button"
                  class="text-muted-foreground hover:text-destructive"
                  on:click={() => handleRowClick(res)}
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Table Container - Following standard selector pattern -->
      <div class="mt-4 border rounded-md overflow-hidden">
          <AppTable
            props={{
              records: tableData.records,
              pagination: tableData.pagination,
              sort: tableData.sort,
              loading: tableData.loading,
              selectedResourceIds: selectedResources.map(r => r.id)
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

    <Dialog.Footer>
      <Button variant="outline" on:click={handleClose}>
        Cancel
      </Button>
      <Button 
        on:click={handleConfirm} 
        disabled={selectedResources.length === 0}
        class="ml-2"
      >
        Select {selectedResources.length > 0 ? `(${selectedResources.length})` : ''}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>