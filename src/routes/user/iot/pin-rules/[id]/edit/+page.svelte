<script lang="ts">
    import type { PageData } from './$types';
    import PinRuleEditFormPage from '$lib/components/pin-rules/PinRuleEditFormPage.svelte';
    import { getPinRuleEditBreadcrumbs } from '$lib/utils/navigation';

    export let data: PageData;

    let rule = data.rule;
    $: rule = data.rule;

    $: breadcrumbs = getPinRuleEditBreadcrumbs('user', rule?.name, rule?.id);
    $: title = rule?.name ? `Edit Pin Rule: ${rule.name}` : 'Edit Pin Rule';
</script>

<PinRuleEditFormPage
    {rule}
    {title}
    {breadcrumbs}
    basePath="/user"
    apiPrefix="/api/v2"
    context="user"
/>
