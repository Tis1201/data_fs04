<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Trash, Plus, Smartphone, Wifi, WifiOff, Info, ArrowUpDown } from 'lucide-svelte';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Input } from "$lib/components/ui/input";
    import { Search } from "lucide-svelte";
    
    import type { BundleDevice } from "@prisma/client";
    import DeviceSelector from "../device_select/DeviceSelector.svelte";
    
    export let bundleId: string;
    export let devices: (BundleDevice & { device: { name: string, id: string, model?: string, status?: string } })[] = [];
    export let loading = false;
    
    // Sample data for demonstration (will be replaced with real data in production)
    const sampleDevices = [
        {
            id: "cln1a2b3c4d5e6f7g8h9i0",
            bundleId: bundleId,
            deviceId: "dev1",
            status: "INCLUDED",
            createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
            updatedAt: new Date(),
            createdBy: "admin",
            updatedBy: "admin",
            device: {
                id: "dev1",
                name: "Reception Tablet",
                model: "Samsung Galaxy Tab S7",
                status: "ONLINE"
            }
        },
        {
            id: "cln2a2b3c4d5e6f7g8h9i0",
            bundleId: bundleId,
            deviceId: "dev2",
            status: "PENDING",
            createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
            updatedAt: new Date(),
            createdBy: "admin",
            updatedBy: "admin",
            device: {
                id: "dev2",
                name: "Meeting Room Display",
                model: "LG WebOS Display",
                status: "OFFLINE"
            }
        },
        {
            id: "cln3a2b3c4d5e6f7g8h9i0",
            bundleId: bundleId,
            deviceId: "dev3",
            status: "EXCLUDED",
            createdAt: new Date(Date.now() - 86400000), // 1 day ago
            updatedAt: new Date(),
            createdBy: "admin",
            updatedBy: "admin",
            device: {
                id: "dev3",
                name: "Lobby Kiosk",
                model: "iPad Pro 12.9",
                status: "ONLINE"
            }
        }
    ];
    
    // Use sample data for demonstration
    $: displayDevices = devices.length > 0 ? devices : sampleDevices;
    
    // Search functionality
    let searchTerm = '';
    $: filteredDevices = searchTerm ? 
        displayDevices.filter(d => 
            d.device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.status.toLowerCase().includes(searchTerm.toLowerCase())
        ) : 
        displayDevices;
    
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
            await api_delete(`/api/admin/iot/bundles/${bundleId}/devices/${deleteDialogState.selectedRecord.id}`);
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
    async function handleDeviceSelect(event: CustomEvent<{ detail: { id: string; name: string } }>) {
        const device = event.detail;
        if (!device) return;
        
        addingDevice = true;
        
        try {
            await api_post(`/api/admin/iot/bundles/${bundleId}/devices`, {
                deviceId: device.id,
                status: "PENDING"
            });
            
            toast.success(`Added ${device.name} to bundle`);
            await invalidate('app:bundle');
            
            // Reset form and close dialog
            addDialogOpen = false;
            
        } catch (error) {
            toast.error("Failed to add device to bundle");
            console.error(error);
        } finally {
            addingDevice = false;
        }
    }
    
    // Function to get badge variant based on status
    function getStatusVariant(status: string) {
        const statusMap = {
            'PENDING': 'outline',
            'INCLUDED': 'success',
            'EXCLUDED': 'destructive'
        };
        return statusMap[status] || 'outline';
    }
    
    // Function to get device status badge variant
    function getDeviceStatusVariant(status: string) {
        const statusMap = {
            'ONLINE': 'success',
            'OFFLINE': 'destructive',
            'IDLE': 'warning'
        };
        return statusMap[status] || 'secondary';
    }
</script>

<!-- Bundle Devices Header and Add Button -->
<div class="flex justify-between items-center mb-2">
    <div>
        <h3 class="text-lg font-medium">Bundle Devices</h3>
        <p class="text-sm text-muted-foreground">{filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''} in this bundle</p>
    </div>
    <Button variant="outline" size="sm" on:click={() => addDialogOpen = true}>
        <Plus class="h-4 w-4 mr-2" />
        Add Device
    </Button>
</div>

<!-- Search and Filter Bar -->
<div class="flex items-center space-x-2 mb-4">
    <div class="relative flex-1">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
            type="search" 
            placeholder="Search devices..." 
            class="pl-8" 
            bind:value={searchTerm}
        />
    </div>
</div>

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
<div class="w-full mt-1 border rounded-md overflow-hidden">
    {#if loading}
        <div class="space-y-2 p-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
        </div>
    {:else}
        <table class="w-full border-collapse">
            <thead>
                <tr class="border-b bg-muted/50">
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
                            {searchTerm ? 'No devices match your search' : 'No devices added to this bundle yet'}
                        </td>
                    </tr>
                {:else}
                    {#each sortedDevices as device}
                        <tr class="border-b hover:bg-muted/50">
                            <td class="py-3 px-4">
                                <div class="flex items-center">
                                    <Smartphone class="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{device.device.name}</span>
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
</div>