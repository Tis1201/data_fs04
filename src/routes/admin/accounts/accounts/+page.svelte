<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import AccountsTable from "./table.svelte";
    import { Card } from "$lib/components/ui/card";
    
    // Mock data for the accounts table
    const accounts = [
        { id: 1, name: 'Account 1', status: 'Active', createdAt: '2025-05-01', updatedAt: '2025-05-13' },
        { id: 2, name: 'Account 2', status: 'Inactive', createdAt: '2025-04-15', updatedAt: '2025-05-10' },
        { id: 3, name: 'Account 3', status: 'Active', createdAt: '2025-03-22', updatedAt: '2025-05-05' },
        { id: 4, name: 'Account 4', status: 'Pending', createdAt: '2025-05-10', updatedAt: '2025-05-12' },
        { id: 5, name: 'Account 5', status: 'Active', createdAt: '2025-04-30', updatedAt: '2025-05-11' }
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
        "Accounts",
        "Accounts List"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Accounts">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Account"
                icon={Plus}
                onClick={() => goto('/admin/accounts/accounts/new')}
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        <Card class="w-full">
            <AccountsTable 
                accounts={accounts}
                meta={meta}
                loading={loading}
            />
        </Card>
    </PageContent>
</PageContainer>
