<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import GroupsTable from "./table.svelte";
    import { Card } from "$lib/components/ui/card";
    
    // Mock data for the groups table
    const groups = [
        { id: 1, name: 'Administrators', members: 8, permissions: 'Full Access', createdAt: '2025-01-15', updatedAt: '2025-05-10' },
        { id: 2, name: 'Developers', members: 24, permissions: 'Edit Access', createdAt: '2025-02-22', updatedAt: '2025-04-30' },
        { id: 3, name: 'Support Team', members: 12, permissions: 'View Access', createdAt: '2025-03-10', updatedAt: '2025-05-05' },
        { id: 4, name: 'Marketing', members: 15, permissions: 'Limited Access', createdAt: '2025-04-05', updatedAt: '2025-05-12' },
        { id: 5, name: 'Finance', members: 6, permissions: 'View Access', createdAt: '2025-03-30', updatedAt: '2025-05-08' }
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
        "Groups"
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Groups">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Group"
                icon={Plus}
                onClick={() => goto('/admin/accounts/groups/new')}
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        <Card class="w-full">
            <GroupsTable 
                groups={groups}
                meta={meta}
                loading={loading}
            />
        </Card>
    </PageContent>
</PageContainer>
