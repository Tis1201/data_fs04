<script lang="ts">
    import type { PageData } from "./$types";
    import BundleListPage from "$lib/components/bundles/BundleListPage.svelte";

    export let data: PageData;

    // Define breadcrumbs for user route
    const breadcrumbs: [string, string][] = [
        ["HOME", "/user"],
        ["IOT", ""],
        ["Bundles", "/user/iot/bundles"]
    ];
</script>

<BundleListPage
    {data}
    {breadcrumbs}
    baseUrl="/user/iot/bundles"
    newBundlePath="/user/iot/bundles/new"
    title="Bundles"
/>
