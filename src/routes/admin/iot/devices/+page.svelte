<script lang="ts">
    import type { PageData } from "./$types";
    import DeviceListPage from "$lib/components/devices/DeviceListPage.svelte";
    import DeviceTable from "./table.svelte";
    import { getDeviceListBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getDeviceListBreadcrumbs('admin');
</script>

<DeviceListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/devices"
    newDevicePath="/admin/iot/devices/new"
    title="Devices"
    context="admin"
    tableComponent={DeviceTable}
/>
