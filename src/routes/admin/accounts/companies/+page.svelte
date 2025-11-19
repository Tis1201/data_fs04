<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import CompaniesTable from "./table.svelte";
    import type { PageData } from "./$types";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { createTableProps } from "$lib/utils/table-props-utils";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the companies table using the utility
    $: tableProps = createTableProps(data, {
        recordsKey: 'companies',
        defaultSort: { field: 'createdAt', order: 'desc' },
        additionalProps: {
            filters: {
                industries: data.filters?.industries || [],
                accounts: data.accounts || []
            }
        }
    });
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", ""],
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
