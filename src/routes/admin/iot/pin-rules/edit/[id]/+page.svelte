<script lang="ts">
    import type { PageData } from "./$types";
    import PinRuleEditPage from "$lib/components/pin-rules/PinRuleEditPage.svelte";
    import { getPinRuleEditBreadcrumbs } from "$lib/utils/navigation";

    export let data: PageData;

    // Make rule reactive to server invalidations
    let rule = data.rule;
    $: rule = data.rule;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getPinRuleEditBreadcrumbs('admin', rule?.name, rule?.id);
    $: title = `Edit Pin Rule: ${rule?.name || 'Unnamed'}`;
</script>

<PinRuleEditPage
    {rule}
    {title}
    {breadcrumbs}
    basePath="/admin"
    apiPrefix="/api/v2"
    context="admin"
    showDelete={false}
/>