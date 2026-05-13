<script lang="ts">
    import type { PageData } from "./$types";
    import PinRuleEditPageAdmin from "$lib/components/pin-rules/PinRuleEditPageAdmin.svelte";

    export let data: PageData;

    let rule = data.rule;
    $: rule = data.rule;
</script>

<PinRuleEditPageAdmin
    {rule}
    basePath="/admin"
    apiPrefix="/api/v2"
/>
