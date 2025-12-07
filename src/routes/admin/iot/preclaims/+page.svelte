<script lang="ts">
    import type { PageData } from "./$types";
    import PreclaimListPage from "$lib/components/preclaims/PreclaimListPage.svelte";
    import { getPreclaimListBreadcrumbs } from "$lib/utils/navigation";
    import PreclaimTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getPreclaimListBreadcrumbs('admin');
</script>

<PreclaimListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/preclaims"
    newPreclaimPath="/admin/iot/preclaims/new"
    title="Preclaim Sets"
    context="admin"
    tableComponent={PreclaimTable}
/>