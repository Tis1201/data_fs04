<script lang="ts">
    import type { PageData } from "./$types";
    import BundleListPage from "$lib/components/bundles/BundleListPage.svelte";

    export let data: PageData;

    // Define breadcrumbs for admin route
    const breadcrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"]
    ];
</script>

<BundleListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/bundles"
    newBundlePath="/admin/iot/bundles/new"
    title="Bundles"
/>
