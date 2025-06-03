<script lang="ts">
    import BundleTable from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ bundles: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "IOT",
        "Bundles"
    ];
</script>

<AdminPageLayout
    title="Bundles"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Bundle",
            icon: Plus,
            onClick: () => goto('/admin/iot/bundles/new')
        }
    ]}
>
    <BundleTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>
