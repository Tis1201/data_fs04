<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Popover from "$lib/components/ui/popover";
    import * as Select from "$lib/components/ui/select";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Label } from "$lib/components/ui/label";
    import { Separator } from "$lib/components/ui/separator";
    import { Trash, Plus, Smartphone, Wifi, WifiOff, Info, ArrowUpDown, Filter, Check, X } from 'lucide-svelte';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Input } from "$lib/components/ui/input";
    import { Search } from "lucide-svelte";
    
    import type { BundleDevice } from "@prisma/client";
    import DeviceSelector from "../device_select/DeviceSelector.svelte";
    import { page } from "$app/stores";
    
    export let bundleId: string;
    export let devices: (BundleDevice & { device: { name: string, id: string, model?: string, status?: string } })[] = [];
    export let loading = false;
    

    
    // Use real data from API
    $: displayDevices = devices;
    
    // Filter state
    let searchTerm = '';
    let filterOpen = false;
    type BundleStatus = 'PENDING' | 'INCLUDED' | 'EXCLUDED';
    type OnlineStatus = 'ONLINE' | 'OFFLINE';
    type FilterState = {
        status: Record<BundleStatus, boolean>;
        deviceStatus: Record<OnlineStatus, boolean>;
        model: Record<string, boolean>;
    };
    const bundleStatusKeys: BundleStatus[] = ['PENDING', 'INCLUDED', 'EXCLUDED'];
    const onlineStatusKeys: OnlineStatus[] = ['ONLINE', 'OFFLINE'];
    let filters: FilterState = {
        status: { PENDING: false, INCLUDED: false, EXCLUDED: false },
        deviceStatus: { ONLINE: false, OFFLINE: false },
        model: {}
    };
    
    // Extract unique models for filtering
    $: {
        const modelSet: Set<string> = new Set();
        displayDevices.forEach(d => {
            if (d.device.model) {
                modelSet.add(d.device.model);
                const model = d.device.model;
                if (filters.model[model] === undefined) {
                    filters.model[model] = false;
                }
            }
        });
    }
    
    // Check if any filters are active
    $: activeFilters = Object.values(filters.status).some(v => v) || 
                       Object.values(filters.deviceStatus).some(v => v) || 
                       Object.values(filters.model).some(v => v);
    
    // Apply filters
    $: filteredDevices = displayDevices.filter(d => {
        // Text search filter
        const matchesSearch = !searchTerm || 
            d.device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.status.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        
        // If no filters are active, show all
        if (!activeFilters) return true;
        
        // Status filter
        const statusFiltersActive = Object.values(filters.status).some(v => v);
        const matchesStatus = !statusFiltersActive || filters.status[d.status as BundleStatus];
        
        // Device status filter
        const deviceStatusFiltersActive = Object.values(filters.deviceStatus).some(v => v);
        const matchesDeviceStatus = !deviceStatusFiltersActive || 
            (d.device.status && filters.deviceStatus[d.device.status as OnlineStatus]);
        
        // Model filter
        const modelFiltersActive = Object.values(filters.model).some(v => v);
        const matchesModel = !modelFiltersActive || 
            (d.device.model && filters.model[d.device.model]);
        
        return matchesStatus && matchesDeviceStatus && matchesModel;
    });
    
    // Reset all filters
    function resetFilters() {
        (Object.keys(filters.status) as BundleStatus[]).forEach(key => filters.status[key] = false);
        (Object.keys(filters.deviceStatus) as OnlineStatus[]).forEach(key => filters.deviceStatus[key] = false);
        Object.keys(filters.model).forEach(key => filters.model[key] = false);
        filterOpen = false;
    }
    
    // Sorting functionality
    let sortField = 'device.name';
    let sortOrder: 'asc' | 'desc' = 'asc';
    
    function toggleSort(field: string) {
        if (sortField === field) {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortOrder = 'asc';
        }
    }
    
    $: sortedDevices = [...filteredDevices].sort((a, b) => {
        let valA, valB;
        
        if (sortField === 'device.name') {
            valA = a.device.name;
            valB = b.device.name;
        } else if (sortField === 'device.model') {
            valA = a.device.model || '';
            valB = b.device.model || '';
        } else if (sortField === 'device.status') {
            valA = a.device.status || '';
            valB = b.device.status || '';
        } else if (sortField === 'status') {
            valA = a.status;
            valB = b.status;
        } else if (sortField === 'createdAt') {
            valA = a.createdAt;
            valB = b.createdAt;
            // For dates, we need to compare timestamps
            return sortOrder === 'asc' ? 
                new Date(valA).getTime() - new Date(valB).getTime() : 
                new Date(valB).getTime() - new Date(valA).getTime();
        }
        
        // For strings, use localeCompare
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortOrder === 'asc' ? 
                valA.localeCompare(valB) : 
                valB.localeCompare(valA);
        }
        
        return 0;
    });
    
    // State for add device dialog
    let addDialogOpen = false;
    let addingDevice = false;

  // Selection state for batch actions
  let selectedIds: string[] = [];
  $: allSelected = sortedDevices.length > 0 && sortedDevices.every((d) => selectedIds.includes(d.id));

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = [];
    } else {
      selectedIds = sortedDevices.map((d) => d.id);
    }
  }

  function toggleRowSelection(bundleDeviceId: string) {
    if (selectedIds.includes(bundleDeviceId)) {
      selectedIds = selectedIds.filter((id) => id !== bundleDeviceId);
    } else {
      selectedIds = [...selectedIds, bundleDeviceId];
    }
  }

  async function batchRemoveSelected() {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`Remove ${selectedIds.length} device(s) from this bundle?`);
    if (!confirmed) return;

    try {
      const promises = selectedIds.map((bundleDeviceId) =>
        api_delete(`/api/admin/iot/bundles/${bundleId}/devices/${bundleDeviceId}`, bundleDeviceId)
      );
      await Promise.all(promises);
      toast.success(`Removed ${selectedIds.length} device(s) from bundle`);
      selectedIds = [];
      await invalidate('app:bundle');
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove selected devices');
    }
  }
    
    // State for delete confirmation dialog
    let deleteDialogState = {
        selectedRecord: null as (BundleDevice & { device: { name: string, id: string } }) | null,
        confirmationOpen: false,
        title: "Remove Device",
        message: "Are you sure you want to remove this device from the bundle? This action cannot be undone.",
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel"
    };
    
    // Function to open delete confirmation dialog
    function confirmDelete(bundleDevice: BundleDevice & { device: { name: string, id: string } }) {
        deleteDialogState.selectedRecord = bundleDevice;
        deleteDialogState.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        if (!deleteDialogState.selectedRecord) return;
        
        try {
            await api_delete(`/api/admin/iot/bundles/${bundleId}/devices/${deleteDialogState.selectedRecord.id}`,
                deleteDialogState.selectedRecord.id);
            toast.success("Device removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove device from bundle");
            console.error(error);
        } finally {
            deleteDialogState.confirmationOpen = false;
            deleteDialogState.selectedRecord = null;
        }
    }
    
    // Handle device selection from DeviceSelector
    async function handleDeviceSelect(event: CustomEvent<{ id: string; name: string }[]>) {
        const devices = event.detail;
        if (!devices || devices.length === 0) return;
        
        addingDevice = true;
        
        try {
            // Add multiple devices
            const promises = devices.map(device => 
                api_post(`/api/admin/iot/bundles/${bundleId}/devices`, {
                    deviceId: device.id,
                    status: "PENDING"
                })
            );
            
            await Promise.all(promises);
            
            toast.success(`Added ${devices.length} device${devices.length !== 1 ? 's' : ''} to bundle`);
            await invalidate('app:bundle');
            
            // Reset form and close dialog
            addDialogOpen = false;
            
        } catch (error) {
            toast.error("Failed to add devices to bundle");
            console.error(error);
        } finally {
            addingDevice = false;
        }
    }
    
    // Function to get badge variant based on status
    type BundleBadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'success';
    function getStatusVariant(status: string): BundleBadgeVariant {
        const statusMap: Record<string, BundleBadgeVariant> = {
            PENDING: 'outline',
            INCLUDED: 'success',
            EXCLUDED: 'destructive'
        };
        return statusMap[status] || 'outline';
    }
    
    // Function to get device status badge variant
    type DeviceBadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'success';
    function getDeviceStatusVariant(status: string): DeviceBadgeVariant {
        const statusMap: Record<string, DeviceBadgeVariant> = {
            ONLINE: 'success',
            OFFLINE: 'destructive',
            IDLE: 'secondary'
        };
        return statusMap[status] || 'secondary';
    }
