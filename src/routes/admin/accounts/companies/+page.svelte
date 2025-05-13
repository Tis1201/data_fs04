<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import CompaniesTable from "./table.svelte";
    import { Card } from "$lib/components/ui/card";
    
    // Mock data for the companies table
    const companies = [
        { id: 1, name: 'Acme Corporation', industry: 'Technology', employees: 1200, createdAt: '2025-03-15', updatedAt: '2025-05-10' },
        { id: 2, name: 'Globex Industries', industry: 'Manufacturing', employees: 850, createdAt: '2025-02-22', updatedAt: '2025-04-30' },
        { id: 3, name: 'Oceanic Airlines', industry: 'Transportation', employees: 3500, createdAt: '2025-01-10', updatedAt: '2025-05-05' },
        { id: 4, name: 'Stark Enterprises', industry: 'Energy', employees: 2100, createdAt: '2025-04-05', updatedAt: '2025-05-12' },
        { id: 5, name: 'Wayne Industries', industry: 'Defense', employees: 4200, createdAt: '2025-03-30', updatedAt: '2025-05-08' }
    ];
    
    // Mock metadata for pagination
    const meta = {
        totalItems: 5,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1
    };
    
    let loading = false;
    
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
        <Card class="w-full">
            <CompaniesTable 
                companies={companies}
                meta={meta}
                loading={loading}
            />
        </Card>
    </PageContent>
</PageContainer>
