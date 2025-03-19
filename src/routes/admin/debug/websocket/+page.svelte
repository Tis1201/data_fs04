<!-- Debug page for WebSocket testing -->
<script lang="ts">
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import WebSocketTest from './websocket-test.svelte';

    function formatTimestamp(timestamp: string | number | Date) {
        return new Date(timestamp).toLocaleTimeString();
    }
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <a href="/admin/debug" class="text-sm font-medium underline-offset-4 hover:underline">Debug</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>WebSocket</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">WebSocket Debug</h2>
            <p class="text-muted-foreground">Test and monitor WebSocket connections</p>
        </div>
    </div>

    <WebSocketTest />
</div>
