<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import AccountsTable from "./table.svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";
    
    // Get data from page data
    export let data: PageData;
    
    // Set up table props using the utility
    $: tableProps = {
        records: data.accounts || [],
        pagination: getDefaultPagination(data.meta, 10),
        sort: getDefaultSort(data.meta, "createdAt", "desc"),
        loading: false
    };

    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts/accounts"],
        "Accounts List"
    ];
    
    // Handle page load
    onMount(() => {
        // Any initialization code here
    });
</script>

<AdminPageLayout
    title="Accounts"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Account",
            icon: Plus,
            onClick: () => goto("/admin/accounts/accounts/new")
        }
    ]}
>
    <AccountsTable props={tableProps} />
</AdminPageLayout>