<script lang="ts">
    import DeviceTable from "./table.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Plus } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";
    import { sseStore } from "$lib/stores/sse-store";
    import { subscribeToDeviceUpdates } from "$lib/stores/device-subscription";
    import { onMount } from 'svelte';
    
    // Import page data
    export let data: PageData;
    
    // Extract data from the server
    $: ({ devices: records, meta, availableTags, userRole, accountId } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    $: props = { records: records as any, availableTags: availableTags || [], pagination, sort, loading };
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["IOT", ""],
        ["Devices", ""]
    ] as [string, string][];

    // Establish SSE connection and subscribe to account devices channel
    onMount(async () => {
        console.log('[UserDeviceList] Setting up SSE connection and account subscription');
        console.log('[UserDeviceList] User role:', userRole, 'Account ID:', accountId);
        
        // Enable SSE for real-time device online/offline status updates
        try {
            await sseStore.connect(`/api/sse`, { withCredentials: true });
            console.log('[UserDeviceList] SSE connected');
        } catch (e) {
            console.debug('[UserDeviceList] SSE already connected');
        }
        
        // Subscribe to account devices (account-level subscription)
        // This replaces per-device subscriptions for scalability
        const subscribed = await subscribeToDeviceUpdates(userRole, accountId);
        
        if (subscribed) {
            console.log('[UserDeviceList] Successfully subscribed to account devices channel');
        } else {
            console.error('[UserDeviceList] Failed to subscribe to account devices channel');
        }
        
        return () => {
            // Disconnect when leaving the page
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
                onClick={() => goto('/user/iot/devices/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <DeviceTable {props} />
</PageContainer>
