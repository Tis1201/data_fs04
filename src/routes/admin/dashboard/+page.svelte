<script lang="ts">
    import { page } from "$app/stores";
    import { Plus } from "lucide-svelte";
    
    import { Button } from "$lib/components/ui/button";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';

</script>

<div class="space-y-2 p-2">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Apps</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>
    
    <div class="flex items-center justify-between mb-2">
        <h1 class="text-xl font-semibold">Dashboard</h1>
        <Button size="sm">
            <Plus class="mr-2 h-4 w-4" />
            Refresh
        </Button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="rounded-lg border bg-card text-card-foreground p-4">
            <div class="flex flex-col gap-3">
                <h3 class="text-base font-medium">Total Users</h3>
                <div class="text-2xl font-semibold">0</div>
                <p class="text-sm text-muted-foreground">Registered users in the system</p>
            </div>
        </div>
        
        <div class="rounded-lg border bg-card text-card-foreground p-4">
            <div class="flex flex-col gap-3">
                <h3 class="text-base font-medium">Total Companies</h3>
                <div class="text-2xl font-semibold">0</div>
                <p class="text-sm text-muted-foreground">Companies registered in the platform</p>
            </div>
        </div>
        
        <div class="rounded-lg border bg-card text-card-foreground p-4">
            <div class="flex flex-col gap-3">
                <h3 class="text-base font-medium">Active Sessions</h3>
                <div class="text-2xl font-semibold">0</div>
                <p class="text-sm text-muted-foreground">Currently active user sessions</p>
            </div>
        </div>
    </div>
</div>
