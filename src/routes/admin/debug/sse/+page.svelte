<script>

    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Debug",
        "SSE"
    ];
</script>
<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="SSE">
        <svelte:fragment slot="action">
            <!-- <ActionButton
                label="Add User"
                icon={Plus}
                onClick={() => goto('/admin/users/new')}
            /> -->
        </svelte:fragment>
    </PageHeader>
</PageContainer>