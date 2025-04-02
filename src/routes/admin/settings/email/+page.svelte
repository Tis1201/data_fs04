<script lang="ts">
    import { page } from "$app/stores";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ emails: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        "Email Settings"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Email Settings">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Email Setting"
                icon={Plus}
                onClick={() => goto('/admin/settings/email/new')}
            />
        </svelte:fragment>
    </PageHeader>

   
</PageContainer>
