<script lang="ts">
    import type { PageData } from "./$types";
    import PinRuleListPage from "$lib/components/pin-rules/PinRuleListPage.svelte";
    import { getPinRuleListBreadcrumbs } from "$lib/utils/navigation";
    import PinRulesTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getPinRuleListBreadcrumbs('admin');
</script>

<PinRuleListPage
    {data}
    {breadcrumbs}
    baseUrl="/admin/iot/pin-rules"
    newPinRulePath="/admin/iot/pin-rules/new"
    title="Pin Rules"
    context="admin"
    tableComponent={PinRulesTable}
/>
