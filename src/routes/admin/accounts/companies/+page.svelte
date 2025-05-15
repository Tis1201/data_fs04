<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import CompaniesTable from "./table.svelte";
    import { Card } from "$lib/components/ui/card";
    import type { PageData } from "./$types";
    
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

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Companies">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Company"
                icon={Plus}
                onClick={() => goto('/admin/accounts/companies/new')}
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        <CompaniesTable props={tableProps} />
    </PageContent>
</PageContainer>
