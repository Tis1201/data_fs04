<script lang="ts">
    import type { PageData } from "./$types";
    import PreclaimDetailPage from "$lib/components/preclaims/PreclaimDetailPage.svelte";
    import { getPreclaimDetailBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make preclaimSet reactive to server invalidations
    let preclaimSet = data.preclaimSet;
    $: preclaimSet = data.preclaimSet;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getPreclaimDetailBreadcrumbs('admin', preclaimSet?.name, preclaimSet?.id);
    $: title = `Pre-claim Set: ${preclaimSet?.name || preclaimSet?.id || 'Unknown'}`;
</script>

<PreclaimDetailPage
    {preclaimSet}
    claims={data.claims || []}
    metrics={data.metrics}
    {title}
    {breadcrumbs}
    basePath="/admin"
    apiPrefix="/api/v2"
    isAdmin={true}
/>
