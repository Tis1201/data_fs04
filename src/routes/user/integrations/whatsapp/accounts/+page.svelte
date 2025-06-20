<script lang="ts">
    import type { PageData } from "./$types";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import RecordTable from "./table.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { goto } from "$app/navigation";
    import { Plus } from "lucide-svelte";
    
    export let data: PageData;
    
    $: ({ accounts: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["User", "/user"],
        ["Integrations", "/user/integrations"],
        "WhatsApp"
    ];
    
    const pageTitle = "WhatsApp Accounts";
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Account",
            icon: Plus,
            onClick: () => goto('/user/integrations/whatsapp/accounts/new'),
            variant: "default"
        }
    ]}
>
    <div class="flex flex-col space-y-4">        
        <!-- WhatsApp Accounts Table -->
        <RecordTable
            props={{
                records,
                pagination,
                sort,
                loading
            }}
        />
    </div>
</UserPageLayout>
