<script lang="ts">
    import type { PageData } from "./$types";
    import ResourceListPage from "$lib/components/resources/ResourceListPage.svelte";
    import { getResourceListBreadcrumbs } from "$lib/utils/navigation";
    import ResourceTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getResourceListBreadcrumbs();
</script>

<ResourceListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/resources"
    newResourcePath="/admin/iot/resources/new"
    title="Resources"
    tableComponent={ResourceTable}
/>
