<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Power, ExternalLink } from "lucide-svelte";
    import type { Device } from "@prisma/client";
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

    // Props for DataTable component
    export let props = {
        records: [] as Device[],
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
    
    // Device to be toggled (for status change)
    let deviceToToggle: Device | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(device: Device) {
        deviceToToggle = device;
        statusToggleDialogOpen = true;
    }

    // Initialize filter values from URL parameters
    let typeFilterValues = $page.url.searchParams.get("types")?.split(",").filter(Boolean) ?? [];
    let statusFilterValues = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
    
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
            width: "25%",
            render: (record: Device) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Device'
                    },
                    baseUrl: '/user/iot/devices',
                    showId: false
                }
            })
        },
        {
            id: "deviceType",
            label: "Type",
            sortable: true,
            width: "15%",
            render: (record: Device) => record.deviceType || "N/A"
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "15%",
            render: (record: Device) => ({
                component: Badge,
                props: {
                    variant: record.status === 'ACTIVE' ? 'success' : 'secondary',
                    class: 'capitalize',
                    children: record.status?.toLowerCase() || 'Unknown'
                }
            })
        },
        {
            id: "createdAt",
            label: "Added",
            sortable: true,
            width: "15%",
            render: (record: Device) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "actions",
            label: "Actions",
            width: "15%",
            render: (record: Device) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "View Details",
                        icon: ExternalLink,
                        onClick: () => goto(`/user/iot/devices/${record.id}`)
                    },
                    {
                        label: record.status === 'ACTIVE' ? "Deactivate" : "Activate",
                        icon: Power,
                        onClick: () => prepareToggleStatus(record)
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
</script>

<div class="space-y-4">
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        title={deviceToToggle?.status === 'ACTIVE' ? 'Deactivate Device' : 'Activate Device'}
        message={deviceToToggle ? 
            `Are you sure you want to ${deviceToToggle.status === 'ACTIVE' ? 'deactivate' : 'activate'} device "${deviceToToggle.name || deviceToToggle.id}"?` : 
            'Are you sure you want to change the device status?'
        }
        confirmButtonText={deviceToToggle?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        confirmButtonVariant={deviceToToggle?.status === 'ACTIVE' ? 'outline' : 'default'}
        loading={isTogglingStatus}
        on:confirm={async () => {
            if (!deviceToToggle) return;
            
            isTogglingStatus = true;
            
            try {
                const formData = new FormData();
                formData.append('id', deviceToToggle.id);
                formData.append('status', deviceToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
                
                const response = await api_post('?/toggleStatus', formData);
                
                if (response.success) {
                    toast.success(
                        deviceToToggle.status === 'ACTIVE' ? 
                        'Device deactivated successfully' : 
                        'Device activated successfully'
                    );
                    // Refresh the page to update the device list
                    goto($page.url.pathname + $page.url.search, { invalidateAll: true });
                } else {
                    toast.error('Failed to update device status');
                }
            } catch (error) {
                toast.error('An error occurred while updating device status');
                console.error(error);
            } finally {
                isTogglingStatus = false;
                statusToggleDialogOpen = false;
            }
        }}
    />

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 justify-between">
        <div class="flex flex-col sm:flex-row gap-2">
            <!-- Search filter -->
            <DebouncedTextFilter
                placeholder="Search devices..."
                paramName="search"
            />
            
            <!-- Device type filter -->
            <PopoverFilter
                label="Type"
                options={[
                    { value: 'CAMERA', label: 'Camera' },
                    { value: 'SENSOR', label: 'Sensor' },
                    { value: 'CONTROLLER', label: 'Controller' },
                    { value: 'OTHER', label: 'Other' }
                ]}
                selectedValues={typeFilterValues}
                key="types"
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
