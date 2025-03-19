<script lang="ts">
    import { page } from "$app/stores";
    import UserTable from "./data-table/user-table.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';

    export let data: PageData;

    $: sort = data.meta.sort;
    $: pagination = data.meta.pagination;

    // Initialize with stored page size
    onMount(() => {
        const storedPageSize = localStorage.getItem("admin_users_page_size");
        if (storedPageSize) {
            const url = new URL(window.location.href);
            url.searchParams.set("per_page", storedPageSize);
            window.history.replaceState({}, "", url.toString());
        }
    });
</script>

<div class="space-y-2 p-2">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Users</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <!-- <div class="flex justify-between items-center">
        <h2 class="text-2xl font-semibold">Users</h2>
        <Button on:click={() => goto('/admin/users/new')}>
            <Plus class="mr-2 h-4 w-4" />
            New User
        </Button>
    </div> -->

    <div class="flex items-center justify-between mb-2">
        <h1 class="text-xl font-semibold">Overview</h1>
        <Button size="sm">
            <Plus class="mr-2 h-4 w-4" />
            Add User
        </Button>
    </div>

    <UserTable
        records={data.data}
        {pagination}
        {sort}
    />
</div>
