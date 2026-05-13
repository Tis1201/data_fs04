<script lang="ts">
    import DeviceStatistics from "$lib/components/devices/DeviceStatistics.svelte";
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { subscribeToDeviceUpdates } from "$lib/stores/device-subscription";
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import type { ComponentType } from 'svelte';

    /**
     * Props for DeviceListPage component
     */
    export let data: any; // PageData from route (devices, deviceInformation, meta, availableTags, deviceStats, etc.)
    export let breadcrumbs: [string, string][];
    export let baseUrl: string; // "/admin/iot/devices" or "/user/iot/devices"
    export let newDevicePath: string; // "/admin/iot/devices/new" or "/user/iot/devices/new"
    export let title: string = "Devices";
    export let context: 'admin' | 'user' = 'admin';
    export let userRole: string | undefined = undefined; // For user routes
    export let accountId: string | undefined = undefined; // For user routes
    export let tableComponent: ComponentType; // The table component to use (from route)

    $: ({ devices: records, deviceInformation, meta, availableTags, deviceStats } = data as any);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Setup device subscriptions (MQTT handles connections automatically)
    onMount(async () => {
        if (!browser) return;

        if (context === 'admin') {
            console.log('[DeviceListPage] 🚀 Admin page mounted - Device subscriptions handled automatically via MQTT');
            
            // Device subscriptions are now handled automatically via MQTT
            // MQTT client receives device notifications based on user permissions
            const subscribed = await subscribeToDeviceUpdates('ADMIN');
            
            if (subscribed) {
                console.log('[DeviceListPage] ✅ Device notifications will be received via MQTT');
            } else {
                console.warn('[DeviceListPage] ⚠️  Device subscription setup completed (MQTT handles automatically)');
            }
        } else {
            // User route
            console.log('[DeviceListPage] Setting up device subscriptions (MQTT handles automatically)');
            console.log('[DeviceListPage] User role:', userRole, 'Account ID:', accountId);
            
            // Device subscriptions are now handled automatically via MQTT
            // MQTT client receives device notifications based on user permissions
            const subscribed = await subscribeToDeviceUpdates(userRole || 'MEMBER', accountId);
            
            if (subscribed) {
                console.log('[DeviceListPage] Device notifications will be received via MQTT');
            } else {
                console.warn('[DeviceListPage] Device subscription setup completed (MQTT handles automatically)');
            }
        }
    });

    onDestroy(() => {
        // MQTT handles cleanup automatically - no manual cleanup needed
        console.log('[DeviceListPage] Page unmounting - MQTT handles cleanup automatically');
    });
</script>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Add Device",
            icon: Plus,
            onClick: () => goto(newDevicePath)
        }
    ]}
>
    {#if deviceStats}
        <DeviceStatistics stats={deviceStats} />
    {/if}

    <!-- Use the table component from the route -->
    <svelte:component 
        this={tableComponent}
        props={{
            records: records || [],
            deviceInformation: deviceInformation || {},
            availableTags: availableTags || [],
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>

