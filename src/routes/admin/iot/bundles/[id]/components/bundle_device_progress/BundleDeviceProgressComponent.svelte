<script>
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { AdminCard } from "$lib/components/admin";
    import { AlertCircle, CheckCircle2, Clock, XCircle, X } from "lucide-svelte";
    import * as Sheet from "$lib/components/ui/sheet";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";

    // Props
    export let selectedWave = null;
    export let loading = false;

    // Hardcoded device progress for wave1
    const wave1Devices = [
        {
            deviceName: "Factory Floor Sensor 1",
            status: "COMPLETED",
            progress: 100,
            startedAt: new Date(2025, 5, 1, 10, 5).toISOString(),
            completedAt: new Date(2025, 5, 1, 10, 15).toISOString(),
            errorDetails: null,
            retryCount: 0
        },
        {
            deviceName: "Factory Floor Sensor 2",
            status: "COMPLETED",
            progress: 100,
            startedAt: new Date(2025, 5, 1, 10, 10).toISOString(),
            completedAt: new Date(2025, 5, 1, 10, 18).toISOString(),
            errorDetails: null,
            retryCount: 0
        }
    ];

    // Hardcoded device progress for wave2
    const wave2Devices = [
        {
            deviceName: "Factory Floor Sensor 3",
            status: "IN_PROGRESS",
            progress: 65,
            startedAt: new Date(2025, 5, 1, 10, 15).toISOString(),
            completedAt: null,
            errorDetails: null,
            retryCount: 0
        }
    ];

    // Hardcoded device progress for wave3
    const wave3Devices = [
        {
            deviceName: "Factory Floor Sensor 4",
            status: "PENDING",
            progress: 0,
            startedAt: null,
            completedAt: null,
            errorDetails: null,
            retryCount: 0
        }
    ];

    // Hardcoded device progress for wave4
    const wave4Devices = [
        {
            deviceName: "Factory Floor Sensor 5",
            status: "FAILED",
            progress: 45,
            startedAt: new Date(2025, 5, 1, 10, 20).toISOString(),
            completedAt: new Date(2025, 5, 1, 10, 22).toISOString(),
            errorDetails: "Connection timeout during package download",
            retryCount: 2
        }
    ];

    // Hardcoded device progress for wave5
    const wave5Devices = [
        {
            deviceName: "Factory Floor Sensor 6",
            status: "ROLLED_BACK",
            progress: 80,
            startedAt: new Date(2025, 5, 1, 10, 25).toISOString(),
            completedAt: new Date(2025, 5, 1, 10, 55).toISOString(),
            errorDetails: "Installation exceeded time limit",
            retryCount: 1
        }
    ];

    // Map of wave IDs to their device lists
    const devicesByWave = {
        "wave1": wave1Devices,
        "wave2": wave2Devices,
        "wave3": wave3Devices,
        "wave4": wave4Devices,
        "wave5": wave5Devices
    };

    // Get devices for the selected wave
    $: devices = selectedWave ? devicesByWave[selectedWave.id] || [] : [];

    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : '-';
    }

    // Get status badge variant
    function getStatusVariant(status) {
        const statusBadgeVariant = {
            "COMPLETED": "success",
            "IN_PROGRESS": "default",
            "PENDING": "secondary",
            "FAILED": "destructive",
            "ROLLED_BACK": "warning"
        };
        return statusBadgeVariant[status] || 'outline';
    }

    // Get status display text
    function getStatusDisplayText(status) {
        const statusDisplayText = {
            "COMPLETED": "Completed",
            "IN_PROGRESS": "In Progress",
            "PENDING": "Pending",
            "FAILED": "Failed",
            "ROLLED_BACK": "Rolled Back"
        };
        return statusDisplayText[status] || status;
    }

    // Get status icon
    function getStatusIcon(status) {
        switch (status) {
            case 'COMPLETED':
                return CheckCircle2;
            case 'IN_PROGRESS':
            case 'PENDING':
                return Clock;
            case 'FAILED':
                return XCircle;
            case 'ROLLED_BACK':
                return AlertCircle;
            default:
                return Clock;
        }
    }

    // Calculate metrics
    $: metrics = {
        total: devices.length,
        completed: devices.filter(d => d.status === 'COMPLETED').length,
        inProgress: devices.filter(d => d.status === 'IN_PROGRESS').length,
        pending: devices.filter(d => d.status === 'PENDING').length,
        failed: devices.filter(d => d.status === 'FAILED').length,
        rolledBack: devices.filter(d => d.status === 'ROLLED_BACK').length
    };

    // Calculate overall progress
    $: overallProgress = devices.length > 0 
        ? Math.round(devices.reduce((sum, device) => sum + device.progress, 0) / devices.length)
        : 0;
        
    // Selected device for detail view
    let selectedDevice = null;
    let sheetOpen = false;
    
    // Open device detail sheet
    function openDeviceDetails(device) {
        selectedDevice = device;
        sheetOpen = true;
    }
    
    // Close device detail sheet
    function closeDeviceDetails() {
        sheetOpen = false;
    }
</script>

