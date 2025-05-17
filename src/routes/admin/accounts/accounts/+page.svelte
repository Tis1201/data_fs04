<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import AccountsTable from "./table.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    
    // Get data from page data
    export let data;
    
    // Set up table props
    let tableProps = {
        records: data.accounts,
        pagination: data.pagination,
        sort: data.sort,
        loading: false
    };
    
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

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Accounts">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Account"
                icon={Plus}
                href="/admin/accounts/accounts/new"
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        
            
                <AccountsTable props={tableProps} />
            
        
    </PageContent>
</PageContainer>
