<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "IOT",
        "Factory Tokens"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Factory Tokens">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Factory Token"
                icon={Plus}
                onClick={() => goto('/admin/iot/devices/new')}
            />
        </svelte:fragment>
    </PageHeader>
</PageContainer>
