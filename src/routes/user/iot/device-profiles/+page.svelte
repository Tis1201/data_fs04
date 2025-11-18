<script lang="ts">
    import DeviceProfilesPage from "$lib/components/shared/DeviceProfilesPage.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string | null][] = [
        ["User", "/user"],
        ["IOT", ""],
        ["Device Profiles", "/user/iot/device-profiles"],
    ];
</script>

<DeviceProfilesPage 
    {data} 
    context="user" 
    title="Device Profiles"
    breadcrumbs={pageCrumbs}
/>
