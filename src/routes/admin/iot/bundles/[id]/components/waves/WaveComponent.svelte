<script lang="ts">
    import { Plus, Calendar, Users, ArrowUpDown, MoreHorizontal, Play, Pause, AlertCircle } from 'lucide-svelte';
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Separator } from "$lib/components/ui/separator";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import { AdminCard } from "$lib/components/admin";
    
    export let bundleId: string;
    export let loading: boolean = false;
    
    // Mock data for waves
    const mockWaves = [
        {
            id: "wave1",
            name: "Wave 1",
            status: "COMPLETED",
            maxDevices: 100,
            startTime: new Date(2025, 5, 1, 10, 0).toISOString(),
            endTime: new Date(2025, 5, 1, 14, 30).toISOString(),
            createdAt: new Date(2025, 5, 1, 8, 0).toISOString(),
            progress: 100,
            devicesTotal: 100,
            devicesCompleted: 100,
            devicesFailed: 0
        },
        {
            id: "wave2",
            name: "Wave 2",
            status: "IN_PROGRESS",
            maxDevices: 200,
            startTime: new Date(2025, 5, 2, 10, 0).toISOString(),
            endTime: null,
            createdAt: new Date(2025, 5, 1, 8, 5).toISOString(),
            progress: 65,
            devicesTotal: 200,
            devicesCompleted: 130,
            devicesFailed: 0
        },
        {
            id: "wave3",
            name: "Wave 3",
            status: "PENDING",
            maxDevices: 200,
            startTime: null,
            endTime: null,
            createdAt: new Date(2025, 5, 1, 8, 10).toISOString(),
            progress: 0,
            devicesTotal: 200,
            devicesCompleted: 0,
            devicesFailed: 0
        },
        {
            id: "wave4",
            name: "Wave 4",
            status: "FAILED",
            maxDevices: 100,
            startTime: new Date(2025, 5, 3, 10, 0).toISOString(),
            endTime: new Date(2025, 5, 3, 10, 15).toISOString(),
            createdAt: new Date(2025, 5, 1, 8, 15).toISOString(),
            progress: 15,
            devicesTotal: 100,
            devicesCompleted: 10,
            devicesFailed: 5
        },
        {
            id: "wave5",
            name: "Wave 5",
            status: "TIMEOUT",
            maxDevices: 150,
            startTime: new Date(2025, 5, 2, 14, 0).toISOString(),
            endTime: new Date(2025, 5, 2, 18, 0).toISOString(),
            createdAt: new Date(2025, 5, 1, 8, 20).toISOString(),
            progress: 75,
            devicesTotal: 150,
            devicesCompleted: 112,
            devicesFailed: 0
        }
    ];
    
    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : '-';
    }
    
    // Get status badge variant
    function getStatusVariant(status) {
        const variantMap = {
            'COMPLETED': 'success',
            'IN_PROGRESS': 'default',
            'PENDING': 'secondary',
            'FAILED': 'destructive',
            'TIMEOUT': 'warning'
        };
        return variantMap[status] || 'outline';
    }
    
    // Get status display text
    function getStatusDisplay(status) {
        const statusMap = {
            'COMPLETED': 'Completed',
            'IN_PROGRESS': 'In Progress',
            'PENDING': 'Pending',
            'FAILED': 'Failed',
            'TIMEOUT': 'Timeout'
        };
        return statusMap[status] || status;
    }
    
    // Mock actions - these would be connected to real API calls in a real implementation
    function viewWaveDetails(waveId) {
        console.log(`View details for wave ${waveId}`);
    }
    
    function startWave(waveId) {
        console.log(`Start wave ${waveId}`);
    }
    
    function pauseWave(waveId) {
        console.log(`Pause wave ${waveId}`);
    }
</script>

