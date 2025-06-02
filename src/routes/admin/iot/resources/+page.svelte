<script lang="ts">
    import ResourceTable from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ resources: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "IOT",
        "Resources"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Resources">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Resource"
                icon={Plus}
                onClick={() => goto('/admin/iot/resources/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <ResourceTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
