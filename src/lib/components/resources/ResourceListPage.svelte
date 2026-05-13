<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { ComponentType } from 'svelte';

    /**
     * Props for ResourceListPage component
     */
    export let data: any; // PageData from route (resources, meta)
    export let breadcrumbs: [string, string][];
    export let baseUrl: string; // "/admin/iot/resources"
    export let newResourcePath: string; // "/admin/iot/resources/new"
    export let title: string = "Resources";
    export let tableComponent: ComponentType; // The table component to use (from route)

    $: ({ resources: records, meta } = data as any);
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
            label: "Add Resource",
            icon: Plus,
            onClick: () => goto(newResourcePath)
        }
    ]}
>
    <!-- Use the table component from the route -->
    <svelte:component
        this={tableComponent}
        props={{
            records: records || [],
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>

