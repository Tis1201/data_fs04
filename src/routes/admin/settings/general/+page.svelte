<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { Plus } from "lucide-svelte";

    export let data: PageData;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        "General Settings"
    ];

    onMount(() => {
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="General Settings">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Setting"
                icon={Plus}
                onClick={() => goto('/admin/settings/general/new')}
            />
        </svelte:fragment>
    </PageHeader>
</PageContainer>
