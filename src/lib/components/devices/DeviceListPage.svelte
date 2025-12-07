<script lang="ts">
    import DeviceStatistics from "$lib/components/devices/DeviceStatistics.svelte";
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { sseStore } from "$lib/stores/sse-store";
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

    // SSE subscription cleanup
    let unsubscribe: (() => void) | null = null;

    // Setup SSE connection and device subscriptions
    onMount(async () => {
        if (!browser) return;

        if (context === 'admin') {
            console.log('[DeviceListPage] 🚀 Admin page mounted - Setting up SSE connection');
            console.log('[DeviceListPage] Current SSE state:', {
                connectionId: sseStore.connectionId,
                isConnected: sseStore.isConnected
            });
            
            try {
                console.log('[DeviceListPage] Attempting to connect to /api/sse...');
                await sseStore.connect(`/api/sse`, { withCredentials: true });
                console.log('[DeviceListPage] ✅ SSE connect() call completed');
                
                // Wait a bit for connection to establish
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.warn('[DeviceListPage] ⚠️  SSE connect() threw error:', e);
            }
            
            // Subscribe to all devices (admin-level subscription)
            console.log('[DeviceListPage] Calling subscribeToDeviceUpdates("ADMIN")...');
            const subscribed = await subscribeToDeviceUpdates('ADMIN');
            
            if (subscribed) {
                console.log('[DeviceListPage] ✅ Successfully subscribed to admin devices channel');
            } else {
                console.error('[DeviceListPage] ❌ Failed to subscribe to admin devices channel');
            }
        } else {
            // User route
            console.log('[DeviceListPage] Setting up SSE connection and account subscription');
            console.log('[DeviceListPage] User role:', userRole, 'Account ID:', accountId);
            
            try {
                await sseStore.connect(`/api/sse`, { withCredentials: true });
                console.log('[DeviceListPage] SSE connected');
            } catch (e) {
                console.debug('[DeviceListPage] SSE already connected');
            }
            
            // Subscribe to account devices (account-level subscription)
            const subscribed = await subscribeToDeviceUpdates(userRole || 'MEMBER', accountId);
            
            if (subscribed) {
                console.log('[DeviceListPage] Successfully subscribed to account devices channel');
            } else {
                console.error('[DeviceListPage] Failed to subscribe to account devices channel');
            }
        }

        // Return cleanup function
        unsubscribe = () => {
            console.log('[DeviceListPage] Page unmounting - disconnecting SSE');
            sseStore.disconnect();
        };
    });

    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
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

