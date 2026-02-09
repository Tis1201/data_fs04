<script lang="ts">
    import type { PageData } from './$types';
    import { invalidate } from '$app/navigation';
    import PinRuleEditPage from '$lib/components/pin-rules/PinRuleEditPage.svelte';
    import PinRuleEditModal from '$lib/components/pin-rules/PinRuleEditModal.svelte';
    import { getPinRuleDetailBreadcrumbs } from '$lib/utils/navigation';

    export let data: PageData;

    let rule = data.rule;
    $: rule = data.rule;

    let editModalOpen = false;

    /** Update rule immediately from modal save response, then invalidate so load data stays in sync. */
    async function handleEditModalSaved(updatedRule?: any) {
        if (updatedRule) rule = updatedRule;
        await invalidate('app:pin-rules');
    }

    $: breadcrumbs = getPinRuleDetailBreadcrumbs('user', rule?.name, rule?.id);
    $: title = rule?.name ? `Pin Rule: ${rule.name}` : 'Pin Rule';
    $: showDelete = rule?.ruleType === 'user_custom';

    function handleEditClick() {
        editModalOpen = true;
    }
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
    onEditClick={handleEditClick}
/>

<PinRuleEditModal
    bind:open={editModalOpen}
    rule={rule}
    onSaved={handleEditModalSaved}
    on:saved={handleEditModalSaved}
/>