<AdminCard>
    <svelte:fragment slot="title">Device Progress</svelte:fragment>
    <svelte:fragment slot="description">
        {#if selectedWave}
            Showing progress for devices in wave: {selectedWave.name}
        {:else}
            Select a wave to view device progress
        {/if}
    </svelte:fragment>

    {#if loading}
        <div class="space-y-4">
            <div class="flex justify-between">
                <Skeleton class="h-8 w-1/4" />
                <Skeleton class="h-8 w-1/4" />
            </div>
            <Skeleton class="h-4 w-full" />
            <div class="space-y-2">
                {#each Array(3) as _}
                    <Skeleton class="h-12 w-full" />
                {/each}
            </div>
        </div>
    {:else if !selectedWave}
        <div class="py-8 text-center text-muted-foreground">
            <p>Select a wave to view device progress</p>
        </div>
    {:else if devices.length === 0}
        <div class="py-8 text-center text-muted-foreground">
            <p>No device progress data available for this wave</p>
        </div>
    {:else}
        <div class="space-y-6">
            <!-- Summary metrics -->
            <div class="grid grid-cols-3 gap-4 md:grid-cols-6">
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Total</p>
                        <p class="text-2xl font-bold">{metrics.total}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Completed</p>
                        <p class="text-2xl font-bold text-green-600">{metrics.completed}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">In Progress</p>
                        <p class="text-2xl font-bold text-blue-600">{metrics.inProgress}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Pending</p>
                        <p class="text-2xl font-bold text-gray-600">{metrics.pending}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Failed</p>
                        <p class="text-2xl font-bold text-red-600">{metrics.failed}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Timeout</p>
                        <p class="text-2xl font-bold text-yellow-600">{metrics.rolledBack}</p>
                    </CardContent>
                </Card>
            </div>

            <!-- Overall progress -->
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="font-medium">Overall Progress</span>
                    <span>{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} />
            </div>

            <!-- Device progress table -->
            <div class="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Device</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Issues</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each devices as device}
                            <TableRow class="cursor-pointer hover:bg-muted/50" on:click={() => openDeviceDetails(device)}>
                                <TableCell class="font-medium">{device.deviceName}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(device.status)}>
                                        <svelte:component this={getStatusIcon(device.status)} class="mr-1 h-3 w-3" />
                                        {getStatusDisplayText(device.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDate(device.startedAt)}</TableCell>
                                <TableCell>{formatDate(device.completedAt)}</TableCell>
                                <TableCell>
                                    <div class="w-[100px]">
                                        <Progress value={device.progress} />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {#if device.errorDetails}
                                        <span class="text-red-600 text-sm">{device.errorDetails}</span>
                                    {:else if device.retryCount > 0}
                                        <span class="text-yellow-600 text-sm">Retries: {device.retryCount}</span>
                                    {:else}
                                        <span class="text-muted-foreground">-</span>
                                    {/if}
                                </TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
            </div>
        </div>
    {/if}
</AdminCard>

<!-- Device Detail Sheet -->
<Sheet.Root bind:open={sheetOpen} onOpenChange={closeDeviceDetails}>
    <Sheet.Content side="right" class="w-full sm:w-[540px]">
        <Sheet.Header class="px-6 py-4 border-b">
            <div class="flex items-center justify-between">
                <Sheet.Title class="text-xl font-semibold">
                    Device Details
                </Sheet.Title>
                <Sheet.Close asChild>
                    <Button variant="ghost" size="icon" class="rounded-full">
                        <X class="h-4 w-4" />
                    </Button>
                </Sheet.Close>
            </div>
        </Sheet.Header>
        
        {#if selectedDevice}
            <div class="px-6 py-4 space-y-6">
                <!-- Device Info Section -->
                <div>
                    <h3 class="text-lg font-medium mb-2">Device Information</h3>
                    <div class="grid grid-cols-1 gap-4">
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Name</span>
                            <span class="font-medium">{selectedDevice.deviceName}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Status</span>
                            <Badge variant={getStatusVariant(selectedDevice.status)} class="w-fit mt-1">
                                <svelte:component this={getStatusIcon(selectedDevice.status)} class="mr-1 h-3 w-3" />
                                {getStatusDisplayText(selectedDevice.status)}
                            </Badge>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- Progress Section -->
                <div>
                    <h3 class="text-lg font-medium mb-2">Deployment Progress</h3>
                    <div class="space-y-4">
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Progress</span>
                            <div class="w-full mt-1 space-y-1">
                                <Progress value={selectedDevice.progress} />
                                <div class="text-xs text-right">{selectedDevice.progress}%</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col">
                                <span class="text-sm text-muted-foreground">Started At</span>
                                <span>{formatDate(selectedDevice.startedAt)}</span>
                            </div>
                            
                            <div class="flex flex-col">
                                <span class="text-sm text-muted-foreground">Completed At</span>
                                <span>{formatDate(selectedDevice.completedAt)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- Issues Section -->
                <div>
                    <h3 class="text-lg font-medium mb-2">Issues & Retries</h3>
                    <div class="space-y-4">
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Retry Count</span>
                            <span>{selectedDevice.retryCount || 0}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Error Details</span>
                            {#if selectedDevice.errorDetails}
                                <div class="p-3 bg-red-50 border border-red-200 rounded-md mt-1">
                                    <span class="text-red-600">{selectedDevice.errorDetails}</span>
                                </div>
                            {:else}
                                <span class="text-muted-foreground">No errors reported</span>
                            {/if}
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- Technical Details Section -->
                <div>
                    <h3 class="text-lg font-medium mb-2">Technical Details</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Bundle ID</span>
                            <span class="font-mono text-xs">{selectedWave?.bundleId || 'N/A'}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Wave ID</span>
                            <span class="font-mono text-xs">{selectedWave?.id || 'N/A'}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-sm text-muted-foreground">Transaction ID</span>
                            <span class="font-mono text-xs">txn_{Math.random().toString(36).substring(2, 10)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex justify-end space-x-3 pt-4">
                    {#if selectedDevice.status === 'FAILED'}
                        <Button variant="outline">Retry Deployment</Button>
                    {/if}
                    
                    {#if ['IN_PROGRESS', 'PENDING'].includes(selectedDevice.status)}
                        <Button variant="outline" class="text-yellow-600 border-yellow-600 hover:bg-yellow-50">Cancel</Button>
                    {/if}
                    
                    <Button variant="default">View Logs</Button>
                </div>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>