<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { RefreshCw, Cpu, HardDrive, Server, Clock, Activity, AlertTriangle, Database } from "lucide-svelte";
    import type { PageData } from "./$types";
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Separator } from "$lib/components/ui/separator";
    
    export let data: PageData;
    
    // Extract system data
    $: ({ system, sessions } = data);
    
    // Format date for display
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
</script>

<AdminPageLayout
    title="System Monitor"
    crumbs={[
        ["Admin", "/admin"],
        "System Monitor"
    ]}
    actionButtons={[
        {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => window.location.reload()
        }
    ]}
>
    <!-- System Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- CPU Usage -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">CPU Usage</CardTitle>
                <svelte:component this={Cpu} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.cpu.usage}%</div>
                <Progress value={system.cpu.usage} class="h-2" />
                <p class="text-xs text-muted-foreground mt-2">{system.cpu.model}</p>
                <p class="text-xs text-muted-foreground">{system.cpu.count} cores</p>
            </CardContent>
        </Card>
        
        <!-- Memory Usage -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Memory Usage</CardTitle>
                <svelte:component this={Database} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.memory.usagePercentage}%</div>
                <Progress value={system.memory.usagePercentage} class="h-2" />
                <p class="text-xs text-muted-foreground mt-2">
                    {system.memory.used} GB used of {system.memory.total} GB
                </p>
            </CardContent>
        </Card>
        
        <!-- System Uptime -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">System Uptime</CardTitle>
                <svelte:component this={Clock} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.uptime.formatted}</div>
                <p class="text-xs text-muted-foreground mt-2">
                    {system.os.type} {system.os.release} ({system.os.platform}/{system.os.arch})
                </p>
                <p class="text-xs text-muted-foreground">{system.hostname}</p>
            </CardContent>
        </Card>
        
        <!-- Active Sessions -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Active Sessions</CardTitle>
                <svelte:component this={Activity} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{sessions.active}</div>
                <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                        <span class="font-medium">Total:</span> {sessions.total}
                    </div>
                    <div>
                        <span class="font-medium">Failed:</span> {sessions.failedLogins}
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
    
    <!-- Top Processes -->
    <Card class="w-full">
        <CardHeader>
            <CardTitle>Top Processes</CardTitle>
            <CardDescription>Processes using most resources</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left py-2 px-2">PID</th>
                            <th class="text-left py-2 px-2">Process</th>
                            <th class="text-right py-2 px-2">CPU %</th>
                            <th class="text-right py-2 px-2">Memory %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if system.topProcesses && Array.isArray(system.topProcesses)}
                            {#each system.topProcesses as process}
                                <tr class="border-b border-muted hover:bg-muted/50">
                                    <td class="py-2 px-2">{process.pid}</td>
                                    <td class="py-2 px-2 font-mono text-xs">{process.command}</td>
                                    <td class="py-2 px-2 text-right">{process.cpu.toFixed(1)}%</td>
                                    <td class="py-2 px-2 text-right">{process.memory.toFixed(1)}%</td>
                                </tr>
                            {/each}
                        {:else}
                            <tr>
                                <td colspan="4" class="py-4 text-center text-muted-foreground">No process data available</td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>

    <!-- System Details -->
    <Card class="w-full">
        <CardHeader>
            <CardTitle>System Details</CardTitle>
            <CardDescription>Detailed system information</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="space-y-6">
                <!-- Process Memory -->
                <div>
                    <h3 class="text-sm font-medium mb-2">Process Memory</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">RSS</div>
                            <div class="text-sm font-medium">{system.process.rss} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">Heap Total</div>
                            <div class="text-sm font-medium">{system.process.heapTotal} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">Heap Used</div>
                            <div class="text-sm font-medium">{system.process.heapUsed} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">External</div>
                            <div class="text-sm font-medium">{system.process.external} GB</div>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- CPU Load Averages -->
                <div>
                    <h3 class="text-sm font-medium mb-2">CPU Load Averages</h3>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">1 Minute</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[0]}</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">5 Minutes</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[1]}</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">15 Minutes</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[2]}</div>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- Network Interfaces -->
                <div>
                    <h3 class="text-sm font-medium mb-2">Network Interfaces</h3>
                    <div class="space-y-3">
                        {#each system.network as networkInterface}
                            <div class="bg-muted p-3 rounded-md">
                                <div class="text-sm font-medium">{networkInterface.name}</div>
                                {#each networkInterface.addresses as address}
                                    <div class="text-xs text-muted-foreground">
                                        {address.family === 'IPv4' ? 'IPv4' : 'IPv6'}: {address.address}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</AdminPageLayout>
