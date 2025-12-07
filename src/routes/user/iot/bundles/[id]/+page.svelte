<script lang="ts">
    import type { PageData } from "./$types";
    import BundleDetailPage from "$lib/components/bundles/BundleDetailPage.svelte";
    import { getBundleDetailBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getBundleDetailBreadcrumbs('user', bundle?.name);
</script>

<BundleDetailPage
    bundle={bundle}
    bundleDevices={data.bundleDevices || []}
    resources={data.resources}
    title={data.meta?.title || `Bundle: ${bundle?.name || bundle?.id || 'Unknown'}`}
    pageCrumbs={breadcrumbs}
    context="user"
    basePath="/user/iot/bundles"
    enableDeviceTracking={false}
    enableStopAllWaves={false}
/>
