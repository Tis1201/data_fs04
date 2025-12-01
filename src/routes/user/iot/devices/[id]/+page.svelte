<script lang="ts">
    import type { PageData } from "./$types";
    import DeviceDetailPage from "$lib/components/device/DeviceDetailPage.svelte";

    export let data: PageData;

    // Extract data from server
    const device = (data as any).device;
    const licenses = device.licenses;
    const deviceActionLogs = (data as any).deviceActionLogs;
    const deviceInformation = (data as any).deviceInformation;
    const deviceProfile = (data as any).deviceProfile;
    const deviceProfileForm = (data as any).deviceProfileForm;
    const form = (data as any).form;

    const title = device.name || "Device Details";

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Home", "/user"],
        ["Devices", "/user/iot/devices"],
        [device.name || "Device", ""],
    ];
</script>

<DeviceDetailPage
    {device}
    {licenses}
    {deviceActionLogs}
    {deviceInformation}
    {deviceProfile}
    {deviceProfileForm}
    {form}
    {title}
    {pageCrumbs}
    basePath="/user"
    resourceApiPath="/api/user/resources"
/>
