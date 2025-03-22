<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageBreadcrumb from "$lib/components/ui_components_sveltekit/layout/PageBreadcrumb.svelte";
    import RecordTable from "./table.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    
    export let data: PageData;
    
    $: ({ accounts: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
</script>

<div class="space-y-6">
    <PageBreadcrumb
        crumbs={[
            "Admin", "/admin",
            "WhatsApp", "/admin/whatsapp",
            "Accounts"
        ]}
    />

    <div class="flex justify-between items-center">
        <h2 class="text-3xl font-bold tracking-tight">WhatsApp Accounts</h2>
        <Button on:click={() => goto('/admin/whatsapp/accounts/new')}>
            <Plus class="mr-2 h-4 w-4" />
            New Account
        </Button>
    </div>

    <RecordTable
        {records}
        {pagination}
        {sort}
        {loading}
    />
</div>
