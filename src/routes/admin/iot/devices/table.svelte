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
    import { Pencil, Trash, Power, RefreshCw } from "lucide-svelte";
    import type { Device, DeviceTag } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { sseStore } from "$lib/stores/sse-store";
    import { Badge } from "$lib/components/ui/badge";
    import OnlineDot from "$lib/components/ui_components_sveltekit/devices/OnlineDot.svelte";
    import DeviceStatusBadge from "$lib/components/ui_components_sveltekit/devices/DeviceStatusBadge.svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";

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
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as Device | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
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
    const selectedTypes = writable<string[]>(
        $page.url.searchParams.get("types")?.split(",").filter(Boolean) ?? []
    );
    
    $: {
        // Keep selectedTypes in sync with URL changes
        const urlTypes = $page.url.searchParams.get("types")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlTypes) !== JSON.stringify($selectedTypes)) {
            selectedTypes.set(urlTypes);
        }
    }
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });
    
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );

    const selectedTagIds = writable<string[]>(
        $page.url.searchParams.get("tags")?.split(",").filter(Boolean) ?? []
    );

    // Make tagOptions reactive to props changes
    $: tagOptions = props.availableTags.map(tag => {
        return {
            label: tag.name,
            value: tag.id
        }
    })

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
                    baseUrl: '/admin/iot/devices',
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
                    `<a href="/admin/iot/device_tags/${tag.id}" class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1 hover:bg-blue-100 hover:ring-blue-800/20 transition-colors cursor-pointer" onclick="event.stopPropagation()">${tag.name}</a>`
                ).join('');
            }
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: Device) => {
                // Define action items here instead of in the RecordActions component
                const actionItems = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/iot/devices/${record.id}`)
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
        const unsubscribe = sseStore.on('*', (msg: any) => {
            console.log('[DeviceTable] Received SSE message:', msg);
            const raw = msg?.data ?? msg;
            const evtType = raw?.type || msg?.event || raw?.payload?.type;
            const evt = raw?.payload?.action === 'device:connection' ? { ...raw.payload, type: 'device:connection' } : raw;
            
            console.log('[DeviceTable] Parsed message:', {
                raw,
                evtType,
                evt,
                msgEvent: msg?.event
            });
            
            if (evtType !== 'device:connection' && evt?.type !== 'device:connection') {
                console.log('[DeviceTable] Not a device:connection event, ignoring');
                return;
            }
            
            const c = evt as any;
            const cDeviceId = c?.deviceId || c?.payload?.deviceId;
            console.log('[DeviceTable] Device ID check:', {
                cDeviceId,
                cPayloadDeviceId: c?.payload?.deviceId,
                cConnected: c?.connected,
                cPayloadConnected: c?.payload?.connected
            });
            
            if (!cDeviceId) {
                console.log('[DeviceTable] No deviceId found, ignoring');
                return;
            }
            
            const idx = props.records.findIndex((r) => r.id === cDeviceId);
            console.log('[DeviceTable] Device index in records:', idx);
            
            if (idx >= 0) {
                const connected = c?.connected ?? c?.payload?.connected ?? false;
                console.log('[DeviceTable] Updating device at index', idx, 'to connected:', connected);
                
                props.records[idx].connected = !!connected;
                if (connected && (c?.connectedAt || c?.payload?.connectedAt)) {
                    (props.records[idx] as any).connectedAt = c?.connectedAt || c?.payload?.connectedAt;
                }
                if (!connected && (c?.disconnectedAt || c?.payload?.disconnectedAt)) {
                    (props.records[idx] as any).disconnectedAt = c?.disconnectedAt || c?.payload?.disconnectedAt;
                }
                props = { ...props }; // trigger re-render
                console.log('[DeviceTable] Device updated, props refreshed');
            } else {
                console.log('[DeviceTable] Device not found in records');
            }
        });

        // Subscribe this connection to all device channels present in the table
        const subscribedDeviceIds = new Set<string>();

        async function subscribeToDevices(ids: string[]) {
            // Try to get connectionId from store
            let connId: string | null = null;
            const unsub = sseStore.on('connected', (m: any) => {
                connId = m?.data?.connectionId || m?.connectionId || null;
            });
            unsub();

            // If not yet available, wait for connected event once
            if (!connId) {
                sseStore.on('connected', async (m: any) => {
                    const id = m?.data?.connectionId || m?.connectionId || null;
                    if (!id) return;
                    for (const deviceId of ids) {
                        if (subscribedDeviceIds.has(deviceId)) continue;
                        try {
                            await fetch(`/api/sse/subscribe/device/${deviceId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ connectionId: id })
                            });
                            subscribedDeviceIds.add(deviceId);
                        } catch (e) {
                            // ignore failures; can try again on next change
                        }
                    }
                });
            } else {
                // We have a connectionId; subscribe immediately
                for (const deviceId of ids) {
                    if (subscribedDeviceIds.has(deviceId)) continue;
                    try {
                        await fetch(`/api/sse/subscribe/device/${deviceId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ connectionId: connId })
                        });
                        subscribedDeviceIds.add(deviceId);
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        // Initial subscribe
        subscribeToDevices(props.records.map((r) => r.id));

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
            // Refresh the page to update the device list
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
    
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name or ID..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" }
                ]}
                selectedValues={$selectedStatuses}
                onChange={(values) => {
                    selectedStatuses.set(values);
                    const url = new URL(window.location.href);
                    url.searchParams.set('statuses', values.join(','));
                    if (!values.length) url.searchParams.delete('statuses');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
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

        <!-- Data table -->
        <DataTable
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
