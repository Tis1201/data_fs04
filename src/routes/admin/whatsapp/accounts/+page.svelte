<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import WhatsAppAccountsTable from "./table.svelte";
    
    export let data: PageData;
    
    let loading = false;
    
    onMount(() => {
    });
    
    function handleCreateAccount() {
        goto("/admin/whatsapp/accounts/new");
    }
</script>

<div class="space-y-2 p-2">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Whatsapp</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Account</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex items-center justify-between mb-2">
        <h1 class="text-xl font-semibold">
            WhatsApp Accounts
        </h1>
        <Button variant="default" on:click={handleCreateAccount}>
            <Plus class="mr-2 h-4 w-4" />
            Add Account
        </Button>
    </div>

    <WhatsAppAccountsTable
        records={data.accounts || []}
        pagination={data.meta?.pagination || { page: 1, per_page: 10, total_records: 0, total_pages: 0 }}
        sort={data.meta?.sort || { field: "createdAt", order: "desc" }}
        {loading}
    />
    
</div>
