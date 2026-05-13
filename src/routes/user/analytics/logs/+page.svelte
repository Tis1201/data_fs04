<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Download, Filter } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    
    // Define page metadata
    const pageTitle = "System Logs";
    const pageDescription = "View and analyze system activity logs";
    
    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Analytics", "/user/analytics"],
        ["Logs", ""]
    ] as [string, string][];
    
    // Mock data for the placeholder
    const logs = [
        { id: 1, timestamp: "2025-05-19 13:30:22", level: "info", source: "Device/SN-1234", message: "Temperature reading: 22.5°C", details: "Normal operation" },
        { id: 2, timestamp: "2025-05-19 13:15:10", level: "warning", source: "Device/SN-5678", message: "Battery level low (15%)", details: "Device may require charging soon" },
        { id: 3, timestamp: "2025-05-19 12:45:33", level: "error", source: "System", message: "Connection timeout", details: "Failed to connect to device SN-9012 after 3 retries" },
        { id: 4, timestamp: "2025-05-19 12:30:05", level: "info", source: "User", message: "User login successful", details: "IP: 192.168.1.105" },
        { id: 5, timestamp: "2025-05-19 12:00:18", level: "info", source: "Device/SN-1234", message: "Device status update", details: "Online, firmware v2.3.1" },
    ];
    
    // Get log level class
    function getLevelClass(level) {
        switch(level) {
            case 'error': return 'text-red-500';
            case 'warning': return 'text-amber-500';
            case 'info': return 'text-blue-500';
            default: return 'text-slate-500';
        }
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Export Logs",
            icon: Download,
            onClick: () => alert('Export functionality would go here')
        },
        {
            label: "Filter",
            icon: Filter,
            variant: "outline",
            onClick: () => alert('Filter functionality would go here')
        }
    ]}
>
    <div class="flex flex-col space-y-4">        
        <!-- Logs table -->
        <div class="rounded-md border overflow-hidden">
            {#if logs.length > 0}
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-muted/50">
                                <th class="text-left p-2 font-medium">Time</th>
                                <th class="text-left p-2 font-medium">Level</th>
                                <th class="text-left p-2 font-medium">Source</th>
                                <th class="text-left p-2 font-medium">Message</th>
                                <th class="text-left p-2 font-medium">Details</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            {#each logs as log}
                                <tr class="hover:bg-muted/50">
                                    <td class="p-2 whitespace-nowrap">{log.timestamp}</td>
                                    <td class="p-2 whitespace-nowrap">
                                        <span class={getLevelClass(log.level)}>
                                            {log.level.toUpperCase()}
                                        </span>
                                    </td>
                                    <td class="p-2 whitespace-nowrap">{log.source}</td>
                                    <td class="p-2">{log.message}</td>
                                    <td class="p-2 text-muted-foreground">{log.details}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else}
                <div class="text-center p-8 text-muted-foreground">
                    <p>No logs found</p>
                    <p class="text-sm mt-1">System logs will appear here when available</p>
                </div>
            {/if}
        </div>
        
        <!-- Pagination placeholder -->
        <div class="flex justify-between items-center">
            <div class="text-sm text-muted-foreground">
                Showing 1-5 of 120 entries
            </div>
            <div class="flex space-x-2">
                <button class="px-3 py-1 rounded border hover:bg-muted/50 text-sm" disabled>Previous</button>
                <button class="px-3 py-1 rounded border hover:bg-muted/50 text-sm">Next</button>
            </div>
        </div>
        
        <!-- Help text -->
        <p class="text-sm text-muted-foreground">
            Need help understanding these logs? <a href="/user/help/analytics" class="text-primary hover:underline">View documentation</a>
        </p>
    </div>
</UserPageLayout>
