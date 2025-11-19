<script lang="ts">
    import type { PageData } from './$types';
    import PinRuleEditPage from "$lib/components/pin-rules/PinRuleEditPage.svelte";
    import { getPinRuleEditBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make rule reactive to server invalidations
    let rule = data.rule;
    $: rule = data.rule;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getPinRuleEditBreadcrumbs('user', rule?.name, rule?.id);
    $: title = `Edit Pin Rule: ${rule?.name || 'Unnamed'}`;
    $: showDelete = rule?.ruleType === 'user_custom';
</script>

<PinRuleEditPage
    {rule}
    {title}
    {breadcrumbs}
    basePath="/user"
    apiPrefix="/api/v2"
    context="user"
    {showDelete}
/>