<AdminCard>
    <svelte:fragment slot="header">
        <div class="flex justify-between items-center">
            <div>
                <h3 class="text-lg font-medium">Deployment Waves</h3>
                <p class="text-sm text-muted-foreground">Waves are created when a bundle is published and cannot be modified afterward</p>
            </div>
            <!-- <Button variant="outline" size="sm" class="h-8" disabled>
                <Plus class="h-4 w-4 mr-2" />
                Add Wave
            </Button> -->
        </div>
    </svelte:fragment>
    
    {#if loading}
        <div class="space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-24 w-full" />
            <Skeleton class="h-24 w-full" />
        </div>
    {:else if mockWaves.length === 0}
        <div class="py-8 text-center">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Calendar class="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 class="mt-4 text-lg font-medium">No waves created</h3>
            <p class="mt-2 text-sm text-muted-foreground">
                Waves will be created when this bundle is published
            </p>
        </div>
    {:else}
        <div class="space-y-6">
            <!-- Summary metrics -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div class="bg-muted/30 p-3 rounded-md">
                    <div class="text-xs text-muted-foreground mb-1">Total</div>
                    <div class="text-xl font-medium">{mockWaves.length}</div>
                </div>
                
                <div class="bg-muted/30 p-3 rounded-md">
                    <div class="text-xs text-muted-foreground mb-1">Completed</div>
                    <div class="text-xl font-medium text-success">{mockWaves.filter(w => w.status === 'COMPLETED').length}</div>
                </div>
                
                <div class="bg-muted/30 p-3 rounded-md">
                    <div class="text-xs text-muted-foreground mb-1">In Progress</div>
                    <div class="text-xl font-medium">{mockWaves.filter(w => w.status === 'IN_PROGRESS').length}</div>
                </div>
                
                <div class="bg-muted/30 p-3 rounded-md">
                    <div class="text-xs text-muted-foreground mb-1">Timeout</div>
                    <div class="text-xl font-medium text-warning">{mockWaves.filter(w => w.status === 'TIMEOUT').length}</div>
                </div>
                
                <div class="bg-muted/30 p-3 rounded-md">
                    <div class="text-xs text-muted-foreground mb-1">Failed</div>
                    <div class="text-xl font-medium text-destructive">{mockWaves.filter(w => w.status === 'FAILED').length}</div>
                </div>
            </div>
            
            <!-- Waves table -->
            <div class="rounded-md border">
                <table class="w-full">
                    <thead>
                        <tr class="bg-muted/50">
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">Wave Name</th>
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">Devices</th>
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">Progress</th>
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">Start Time</th>
                            <th class="p-3 text-left text-sm font-medium text-muted-foreground">End Time</th>
                            <th class="p-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each mockWaves as wave (wave.id)}
                            <tr class="border-t hover:bg-muted/50">
                                <td class="p-3">
                                    <div class="text-sm font-medium">{wave.name}</div>
                                    <div class="text-xs text-muted-foreground">
                                        <RelativeDate date={wave.createdAt} />
                                    </div>
                                </td>
                                <td class="p-3">
                                    <Badge variant={getStatusVariant(wave.status)}>
                                        {getStatusDisplay(wave.status)}
                                    </Badge>
                                </td>
                                <td class="p-3">
                                    <div class="text-sm">
                                        {wave.devicesCompleted}/{wave.devicesTotal}
                                        {#if wave.devicesFailed > 0}
                                            <span class="text-destructive text-sm ml-1">
                                                ({wave.devicesFailed} failed)
                                            </span>
                                        {/if}
                                    </div>
                                </td>
                                <td class="p-3 w-40">
                                    <div class="space-y-1">
                                        <Progress value={wave.progress} />
                                        <div class="text-xs text-muted-foreground text-right">{wave.progress}%</div>
                                    </div>
                                </td>
                                <td class="p-3 text-sm">
                                    {formatDate(wave.startTime)}
                                </td>
                                <td class="p-3 text-sm">
                                    {formatDate(wave.endTime)}
                                </td>
                                <td class="p-3">
                                    <div class="flex justify-end">
                                        <RecordActions 
                                            actions={[
                                                {
                                                    label: 'View Details',
                                                    onClick: () => viewWaveDetails(wave.id)
                                                },
                                                ...(wave.status === 'PENDING' ? [{
                                                    label: 'Start Wave',
                                                    icon: Play,
                                                    onClick: () => startWave(wave.id)
                                                }] : []),
                                                ...(wave.status === 'IN_PROGRESS' ? [{
                                                    label: 'Pause Wave',
                                                    icon: Pause,
                                                    onClick: () => pauseWave(wave.id)
                                                }] : []),
                                                ...(wave.status === 'FAILED' ? [{
                                                    label: 'View Errors',
                                                    icon: AlertCircle,
                                                    variant: 'destructive',
                                                    onClick: () => viewWaveDetails(wave.id)
                                                }] : [])
                                            ]}
                                        />
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
    
    <svelte:fragment slot="footer">
        <div class="text-xs text-muted-foreground">
            <p>Waves are created automatically when a bundle is published and cannot be modified afterward.</p>
            <p>Each wave represents a batch of devices that will receive the bundle update.</p>
        </div>
    </svelte:fragment>
</AdminCard>
