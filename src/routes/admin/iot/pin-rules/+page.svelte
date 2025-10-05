<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PinRulesTable from "./table.svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";
    
    // Get data from page data
    export let data: PageData;
    
    // Set up table props using the utility
    $: tableProps = {
        records: (data.rules || []) as any[],
        pagination: getDefaultPagination(data.meta, 10),
        sort: getDefaultSort(data.meta, "createdAt", "desc"),
        loading: false
    };

    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Pin Rules", "/admin/iot/pin-rules"]
    ];
</script>

<AdminPageLayout
    title="Pin Rules"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Pin Rule",
            icon: Plus,
            onClick: () => goto("/admin/iot/pin-rules/new")
        }
    ]}
>
    <PinRulesTable props={tableProps} />
</AdminPageLayout>
