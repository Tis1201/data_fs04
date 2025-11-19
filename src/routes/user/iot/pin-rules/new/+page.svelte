<script lang="ts">
    import PinRuleCreatePage from "$lib/components/pin-rules/PinRuleCreatePage.svelte";

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["User", "/user"],
        ["IoT", "/user/iot"],
        ["Pin Rules", "/user/iot/pin-rules"]
    ];
</script>

<PinRuleCreatePage
    title="New Pin Rule"
    breadcrumbs={pageCrumbs}
    basePath="/user"
    apiPrefix="/api/v2"
    context="user"
    ruleType="user_custom"
/>
