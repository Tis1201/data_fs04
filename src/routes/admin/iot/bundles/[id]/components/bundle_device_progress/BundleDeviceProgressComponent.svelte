<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { AdminCard } from "$lib/components/admin";
    import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-svelte";
    import { onDestroy } from 'svelte';
    import { goto } from '$app/navigation';

    // Props
    export let bundleId: string;
    export let selectedWave: any = null;
    export let reloadToken: number = 0;
    export let loading = false;

    type DeviceProgress = {
        id: string;
        deviceId: string;
        deviceName: string;
        status: string;
        progress: number;
        startedAt: string | null;
        completedAt: string | null;
        errorDetails: string | null;
        retryCount: number;
    };

    let devices: DeviceProgress[] = [];
    let loadingDevices = false;
    let abortController: AbortController | null = null;

    async function loadDevicesForWave() {
        if (!bundleId || !selectedWave?.id) {
            devices = [];
            return;
        }
        loadingDevices = true;
        try {
            if (abortController) abortController.abort();
            abortController = new AbortController();
            const res = await fetch(`/api/admin/iot/bundles/${bundleId}/waves/${selectedWave.id}/progress`, { signal: abortController.signal });
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load device progress');
            devices = (json.data || []) as DeviceProgress[];
        } catch (e) {
            devices = [];
            // optionally log error
        } finally {
            loadingDevices = false;
        }
    }

    $: selectedWave && loadDevicesForWave();
    $: reloadToken, selectedWave && loadDevicesForWave();
    onDestroy(() => { if (abortController) abortController.abort(); });

    // Format date for display
    function formatDate(date: string | null | undefined) {
        return date ? new Date(date).toLocaleString() : '-';
    }

    // Get status badge variant
    function getStatusVariant(status: string) {
        const statusBadgeVariant = {
            "COMPLETED": "success",
            "IN_PROGRESS": "default",
            "PENDING": "secondary",
            "FAILED": "destructive",
            "ROLLED_BACK": "warning"
        };
        return (statusBadgeVariant as any)[status] || 'outline';
    }

    // Get status display text
    function getStatusDisplayText(status: string) {
        const statusDisplayText = {
            "COMPLETED": "Completed",
            "IN_PROGRESS": "In Progress",
            "PENDING": "Pending",
            "FAILED": "Failed",
            "ROLLED_BACK": "Rolled Back"
        };
        return (statusDisplayText as any)[status] || status;
    }

    // Get status icon
    function getStatusIcon(status: string) {
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
    // Overall progress = percent of devices that have been processed (completed + failed)
    $: overallProgress = devices.length > 0
        ? Math.round(((metrics.completed + metrics.failed) / devices.length) * 100)
        : 0;
        
    // Navigate to device detail page
    function navigateToDevice(device: DeviceProgress) {
        goto(`/admin/iot/devices/${device.deviceId}`);
    }
</script>

<AdminCard>
    <svelte:fragment slot="header">
        <div>
            <h3 class="text-lg font-medium">Device Progress</h3>
            <p class="text-sm text-muted-foreground">
        {#if selectedWave}
                Showing progress for devices in wave: {selectedWave.name}
        {:else}
                Select a wave to view device progress
        {/if}
            </p>
        </div>
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
                            <!-- Per-device progress is optional; hide for now to avoid confusion -->
                            <TableHead>Issues</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each devices as device}
                            <TableRow class="hover:bg-muted/50">
                                <TableCell class="font-medium">
                                    <button 
                                        class="text-left hover:underline hover:text-primary transition-colors"
                                        on:click={() => navigateToDevice(device)}
                                    >
                                        {device.deviceName}
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(device.status)}>
                                        <svelte:component this={getStatusIcon(device.status)} class="mr-1 h-3 w-3" />
                                        {getStatusDisplayText(device.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDate(device.startedAt)}</TableCell>
                                <TableCell>{formatDate(device.completedAt)}</TableCell>
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