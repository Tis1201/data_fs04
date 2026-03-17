<script lang="ts">
    import type { PageData } from './$types';
    import { invalidate } from '$app/navigation';
    import PinRuleEditPage from '$lib/components/pin-rules/PinRuleEditPage.svelte';
    import PinRuleEditModal from '$lib/components/pin-rules/PinRuleEditModal.svelte';
    import { getPinRuleDetailBreadcrumbs } from '$lib/utils/navigation';

    export let data: PageData;

    let rule = data.rule;
    $: rule = data.rule;

    $: breadcrumbs = getPinRuleDetailBreadcrumbs('user', rule?.name, rule?.id);
    $: title = rule?.name ? `Pin Rule: ${rule.name}` : 'Pin Rule';
    $: showDelete = rule?.ruleType === 'user_custom';
    $: canEdit = data.canEdit ?? false;

    let editModalOpen = false;
</script>

<PinRuleEditPage
    {rule}
    {title}
    {breadcrumbs}
    basePath="/user"
    apiPrefix="/api/v2"
    context="user"
    {showDelete}
    readOnly={true}
    showEditButton={canEdit}
    onEditClick={() => { editModalOpen = true; }}
/>

<PinRuleEditModal
    bind:open={editModalOpen}
    {rule}
    apiPrefix="/api/v2"
    onSaved={async () => {
        await invalidate('app:pin-rules');
        editModalOpen = false;
    }}
    on:saved={async () => {
        await invalidate('app:pin-rules');
    }}
/>
