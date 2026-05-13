<script lang="ts">
    import DeviceProfilesPage from "$lib/components/shared/DeviceProfilesPage.svelte";
    import type { PageData } from "./$types";
    import { getDeviceProfileListBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;
    
    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getDeviceProfileListBreadcrumbs('admin');
</script>

<DeviceProfilesPage 
    {data} 
    context="admin" 
    title="Device Profiles"
    {breadcrumbs}
/>