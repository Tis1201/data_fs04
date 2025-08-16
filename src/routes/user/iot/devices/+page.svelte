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
    import { onMount } from 'svelte';
    
    // Import page data
    export let data: PageData;
    
    // Extract data from the server
    $: ({ devices: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    $: props = { records: records as any, pagination, sort, loading };
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["IoT", "/user/iot"],
        ["Devices", ""]
    ] as [string, string][];

    // Establish SSE connection once for the list page (DeviceTable will subscribe per-record)
    onMount(() => {
        try {
            sseStore.connect(`/api/sse`, { withCredentials: true });
        } catch (e) {
            // ignore if already connected
        }
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