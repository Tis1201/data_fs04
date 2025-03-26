<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ArrowLeft } from 'lucide-svelte';
    import type { PageData } from './$types';
    import PageContainer from '$lib/components/ui_components_sveltekit/layout/PageContainer.svelte';
    import PageHeader from '$lib/components/ui_components_sveltekit/layout/PageHeader.svelte';
    import ActionButton from '$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte';
    import { initPagination, getDefaultPagination, getDefaultSort } from '$lib/components/ui_components_sveltekit/table/pagination/pagination-utils';
    import SessionsTable from './table.svelte';

    export let data: PageData;

    $: ({ sessions: records, meta, user } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    $: pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        [`User`, `/admin/users/${$page.params.id}`],
        "Sessions"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="User Sessions">
        <svelte:fragment slot="action">
            <ActionButton
                label="Back to User"
                icon={ArrowLeft}
                onClick={() => goto(`/admin/users/${user?.id || $page.params.id}`)}
                variant="outline"
            />
        </svelte:fragment>
    </PageHeader>

    <SessionsTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
