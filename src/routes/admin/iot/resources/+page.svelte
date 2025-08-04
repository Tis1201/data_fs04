<script lang="ts">
    import ResourceTable from "./table.svelte";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import {
        initPagination,
        getDefaultPagination,
        getDefaultSort
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { Resource } from "@prisma/client";

    export let data: PageData;

    // reactive state with safe defaults
    let records: Resource[] = [];
    let meta: any = {};
    let pagination: any;
    let sort: any;
    let loading = false;

    // extract from incoming data when available (with defaults)
    $: ({ resources: records = [], meta = {} } = data ?? {});
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");

    initPagination("preferredPageSize", true);

    const pageCrumbs = [
        ["Admin", "/admin"],
        "IOT",
        "Resources"
    ];
</script>

<AdminPageLayout
    title="Resources"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Resource",
            icon: Plus,
            onClick: () => goto("/admin/iot/resources/new")
        }
    ]}
>
    <ResourceTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>
