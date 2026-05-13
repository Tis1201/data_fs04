<script lang="ts">
    import type { PageData } from "./$types";
    import FactoryTokenListPage from "$lib/components/factory-tokens/FactoryTokenListPage.svelte";
    import { getFactoryTokenListBreadcrumbs } from "$lib/utils/navigation";
    import FactoryTokenTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getFactoryTokenListBreadcrumbs();
</script>

<FactoryTokenListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/factory_tokens"
    newTokenPath="/admin/iot/factory_tokens/new"
    title="Factory Tokens"
    tableComponent={FactoryTokenTable}
/>
