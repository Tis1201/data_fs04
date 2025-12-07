<script lang="ts">
    import type { PageData } from "./$types";
    import DeviceListPage from "$lib/components/devices/DeviceListPage.svelte";
    import DeviceTable from "./table.svelte";
    import { getDeviceListBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getDeviceListBreadcrumbs('user');
    
    // Extract user role and account ID for SSE subscription
    $: userRole = data.userRole || 'MEMBER';
    $: accountId = data.accountId;
</script>

<DeviceListPage
    {data}
    {breadcrumbs}
    baseUrl="/user/iot/devices"
    newDevicePath="/user/iot/devices/new"
    title="Devices"
    context="user"
    {userRole}
    {accountId}
    tableComponent={DeviceTable}
/>
