<script lang="ts">
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import RecordTable from "./table.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    
    export let data: PageData;
    
    $: ({ accounts: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["WhatsApp", null],
        "Accounts"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="WhatsApp Accounts">
        <svelte:fragment slot="action">
            <ActionButton
                label="New Account"
                icon={Plus}
                onClick={() => goto('/admin/settings/whatsapp/accounts/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <RecordTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
