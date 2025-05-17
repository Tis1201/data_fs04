<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import CompaniesTable from "./table.svelte";
    import type { PageData } from "./$types";
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the companies table
    $: tableProps = {
        records: data.companies || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: data.sort?.order || "desc"
        },
        loading: false,
        filters: {
            industries: data.filters?.industries || [],
            accounts: data.accounts || []
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts"],
        "Companies"
    ];
</script>

<AdminPageLayout
    title="Companies"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Company",
            icon: Plus,
            onClick: () => goto('/admin/accounts/companies/new')
        }
    ]}
>
    <CompaniesTable props={tableProps} />
</AdminPageLayout>
