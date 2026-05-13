<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';

    onMount(() => {
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
                <BreadcrumbPage>VPU</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex items-center justify-between mb-2">
        <h1 class="text-xl font-semibold">VPU</h1>
        <Button size="sm">
            <Plus class="mr-2 h-4 w-4" />
            Test
        </Button>
    </div>

    
</div>
