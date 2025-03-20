<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import WhatsAppAccountsTable from "./table.svelte";
    
    export let data: PageData;
    
    $: ({ accounts: records, meta } = data);
    $: pagination = meta?.pagination || { page: 1, per_page: 10, total_records: 0, total_pages: 0 };
    $: sort = meta?.sort || { field: "createdAt", order: "desc" };
    
    let loading = false;
    
    // Initialize with stored page size
    onMount(() => {
        const url = new URL(window.location.href);
        const storedSize = localStorage.getItem('preferredPageSize');
        if (storedSize && storedSize !== url.searchParams.get('per_page')) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('per_page', storedSize);
            newUrl.searchParams.set('page', '1');
            goto(newUrl.toString(), { replaceState: true });
        }
    });
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>WhatsApp Accounts</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <h2 class="text-3xl font-bold tracking-tight">WhatsApp Accounts</h2>
        <Button on:click={() => goto('/admin/whatsapp/accounts/new')}>
            <Plus class="mr-2 h-4 w-4" />
            New Account
        </Button>
    </div>

    <WhatsAppAccountsTable
        {records}
        {pagination}
        {sort}
        {loading}
    />
</div>
