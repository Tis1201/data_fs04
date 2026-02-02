<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { onMount } from 'svelte';
    import { toast } from '$lib/stores/alertToast';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    import { mqttClient } from '$lib/client/mqtt/mqttClient';
    import { Trash, Plus, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-svelte';

    const dispatch = createEventDispatcher<{ viewDevice: { device: DeviceWithInfo } }>();
    import { page } from "$app/stores";
    
    // Design System Components
    import { 
        DataTable, 
        Button, 
        Badge,
        Modal,
        BulkActionsBar
    } from '$lib/design-system/components';
    import type { ColumnDef, BadgeColor, BulkAction } from '$lib/design-system/components';
    
    import type { BundleDevice } from "@prisma/client";
    import DeviceSelector from "../device_select/DeviceSelector.svelte";
    
    // Types (device may include os/osVersion from API)
    type DeviceWithInfo = BundleDevice & { 
        device: { 
            name: string; 
            id: string; 
            model?: string; 
            status?: string; 
            connected?: boolean;
            os?: string;
            osVersion?: string;
        } 
    };
    
    // Props
    export let bundleId: string;
    export let devices: DeviceWithInfo[] = [];
    export let loading = false;
    export let apiPrefix: string = '/api/admin';
    export let deviceLinkPrefix: string = '/admin/iot/devices';
    export let useRealTimeUpdates: boolean = true;
    /** When true, hide the "Add Device" button in header (parent puts it in card header-actions) */
    export let hideHeaderAddButton: boolean = false;
    /** When false, hide the Actions column (e.g. when Deployment = InProgress | Completed | Canceled) */
    export let showActionsColumn: boolean = true;
    
    // Local reactive copy for real-time updates
    let displayDevices: DeviceWithInfo[] = devices;
    $: displayDevices = devices;
    
    // Search state
    let searchTerm = '';
    
    // Filter devices based on search
    $: filteredDevices = displayDevices.filter(d => {
        if (!searchTerm) return true;
        return d.device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               d.device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (d.status ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    // Selection state
    let selectedRows: DeviceWithInfo[] = [];
    
    // State for add device dialog
    let addDialogOpen = false;
    let addingDevice = false;
    
    // State for delete confirmation modal
    let deleteModalOpen = false;
    let deviceToDelete: DeviceWithInfo | null = null;
    let deleteLoading = false;
    
    // State for batch delete confirmation modal
    let batchDeleteModalOpen = false;
    let batchDeleteLoading = false;
    
    // Check if bundle is editable (DRAFT status)
    $: isEditable = ($page?.data?.bundle?.status || '').toUpperCase() === 'DRAFT';
    
    // Device Deployment Status: design rule — when device newly imported but deployment hasn't started → show '—'
    // Deployment has started when bundle status is RUNNING | COMPLETED | FAILED | STOPPED
    $: deploymentHasStarted = (() => {
        const s = ($page?.data?.bundle?.status || '').toUpperCase();
        return ['RUNNING', 'COMPLETED', 'FAILED', 'STOPPED'].includes(s);
    })();

    function getDeploymentStatusLabel(status: string | null | undefined): string {
        if (status == null || status === '') return '—';
        const u = status.toUpperCase();
        if (u === 'PENDING') return 'In Progress';
        if (u === 'INCLUDED' || u === 'COMPLETED') return 'Completed';
        if (u === 'EXCLUDED' || u === 'FAILED') return 'Failed';
        return status;
    }
    function getDeploymentStatusColor(displayLabel: string): BadgeColor {
        if (displayLabel === 'In Progress') return 'warning';
        if (displayLabel === 'Completed') return 'success';
        if (displayLabel === 'Failed') return 'error';
        return 'gray'; // — or unknown
    }

    /** Deployment Status for table: '—' when deployment hasn't started (DRAFT/SCHEDULED), else actual status. */
    function getDeploymentStatusDisplay(row: DeviceWithInfo): string {
        if (!deploymentHasStarted) return '—';
        return getDeploymentStatusLabel(row.status);
    }
    
    // Get badge color for device connection status
    function getConnectionStatusColor(connected: boolean | undefined): BadgeColor {
        return connected ? 'success' : 'error';
    }
    
    // DataTable columns (design: #, Device, Operating System, Model, Deployment Status, Status, Actions)
    const columns: ColumnDef<DeviceWithInfo>[] = [
        {
            id: 'index',
            header: '#',
            type: 'rowNumber',
            sortable: false
        },
        {
            id: 'name',
            header: 'Device',
            accessor: (row) => row.device.name,
            type: 'custom',
            sortable: true,
            render: (value, row) => `<a href="${deviceLinkPrefix}/${row.device.id}" class="text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline">${value}</a>`
        },
        {
            id: 'operatingSystem',
            header: 'Operating System',
            accessor: (row) => row.device.os ?? row.device.osVersion ?? '—',
            type: 'text',
            sortable: true
        },
        {
            id: 'model',
            header: 'Model',
            accessor: (row) => row.device.model ?? '—',
            type: 'text',
            sortable: true
        },
        {
            id: 'deploymentStatus',
            header: 'Deployment Status',
            accessor: (row) => getDeploymentStatusDisplay(row),
            type: 'badge',
            sortable: true,
            statusColor: (value) => getDeploymentStatusColor(value),
            showDot: (value) => value !== '—'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row) => row.device.connected ? 'Online' : 'Offline',
            type: 'badge',
            sortable: true,
            statusColor: (value) => value === 'Online' ? 'success' : 'error',
            showDot: () => true
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            align: 'right',
            getMenuActions: (row) => [
                {
                    id: 'view',
                    label: 'View Device',
                    onClick: () => dispatch('viewDevice', { device: row })
                },
                {
                    id: 'remove',
                    label: 'Remove',
                    color: 'danger',
                    onClick: () => confirmDelete(row)
                }
            ]
        }
    ];

    $: displayColumns = showActionsColumn ? columns : columns.filter((c: ColumnDef<DeviceWithInfo>) => c.id !== 'actions');
    
    // Bulk actions configuration
    const bulkActions: BulkAction[] = [
        {
            id: 'remove',
            label: 'Remove Selected',
            icon: Trash,
            destructive: true
        }
    ];
    
    // Function to open delete confirmation modal
    function confirmDelete(device: DeviceWithInfo) {
        deviceToDelete = device;
        deleteModalOpen = true;
    }
    
    // Handle single delete confirmation
    async function handleDeleteConfirm() {
        if (!deviceToDelete) return;
        
        deleteLoading = true;
        
        try {
            await api_delete(
                `${apiPrefix}/iot/bundles/${bundleId}/devices/${deviceToDelete.id}`,
                deviceToDelete.id
            );
            toast.success("Device removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove device from bundle");
            console.error(error);
        } finally {
            deleteLoading = false;
            deleteModalOpen = false;
            deviceToDelete = null;
        }
    }
    
    // Handle batch delete
    function confirmBatchDelete() {
        if (selectedRows.length === 0) return;
        batchDeleteModalOpen = true;
    }
    
    async function handleBatchDeleteConfirm() {
        if (selectedRows.length === 0) return;
        
        batchDeleteLoading = true;
        const idsToRemove = selectedRows.map(r => r.id);
        
        try {
            const promises = idsToRemove.map((id) =>
                api_delete(`${apiPrefix}/iot/bundles/${bundleId}/devices/${id}`, id)
            );
            await Promise.all(promises);
            
            toast.success(`Removed ${idsToRemove.length} device(s) from bundle`);
            selectedRows = [];
            await invalidate('app:bundle');
        } catch (error) {
            console.error(error);
            toast.error('Failed to remove selected devices');
        } finally {
            batchDeleteLoading = false;
            batchDeleteModalOpen = false;
        }
    }
    
    // Handle bulk action
    function handleBulkAction(event: CustomEvent<BulkAction>) {
        if (event.detail.id === 'remove') {
            confirmBatchDelete();
        }
    }
    
    // Handle device selection from DeviceSelector
    async function handleDeviceSelect(event: CustomEvent<{ id: string; name: string }[]>) {
        const selectedDevices = event.detail;
        if (!selectedDevices || selectedDevices.length === 0) return;
        
        addingDevice = true;
        
        try {
            const promises = selectedDevices.map(device => 
                api_post(`${apiPrefix}/iot/bundles/${bundleId}/devices`, {
                    deviceId: device.id,
                    status: "PENDING"
                })
            );
            
            await Promise.all(promises);
            
            toast.success(selectedDevices.length === 1 ? 'Device added successfully!' : 'Devices added successfully!');
            await invalidate('app:bundle');
            addDialogOpen = false;
            
        } catch (error) {
            toast.error("Unable to add Device. Please try again!");
            console.error(error);
        } finally {
            addingDevice = false;
        }
    }
    
    // Handle selection change
    function handleSelectionChange(event: CustomEvent<DeviceWithInfo[]>) {
        selectedRows = event.detail;
    }
    
    // Clear selection
    function clearSelection() {
        selectedRows = [];
    }

    /** Expose for parent to open Add Device dialog from card header */
    export function openAddDialog() {
        addDialogOpen = true;
    }
    
    // Subscribe to connection events to update device status in real time
    onMount(() => {
        if (!useRealTimeUpdates) return;
        
        const unsubConnection = mqttClient.onNotification('device:connection', (payload: any) => {
            const deviceId = payload?.deviceId;
            if (!deviceId) return;
            
            const deviceIndex = devices.findIndex((d) => d.device.id === deviceId);
            if (deviceIndex >= 0) {
                const connected = payload?.connected ?? true;
                devices[deviceIndex].device.connected = connected;
                devices = [...devices];
            }
        });

        const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
            const deviceId = payload?.deviceId;
            if (!deviceId) return;
            
            const deviceIndex = devices.findIndex((d) => d.device.id === deviceId);
            if (deviceIndex >= 0) {
                devices[deviceIndex].device.connected = false;
                devices = [...devices];
            }
        });

        return () => {
            try { 
                unsubConnection(); 
                unsubDisconnection(); 
            } catch {}
        };
    });
</script>

<div class="devices-component">
    <!-- Design: Card body = Table + Pagination only; no "X devices in this bundle" / search row -->
    <!-- Bulk Actions Bar -->
    {#if selectedRows.length > 0}
        <BulkActionsBar
            selectedCount={selectedRows.length}
            actions={bulkActions}
            on:action={handleBulkAction}
            on:clear={clearSelection}
        />
    {/if}
    
    <!-- Devices DataTable -->
    {#if loading}
        <div class="loading-state">
            <Loader2 size={24} class="animate-spin" />
            <span>Loading devices...</span>
        </div>
    {:else}
        <DataTable
            data={filteredDevices}
            columns={displayColumns}
            keyField="id"
            selectable={false}
            bordered={false}
            cellBorders={false}
            paginated={filteredDevices.length > 10}
            hoverable={true}
            striped={false}
            emptyMessage="No devices added to this bundle yet"
        />
    {/if}
</div>

<!-- Device Selector Dialog -->
<DeviceSelector 
    bind:open={addDialogOpen}
    {bundleId}
    {apiPrefix}
    on:select={handleDeviceSelect}
    on:close={() => addDialogOpen = false}
/>

<!-- Delete Confirmation Modal -->
<Modal
    open={deleteModalOpen}
    title="Remove Device"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Remove"
    confirmLoading={deleteLoading}
    on:close={() => { deleteModalOpen = false; deviceToDelete = null; }}
    on:confirm={handleDeleteConfirm}
>
    <p class="modal-text">
        Are you sure you want to remove this device? This action cannot be reversed.
    </p>
</Modal>

<!-- Batch Delete Confirmation Modal -->
<Modal
    open={batchDeleteModalOpen}
    title="Remove Selected Devices"
    type="error"
    size="sm"
    cancelText="Cancel"
    confirmText="Remove All"
    confirmLoading={batchDeleteLoading}
    on:close={() => batchDeleteModalOpen = false}
    on:confirm={handleBatchDeleteConfirm}
>
    <p class="modal-text">
        Are you sure you want to remove <strong>{selectedRows.length}</strong> selected device{selectedRows.length !== 1 ? 's' : ''} from the bundle? 
        This action cannot be undone.
    </p>
</Modal>

<style>
    .devices-component {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
    }
    
    .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-8);
        color: var(--ds-text-secondary);
    }
    
    .modal-text {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }
    
    .modal-text strong {
        color: var(--ds-text-primary);
    }
    
    /* Animations */
    :global(.animate-spin) {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
</style>