</script>

<!-- Bundle Devices Controls (count + add) -->
<div class="flex justify-between items-center mb-2">
    <div>
        <p class="text-sm text-muted-foreground">{filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''} in this bundle</p>
    </div>
</div>

  {#if selectedIds.length > 0}
    <div class="flex items-center justify-between mb-3 p-2 border rounded-md bg-muted/40">
      <div class="text-sm">{selectedIds.length} selected</div>
      <div class="flex items-center gap-2">
        <Button variant="destructive" size="sm" on:click={batchRemoveSelected}>Remove Selected</Button>
      </div>
    </div>
  {/if}

<!-- Search and Filter Bar -->
<!-- <div class="flex items-center space-x-2 mb-4">
    <div class="relative flex-1">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
            type="search" 
            placeholder="Search devices..." 
            class="pl-8" 
            bind:value={searchTerm}
        />
    </div>
</div> -->

<!-- Device Selector Dialog -->
<DeviceSelector 
    bind:open={addDialogOpen}
    {bundleId}
    on:select={handleDeviceSelect}
    on:close={() => addDialogOpen = false}
/>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    state={deleteDialogState}
    onConfirm={handleDeleteConfirm}
    useFormSubmission={false}
    getDescription={(record) => `Are you sure you want to remove ${record?.device?.name || 'this device'} from the bundle? This action cannot be undone.`}
/>

<!-- Device List Table -->
<!-- <div class="w-full mt-1 border rounded-md overflow-hidden"> -->
    {#if loading}
        <div class="space-y-2 p-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
        </div>
    {:else}
        <div class="flex justify-between items-center mb-4">
            <div class="relative w-72">
                <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Search devices..." 
                    class="pl-8 w-full" 
                    bind:value={searchTerm}
                />
            </div>
            <div class="flex items-center gap-2">
                <Popover.Root bind:open={filterOpen}>
                    <Popover.Trigger>
                        <div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                class="flex items-center gap-1 {activeFilters ? 'bg-primary/10 border-primary' : ''}"
                            >
                                <Filter class="h-4 w-4" />
                                Filter
                                {#if activeFilters}
                                    <Badge variant="secondary" class="ml-1 h-5 px-1">
                                        {Object.values(filters.status).filter(v => v).length + 
                                         Object.values(filters.deviceStatus).filter(v => v).length +
                                         Object.values(filters.model).filter(v => v).length}
                                    </Badge>
                                {/if}
                            </Button>
                        </div>
                    </Popover.Trigger>
                    <Popover.Content class="w-80 p-0" align="end">
                        <div class="p-4 pb-0">
                            <h4 class="font-medium leading-none mb-2">Filter Devices</h4>
                            <p class="text-sm text-muted-foreground">Select options to filter the device list.</p>
                        </div>
                        
                        <div class="p-4">
                    <h5 class="text-sm font-medium mb-2">Bundle Status</h5>
                    <div class="grid grid-cols-1 gap-2">
                        {#each bundleStatusKeys as status}
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="status-{status}" 
                                    bind:checked={filters.status[status]} 
                                />
                                <Label for="status-{status}" class="text-sm font-normal">
                                    {status === 'INCLUDED' ? 'Included' : 
                                     status === 'EXCLUDED' ? 'Excluded' : 'Pending'}
                                </Label>
                            </div>
                        {/each}
                    </div>
                </div>
                
                <Separator />
                
                <div class="p-4">
                    <h5 class="text-sm font-medium mb-2">Device Status</h5>
                    <div class="grid grid-cols-1 gap-2">
                        {#each onlineStatusKeys as status}
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="device-status-{status}" 
                                    bind:checked={filters.deviceStatus[status]} 
                                />
                                <Label for="device-status-{status}" class="text-sm font-normal">
                                    {status === 'ONLINE' ? 'Online' : 'Offline'}
                                </Label>
                            </div>
                        {/each}
                    </div>
                </div>
                
                {#if Object.keys(filters.model).length > 0}
                    <Separator />
                    <div class="p-4">
                        <h5 class="text-sm font-medium mb-2">Device Model</h5>
                        <div class="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                            {#each Object.keys(filters.model) as model}
                                <div class="flex items-center space-x-2">
                                    <Checkbox 
                                        id="model-{model}" 
                                        bind:checked={filters.model[model]} 
                                    />
                                    <Label for="model-{model}" class="text-sm font-normal">
                                        {model}
                                    </Label>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
                
                <div class="flex items-center justify-between p-4 pt-0">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        on:click={resetFilters}
                        disabled={!activeFilters}
                    >
                        Reset
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        on:click={() => filterOpen = false}
                    >
                        <Check class="h-4 w-4 mr-1" /> Apply
                    </Button>
                </div>
            </Popover.Content>
                </Popover.Root>
                <Button on:click={() => addDialogOpen = true} variant="outline" class="flex items-center gap-1" disabled={($page?.data?.bundle?.status || '').toUpperCase() !== 'DRAFT'} title={($page?.data?.bundle?.status || '').toUpperCase() !== 'DRAFT' ? 'Not editable: bundle already published' : undefined}>
                    <Plus class="h-4 w-4 mr-2" />
                    Add Device
                </Button>
            </div>
        </div>

        <table class="w-full border-collapse">
            <thead>
                <tr class="border-b bg-muted/50">
              <th class="text-left py-2 px-4 font-medium text-sm w-10">
                <button type="button" class="inline-flex" on:click|stopPropagation={toggleSelectAll} aria-label="Select all">
                  <Checkbox checked={allSelected} aria-label="Select all" />
                </button>
              </th>
                    <th class="text-left py-2 px-4 font-medium text-sm">
                        <button 
                            class="flex items-center space-x-1 hover:text-primary" 
                            on:click={() => toggleSort('device.name')}
                        >
                            <span>Device</span>
                            <ArrowUpDown class="h-3.5 w-3.5" />
                        </button>
                    </th>
                    <th class="text-left py-2 px-4 font-medium text-sm">
                        <button 
                            class="flex items-center space-x-1 hover:text-primary" 
                            on:click={() => toggleSort('device.model')}
                        >
                            <span>Model</span>
                            <ArrowUpDown class="h-3.5 w-3.5" />
                        </button>
                    </th>
                    <th class="text-left py-2 px-4 font-medium text-sm">
                        <button 
                            class="flex items-center space-x-1 hover:text-primary" 
                            on:click={() => toggleSort('device.status')}
                        >
                            <span>Device Status</span>
                            <ArrowUpDown class="h-3.5 w-3.5" />
                        </button>
                    </th>
                    <th class="text-left py-2 px-4 font-medium text-sm">
                        <button 
                            class="flex items-center space-x-1 hover:text-primary" 
                            on:click={() => toggleSort('status')}
                        >
                            <span>Bundle Status</span>
                            <ArrowUpDown class="h-3.5 w-3.5" />
                        </button>
                    </th>
                    <th class="text-left py-2 px-4 font-medium text-sm">
                        <button 
                            class="flex items-center space-x-1 hover:text-primary" 
                            on:click={() => toggleSort('createdAt')}
                        >
                            <span>Added</span>
                            <ArrowUpDown class="h-3.5 w-3.5" />
                        </button>
                    </th>
                    <th class="text-right py-2 px-4 font-medium text-sm">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#if sortedDevices.length === 0}
                    <tr>
                        <td colspan="6" class="py-8 text-center text-muted-foreground">
                            {#if searchTerm}
                                <div class="flex flex-col items-center">
                                    <Search class="h-8 w-8 mb-2 opacity-50" />
                                    <p class="text-sm">No devices match your search</p>
                                </div>
                            {:else}
                                <div class="flex flex-col items-center">
                                    <Smartphone class="h-8 w-8 mb-2 opacity-50" />
                                    <p class="text-sm font-medium mb-1">No devices added yet</p>
                                    <p class="text-xs text-muted-foreground">Add devices to this bundle to start deployment</p>
                                </div>
                            {/if}
                        </td>
                    </tr>
                {:else}
                    {#each sortedDevices as device}
                        <tr class="border-b hover:bg-muted/50">
                            <td class="py-3 px-4 w-10">
                                <button type="button" class="inline-flex" on:click|stopPropagation={() => toggleRowSelection(device.id)} aria-label={`Select ${device.device.name}`}>
                                    <Checkbox checked={selectedIds.includes(device.id)} />
                                </button>
                            </td>
                            <td class="py-3 px-4">
                                <div class="flex items-center">
                                    <Smartphone class="h-4 w-4 mr-2 text-muted-foreground" />
                                    <a href={`/admin/iot/devices/${device.device.id}`} class="hover:underline">{device.device.name}</a>
                                </div>
                            </td>
                            <td class="py-3 px-4">
                                {device.device.model || 'Unknown'}
                            </td>
                            <td class="py-3 px-4">
                                {#if device.device.status === 'ONLINE'}
                                    <div class="flex items-center">
                                        <Badge variant={getDeviceStatusVariant(device.device.status)} class="mr-1.5">
                                            <Wifi class="h-3 w-3 mr-1" />
                                            {device.device.status}
                                        </Badge>
                                    </div>
                                {:else if device.device.status === 'OFFLINE'}
                                    <div class="flex items-center">
                                        <Badge variant={getDeviceStatusVariant(device.device.status)} class="mr-1.5">
                                            <WifiOff class="h-3 w-3 mr-1" />
                                            {device.device.status}
                                        </Badge>
                                    </div>
                                {:else}
                                    <Badge variant={getDeviceStatusVariant(device.device.status || 'UNKNOWN')}>
                                        {device.device.status || 'UNKNOWN'}
                                    </Badge>
                                {/if}
                            </td>
                            <td class="py-3 px-4">
                                <Badge variant={getStatusVariant(device.status)}>{device.status}</Badge>
                            </td>
                            <td class="py-3 px-4">
                                <RelativeDate date={device.createdAt} />
                            </td>
                            <td class="py-3 px-4 text-right">
                                <div class="flex justify-end space-x-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        title="View Details"
                                    >
                                        <Info class="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        title="Remove Device"
                                        on:click={() => confirmDelete(device)}
                                    >
                                        <Trash class="h-4 w-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    {/if}
<!-- </div> -->
