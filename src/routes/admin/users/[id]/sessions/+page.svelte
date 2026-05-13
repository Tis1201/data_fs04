<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ArrowLeft } from 'lucide-svelte';
    import type { PageData } from './$types';
    import PageContainer from '$lib/components/ui_components_sveltekit/layout/PageContainer.svelte';
    import PageHeader from '$lib/components/ui_components_sveltekit/layout/PageHeader.svelte';
    import ActionButton from '$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte';
    import SessionsPageContent from '$lib/components/ui_components_sveltekit/sessions/SessionsPageContent.svelte';

    export let data: PageData;

    $: ({ user } = data);
    
    // Define breadcrumbs for this page
    $: pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        [`User`, `/admin/users/${$page.params.id}`],
        ["Sessions", null]
    ] as [string, string | null][];
    
    $: backButtonUrl = `/admin/users/${user?.id || $page.params.id}`;
    $: userDisplayName = user?.name || user?.email || 'User';
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="User Sessions">
        <svelte:fragment slot="action">
            <ActionButton
                label="Back to User"
                icon={ArrowLeft}
                onClick={() => goto(backButtonUrl)}
                variant="outline"
            />
        </svelte:fragment>
    </PageHeader>

    <SessionsPageContent 
        data={data}
        isAdminView={true}
        {backButtonUrl}
        {userDisplayName}
    />
</PageContainer>
