<script lang="ts">
    import type { PageData } from './$types';
    import ResourceDetailPage from '$lib/components/resources/ResourceDetailPage.svelte';
    import { getResourceDetailBreadcrumbs } from '$lib/utils/navigation';

    export let data: PageData;

    // Make resource reactive to server invalidations
    let resource = data.resource;
    $: resource = data.resource;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getResourceDetailBreadcrumbs(resource?.name, resource?.id);
    $: title = `Resource: ${resource?.name || 'Unnamed'}`;
</script>

<ResourceDetailPage
    {resource}
    form={data.form}
    createdByUser={data.createdByUser}
    updatedByUser={data.updatedByUser}
    accountOptions={data.accountOptions || []}
    resourceTypes={data.resourceTypes || []}
    {title}
    {breadcrumbs}
    basePath="/admin"
    showAccountField={true}
    deleteAction="?/delete"
/>
