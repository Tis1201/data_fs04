<script lang="ts">
    import PinRuleCreatePage from "$lib/components/pin-rules/PinRuleCreatePage.svelte";

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Pin Rules", "/admin/iot/pin-rules"]
    ];
</script>

<PinRuleCreatePage
    title="New Pin Rule"
    breadcrumbs={pageCrumbs}
    basePath="/admin"
    apiPrefix="/api/v2"
    context="admin"
    ruleType="admin_custom"
/>
