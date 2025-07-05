<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ArrowLeft } from 'lucide-svelte';
    import type { PageData } from './$types';
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import SessionsPageContent from '$lib/components/ui_components_sveltekit/sessions/SessionsPageContent.svelte';

    export let data: PageData;

    $: ({ user } = data);
    
    // Define breadcrumbs for this page
    $: pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Team Members", "/user/settings/users"],
        [`${user?.name || user?.email || 'User'}`, `/user/settings/users/${$page.params.id}`],
        ["Sessions", ""]
    ] as [string, string][];

    // Page metadata
    $: pageTitle = `${user?.name || user?.email || 'User'} - Sessions`;
    $: pageDescription = `View and manage active sessions for ${user?.name || user?.email || 'this user'}`;
    $: backButtonUrl = `/user/settings/users/${user?.id || $page.params.id}`;
    $: userDisplayName = user?.name || user?.email || 'User';
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Back to User",
            icon: ArrowLeft,
            onClick: () => goto(backButtonUrl)
        }
    ]}
>

    <SessionsPageContent
        data={data}
        isAdminView={false}
        {backButtonUrl}
        {userDisplayName}
    />
</UserPageLayout>
