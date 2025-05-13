<script lang="ts">
    import { ArrowLeft } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import WebSocketTest from './websocket-test.svelte';
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Debug", "/admin/debug"],
        "WebSocket"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="WebSocket Debug">
        <svelte:fragment slot="action">
            <ActionButton
                label="Back"
                icon={ArrowLeft}
                href="/admin/debug"
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        <WebSocketTest />
    </PageContent>
</PageContainer>
