<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import SearchablePopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/SearchablePopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Power, ExternalLink, Trash } from "lucide-svelte";
    import type { Device, DeviceTag } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    import { Badge } from "$lib/components/ui/badge";
    import { sseStore } from "$lib/stores/sse-store";
    import OnlineDot from "$lib/components/ui_components_sveltekit/devices/OnlineDot.svelte";
    import DeviceStatusBadge from "$lib/components/ui_components_sveltekit/devices/DeviceStatusBadge.svelte";

    // Props for DataTable component
    export let props = {
        records: [] as Device[],
        availableTags: [] as DeviceTag[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };
    
    // Delete confirmation state
    let state = {
        selectedRecord: null as Device | null,
        confirmationOpen: false
    };

    function confirmDelete(device: Device) {
        state.selectedRecord = device;
        state.confirmationOpen = true;
    }

    // Device to be toggled (for status change)
    let deviceToToggle: Device | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(device: Device) {
        deviceToToggle = device;
        statusToggleDialogOpen = true;
    }

    // Stores for filters and table state
    const selectedTagIds = writable<string[]>(
        $page.url.searchParams.get("tags")?.split(",").filter(Boolean) ?? []
    );
    
    $: {
        // Keep selectedTagIds in sync with URL changes
        const urlTags = $page.url.searchParams.get("tags")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlTags) !== JSON.stringify($selectedTagIds)) {
            selectedTagIds.set(urlTags);
        }
    }
    
    // Initialize filter values from URL parameters
    let typeFilterValues = $page.url.searchParams.get("types")?.split(",").filter(Boolean) ?? [];
    let statusFilterValues = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
    
    // Make tagOptions reactive to props changes
    $: tagOptions = props.availableTags.map(tag => {
        return {
            label: tag.name,
            value: tag.id
        }
    })
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Device) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Device'
                    },
                    baseUrl: '/user/iot/devices',
                    showId: true
                }
            })
        },
        {
            id: "macAddress",
            label: "MAC Address",
            sortable: true,
            width: "12%",
            render: (record: Device) => {
                // Show primary MAC address, fallback to wifi or lan MAC
                const mac = record.macAddress || record.wifiMac || record.lanMac;
                return mac?.toUpperCase() || "N/A";
            }
        },
        {
            id: "osVersion",
            label: "OS Version",
            sortable: true,
            width: "8%",
            render: (record: Device) => record.osVersion || "N/A"
        },
        {
            id: "connected",
            label: "Online",
            sortable: false,
            width: "6%",
            render: (record: Device) => ({
                component: OnlineDot,
                props: {
                    online: !!record.connected,
                    title: record.connected ? 'Online' : 'Offline'
                }
            })
        },
        {
            id: "usage",
            label: "Usage",
            sortable: false,
            width: "8%",
            render: (record: Device) => "N/A"  // Will use table device info later
        },
        {
            id: "tags",
            label: "Tags",
            sortable: false,
            width: "12%",
            render: (record: any) => {
                const tags = record.tags || [];
                if (tags.length === 0) {
                    return "—";
                }
                // Return HTML string with clickable links to tag detail pages
                return tags.map((tag: any) => 
                    `<a href="/user/iot/device_tags/${tag.id}" class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1 hover:bg-blue-100 hover:ring-blue-800/20 transition-colors cursor-pointer" onclick="event.stopPropagation()">${tag.name}</a>`
                ).join('');
            }
        },
        {
            id: "actions",
            label: "Actions",
            width: "15%",
            render: (record: Device) => {
                // Define action items here instead of in the RecordActions component
                const actionItems = [
                    {
                        label: "View Details",
                        icon: ExternalLink,
                        onClick: () => goto(`/user/iot/devices/${record.id}`)
                    },
                    {
                        label: record.status === 'ACTIVE' ? "Deactivate" : "Activate",
                        icon: Power,
                        onClick: () => prepareToggleStatus(record)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    }
                ];
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];

    // Using imported pagination utilities for table interactions
    // These are already imported from pagination-utils
    // Subscribe to connection events to update rows in real time
    onMount(() => {
        console.log('[UserDeviceTable] ✅ SSE listener registered - waiting for device connection events...');
        console.log('[UserDeviceTable] Total devices in table:', props.records.length);
        
        const unsubscribe = sseStore.on('*', (msg: any) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[UserDeviceTable] 📨 SSE MESSAGE RECEIVED:', {
                event: msg?.event,
                hasData: !!msg?.data,
                timestamp: new Date().toISOString()
            });
            console.log('[UserDeviceTable] Full message object:', msg);
            
            const raw = msg?.data ?? msg;
            const evtType = raw?.type || msg?.event || raw?.payload?.type;
            console.log('[UserDeviceTable] Extracted event type:', evtType);
            
            // Normalize payloads - handle both old and new structures
            // Old: { payload: { action: 'device:connection', deviceId, connected } }
            // New: { type: 'device:connection', payload: { deviceId, connected } }
            let normalized;
            if (raw?.payload?.action === 'device:connection' || raw?.payload?.action === 'device:disconnection') {
                console.log('[UserDeviceTable] 📦 Using OLD event structure (payload.action)');
                normalized = { ...raw.payload, type: raw.payload.action };
            } else if (raw?.type === 'device:connection' || raw?.type === 'device:disconnection') {
                console.log('[UserDeviceTable] 📦 Using NEW event structure (type + payload)');
                normalized = {
                    type: raw.type,
                    deviceId: raw.payload?.deviceId,
                    connected: raw.payload?.connected,
                    connectedAt: raw.payload?.connectedAt,
                    disconnectedAt: raw.payload?.disconnectedAt,
                    timestamp: raw.payload?.timestamp,
                    reason: raw.payload?.reason
                };
            } else {
                console.log('[UserDeviceTable] 📦 Unknown structure, passing through');
                normalized = raw;
            }
            
            console.log('[UserDeviceTable] Normalized event:', normalized);
            
            const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
            const isDisconnectionEvent = (evtType === 'device:disconnection') || (normalized?.type === 'device:disconnection');
            
            console.log('[UserDeviceTable] Event type check:', {
                isConnectionEvent,
                isDisconnectionEvent,
                evtType,
                normalizedType: normalized?.type
            });
            
            if (!isConnectionEvent && !isDisconnectionEvent) {
                console.log('[UserDeviceTable] ⏭️  Not a connection/disconnection event, ignoring');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                return;
            }
            
            const c = normalized as any;
            const cDeviceId = c?.deviceId;
            console.log('[UserDeviceTable] 🔍 Device ID extraction:', {
                deviceId: cDeviceId,
                connected: c?.connected,
                hasDeviceId: !!cDeviceId
            });
            
            if (!cDeviceId) {
                console.error('[UserDeviceTable] ❌ ERROR: No deviceId found in event!');
                console.log('[UserDeviceTable] Normalized object:', normalized);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                return;
            }
            
            const idx = props.records.findIndex((r) => r.id === cDeviceId);
            console.log('[UserDeviceTable] 🔎 Searching for device in table:', {
                deviceId: cDeviceId,
                foundAtIndex: idx,
                totalRecords: props.records.length,
                recordIds: props.records.map((r: any) => r.id).slice(0, 5) // Show first 5 IDs
            });
            
            if (idx >= 0) {
                const connected = c?.connected ?? false;
                const previousStatus = props.records[idx].connected;
                console.log('[UserDeviceTable] ✏️  Updating device:', {
                    index: idx,
                    deviceId: cDeviceId,
                    previousStatus,
                    newStatus: connected,
                    statusChanged: previousStatus !== connected
                });
                
                props.records[idx].connected = !!connected;
                if (connected && c?.connectedAt) {
                    (props.records[idx] as any).connectedAt = c.connectedAt;
                }
                if (!connected && c?.disconnectedAt) {
                    (props.records[idx] as any).disconnectedAt = c.disconnectedAt;
                }
                props = { ...props }; // trigger re-render
                console.log('[UserDeviceTable] ✅ SUCCESS: Device status updated!', {
                    deviceId: cDeviceId,
                    newStatus: connected,
                    recordUpdated: true
                });
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } else {
                console.warn('[UserDeviceTable] ⚠️  Device not found in current table view:', {
                    deviceId: cDeviceId,
                    reason: 'Device may be on a different page or filtered out'
                });
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
        });

        // NOTE: No longer subscribing to individual devices
        // The parent page now subscribes to the account-level channel: subscription:account:{accountId}:devices
        // This single subscription covers ALL devices in the user's account for scalability

        return () => {
            try { unsubscribe && unsubscribe(); } catch {}
        };
    });
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={{
            selectedRecord: state.selectedRecord,
            confirmationOpen: state.confirmationOpen,
            title: 'Delete Device',
            message: state.selectedRecord ? `Are you sure you want to delete device ${state.selectedRecord.name || state.selectedRecord.id}?` : '',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            successMessage: 'Device deleted successfully',
            errorMessage: 'Failed to delete device'
        }}
        onConfirm={() => {
            // Simple approach: reload to refresh table
            window.location.reload();
        }}
        on:close={() => state.confirmationOpen = false}
    />
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        open={statusToggleDialogOpen}
        action="?/toggleStatus"
        record={deviceToToggle}
        isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            // Update the device status in the local data without page refresh
            if (deviceToToggle) {
                const updatingId = deviceToToggle.id;
                const newStatus = deviceToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the device in the records array
                const index = props.records.findIndex(r => r.id === updatingId);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`Device ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the deviceToToggle and close dialog
                deviceToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update device status: ${result.data?.error || 'Unknown error'}`);
            deviceToToggle = null;
            statusToggleDialogOpen = false;
        }}
        on:close={() => {
            deviceToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        {#if deviceToToggle}
            <input type="hidden" name="id" value={deviceToToggle.id} />
            <input type="hidden" name="status" value={deviceToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
            <button type="submit" class="hidden">Submit</button>
        {/if}
    </RecordUpdateDialog>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 justify-between">
        <div class="flex flex-col sm:flex-row gap-2">
            <!-- Search filter -->
            <DebouncedTextFilter
                placeholder="Search devices..."
                paramName="search"
            />
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'INACTIVE', label: 'Inactive' }
                ]}
                selectedValues={statusFilterValues}
                key="statuses"
            />

            <!-- Tags filter -->
            <SearchablePopoverFilter
                label="Tags"
                options={tagOptions}
                selectedValues={$selectedTagIds}
                searchPlaceholder="Search tags..."
                onChange={(values) => {
                    selectedTagIds.set(values);
                    const url = new URL(window.location.href);
                    url.searchParams.set('tags', values.join(','));
                    if (!values.length) url.searchParams.delete('tags');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
            />
        </div>
    </div>
    
    <!-- Data Table -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <DataTable
            props={{
                records: props.records,
                pagination: props.pagination,
                sort: props.sort
            }}
            columns={columns}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
