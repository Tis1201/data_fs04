<script lang="ts">
    import DeviceTable from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { sseStore } from "$lib/stores/sse-store";
    import { subscribeToDeviceUpdates } from "$lib/stores/device-subscription";
    import { onMount } from 'svelte';

    export let data: PageData;

    $: ({ devices: records, meta, availableTags } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    $: props = { records: records as any, availableTags, pagination, sort, loading };
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string | null][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Devices", null]
    ];

    // Establish SSE connection and subscribe to admin devices channel
    onMount(async () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AdminDeviceList] 🚀 Page mounted - Setting up SSE connection');
        console.log('[AdminDeviceList] Current SSE state:', {
            connectionId: sseStore.connectionId,
            isConnected: sseStore.isConnected
        });
        
        // Enable SSE for real-time device online/offline status updates
        try {
            console.log('[AdminDeviceList] Attempting to connect to /api/sse...');
            await sseStore.connect(`/api/sse`, { withCredentials: true });
            console.log('[AdminDeviceList] ✅ SSE connect() call completed');
            console.log('[AdminDeviceList] SSE state after connect:', {
                connectionId: sseStore.connectionId,
                isConnected: sseStore.isConnected
            });
            
            // Wait a bit for connection to establish
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('[AdminDeviceList] SSE state after 500ms wait:', {
                connectionId: sseStore.connectionId,
                isConnected: sseStore.isConnected
            });
        } catch (e) {
            console.warn('[AdminDeviceList] ⚠️  SSE connect() threw error:', e);
            console.log('[AdminDeviceList] SSE state after error:', {
                connectionId: sseStore.connectionId,
                isConnected: sseStore.isConnected
            });
        }
        
        // Subscribe to all devices (admin-level subscription)
        // This replaces per-device subscriptions for scalability
        console.log('[AdminDeviceList] Calling subscribeToDeviceUpdates("ADMIN")...');
        const subscribed = await subscribeToDeviceUpdates('ADMIN');
        
        if (subscribed) {
            console.log('[AdminDeviceList] ✅ Successfully subscribed to admin devices channel');
        } else {
            console.error('[AdminDeviceList] ❌ Failed to subscribe to admin devices channel');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return () => {
            // Disconnect when leaving the page
            console.log('[AdminDeviceList] Page unmounting - disconnecting SSE');
            sseStore.disconnect();
        };
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Devices">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Device"
                icon={Plus}
                onClick={() => goto('/admin/iot/devices/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <DeviceTable {props} />
</PageContainer>
