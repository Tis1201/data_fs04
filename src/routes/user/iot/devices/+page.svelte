<script lang="ts">
    import DeviceTable from "./table.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Plus } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";
    
    // Import page data
    export let data: PageData;
    
    // Define page metadata
    const pageTitle = "My IoT Devices";
    const pageDescription = "View and manage your connected IoT devices";
    
    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["IoT", "/user/iot"],
        ["Devices", ""]
    ] as [string, string][];
    
    // Extract data from the server
    $: ({ devices: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Device",
            icon: Plus,
            onClick: () => goto('/user/iot/devices/new'),
            variant: "default"
        }
    ]}
>
    <div class="flex flex-col space-y-4">        
        <!-- Device Table -->
        <DeviceTable
            props={{
                records,
                pagination,
                sort,
                loading
            }}
        />
        
        <!-- Help text -->
        <p class="text-sm text-muted-foreground">
            Having trouble connecting a device? <a href="/user/help/iot" class="text-primary hover:underline">Get help</a>
        </p>
    </div>
</UserPageLayout>
