<script lang="ts">
    import { invalidate } from '$app/navigation';
    import type { PageData } from "./$types";
    import BundleDetailPage from "$lib/components/bundles/BundleDetailPage.svelte";
    import EditDeploymentModal from "../components/EditDeploymentModal.svelte";
    import { getBundleDetailBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    let showEditModal = false;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getBundleDetailBreadcrumbs('user', bundle?.name);

    async function handleEditSaved() {
        showEditModal = false;
        await invalidate('app:bundle');
    }
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
    onEditRequested={() => (showEditModal = true)}
/>

<EditDeploymentModal
    open={showEditModal}
    bundle={bundle}
    on:close={() => (showEditModal = false)}
    on:saved={handleEditSaved}
/>
