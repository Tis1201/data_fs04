<script lang="ts">
    import type { PageData } from './$types';
    import PinRuleListPage from "$lib/components/pin-rules/PinRuleListPage.svelte";
    import { getPinRuleListBreadcrumbs } from "$lib/utils/navigation";
    import PinRuleTable from "./table.svelte";

    export let data: PageData;

    // Generate breadcrumbs using navigation utility
    const breadcrumbs = getPinRuleListBreadcrumbs('user');
</script>

<PinRuleListPage
    {data}
    {breadcrumbs}
    baseUrl="/user/iot/pin-rules"
    newPinRulePath="/user/iot/pin-rules/new"
    title="Pin Rules"
    context="user"
    tableComponent={PinRuleTable}
    currentUserId={data.user?.id}
    accountRole={data.accountRole}
/>
