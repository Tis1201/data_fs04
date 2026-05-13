<script lang="ts">
    import BundleTable from "$lib/bundles/BundleTable.svelte";
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    /**
     * Props for BundleListPage component
     */
    export let data: any; // PageData from route (bundles, meta)
    export let breadcrumbs: [string, string][];
    export let baseUrl: string; // "/admin/iot/bundles" or "/user/iot/bundles"
    export let newBundlePath: string; // "/admin/iot/bundles/new" or "/user/iot/bundles/new"
    export let title: string = "Bundles";

    $: ({ bundles: records, meta } = data as any);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
</script>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Add Bundle",
            icon: Plus,
            onClick: () => goto(newBundlePath)
        }
    ]}
>
    <BundleTable {baseUrl} {records} {pagination} {sort} {loading} />
</AdminPageLayout>

