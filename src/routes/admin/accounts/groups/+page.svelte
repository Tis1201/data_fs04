<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    import GroupsTable from "./table.svelte";
    import type { PageData } from "./$types";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the groups table
    $: tableProps = {
        records: data.groups || [],
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
            accounts: data.accounts || []
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts"],
        "Groups"
    ];
</script>

<AdminPageLayout
    title="Groups"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Group",
            icon: Plus,
            onClick: () => goto('/admin/accounts/groups/new')
        }
    ]}
>
    <GroupsTable props={tableProps} />
</AdminPageLayout>
