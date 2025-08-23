<script lang="ts">
    import FactoryTokenTable from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ factoryTokens: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = meta?.sort || { field: "issuedAt", order: "desc" };
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
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
                label="Add Token"
                icon={Plus}
                onClick={() => goto('/admin/iot/factory_tokens/new')}
                disabled={records.length > 0}
            />
        </svelte:fragment>
    </PageHeader>

    <FactoryTokenTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
