<script lang="ts">
    import LicensesTable from "./table.svelte";
    import type { PageData } from "./$types";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { Plus } from "lucide-svelte";
    import { initPagination, getDefaultPagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ licenses: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = meta?.sort || { field: "issuedAt", order: "desc" };
    let loading = false;

    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Breadcrumbs
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Billing",
        "Licenses"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Licenses">
        <svelte:fragment slot="action">
            <ActionButton label="Add License" icon={Plus} href="/admin/billing/licenses/new" />
        </svelte:fragment>
    </PageHeader>

    <LicensesTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
