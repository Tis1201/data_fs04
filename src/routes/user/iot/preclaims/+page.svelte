<script lang="ts">
    import type { PageData } from "./$types";
    import PreclaimListPage from "$lib/components/preclaims/PreclaimListPage.svelte";
    import { getPreclaimListBreadcrumbs } from "$lib/utils/navigation";
    import PreclaimTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getPreclaimListBreadcrumbs('user');
</script>

<PreclaimListPage
    {data}
    {breadcrumbs}
    baseUrl="/user/iot/preclaims"
    newPreclaimPath="/user/iot/preclaims/new"
    title="Preclaim Sets"
    context="user"
    tableComponent={PreclaimTable}
/>
