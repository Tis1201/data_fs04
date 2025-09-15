<script lang="ts">
    import DeviceProfilesPage from "$lib/components/shared/DeviceProfilesPage.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string | null][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Device Profiles", null]
    ];
</script>

<DeviceProfilesPage 
    {data} 
    context="admin" 
    title="Device Profiles"
    breadcrumbs={pageCrumbs}
/>