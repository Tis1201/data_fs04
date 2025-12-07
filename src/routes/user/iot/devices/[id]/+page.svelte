<script lang="ts">
    import type { PageData } from "./$types";
    import DeviceDetailPage from "$lib/components/device/DeviceDetailPage.svelte";
    import { getDeviceDetailBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make device reactive to server invalidations
    let device = data.device;
    $: device = data.device;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getDeviceDetailBreadcrumbs('user', device?.name, device?.id);
</script>

<DeviceDetailPage
    {device}
    licenses={data.device?.licenses || []}
    deviceActionLogs={data.deviceActionLogs || []}
    deviceInformation={data.deviceInformation}
    deviceProfile={data.deviceProfile}
    deviceProfileForm={data.deviceProfileForm}
    form={data.form}
    title={data.meta?.title || `Device: ${device?.name || device?.id || 'Unknown'}`}
    pageCrumbs={breadcrumbs}
    basePath="/user"
    resourceApiPath="/api/user/resources"
/>
