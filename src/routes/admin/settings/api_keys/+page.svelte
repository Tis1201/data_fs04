<script lang="ts">
    import Table from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ apiKeys: records, meta } = data);
    // $: console.log('API Keys:', records);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        "API Keys"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="API Keys">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add API Keys"
                icon={Plus}
                onClick={() => goto('/admin/settings/api_keys/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <Table
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
