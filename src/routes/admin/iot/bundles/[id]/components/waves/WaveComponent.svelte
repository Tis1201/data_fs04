<script lang="ts">
    import { Calendar, Users } from 'lucide-svelte';
    import { AlertCircle, Pause, Play } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { AdminCard } from "$lib/components/admin";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { createEventDispatcher } from "svelte";
    
    // Props
    export let bundleId: string;
    export let loading = false;
    export let empty = false;
    export let selectedWaveId = null;
    
    // Event dispatcher
    const dispatch = createEventDispatcher();
    
    // Simplified mock data for waves
    const mockWaves = [
        {
            id: "wave1",
            name: "Wave 1",
            status: "COMPLETED",
            startTime: new Date(2025, 5, 1, 10, 0).toISOString(),
            endTime: new Date(2025, 5, 1, 14, 30).toISOString(),
            progress: 100,
            devicesTotal: 2,
            devicesCompleted: 2,
            devicesFailed: 0
        },
        {
            id: "wave2",
            name: "Wave 2",
            status: "IN_PROGRESS",
            startTime: new Date(2025, 5, 2, 10, 0).toISOString(),
            endTime: null,
            progress: 65,
            devicesTotal: 1,
            devicesCompleted: 0,
            devicesFailed: 0
        },
        {
            id: "wave3",
            name: "Wave 3",
            status: "PENDING",
            startTime: null,
            endTime: null,
            progress: 0,
            devicesTotal: 1,
            devicesCompleted: 0,
            devicesFailed: 0
        },
        {
            id: "wave4",
            name: "Wave 4",
            status: "FAILED",
            startTime: new Date(2025, 5, 3, 10, 0).toISOString(),
            endTime: new Date(2025, 5, 3, 10, 15).toISOString(),
            progress: 45,
            devicesTotal: 1,
            devicesCompleted: 0,
            devicesFailed: 1
        },
        {
            id: "wave5",
            name: "Wave 5",
            status: "ROLLED_BACK",
            startTime: new Date(2025, 5, 2, 14, 0).toISOString(),
            endTime: new Date(2025, 5, 2, 18, 0).toISOString(),
            progress: 80,
            devicesTotal: 1,
            devicesCompleted: 0,
            devicesFailed: 1
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
            'ROLLED_BACK': 'warning'
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
            'ROLLED_BACK': 'Rolled Back'
        };
        return statusMap[status] || status;
    }
    
    // Mock action handlers
    function viewWaveDetails(waveId) {
        console.log(`View wave details ${waveId}`);
    }
    
    function startWave(waveId) {
        console.log(`Start wave ${waveId}`);
    }
    
    function pauseWave(waveId) {
        console.log(`Pause wave ${waveId}`);
    }
    
    // Select a wave and emit the event
    function selectWave(waveId) {
        selectedWaveId = waveId;
        const selectedWave = mockWaves.find(wave => wave.id === waveId);
        dispatch('selectWave', { wave: selectedWave });
    }
</script>

<AdminCard>
    <svelte:fragment slot="title">Deployment Waves</svelte:fragment>
    <svelte:fragment slot="description">Manage deployment waves for this bundle</svelte:fragment>
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
    {:else if empty}
        <div class="py-8 text-center">
            <div>
                <h3 class="mt-4 text-lg font-medium">No waves created</h3>
                <p class="mt-2 text-sm text-muted-foreground">
                    Waves will be created when this bundle is published
                </p>
            </div>
        </div>
    {:else}
        <div class="space-y-6">
            <!-- Summary metrics -->
            <div class="grid grid-cols-3 gap-4 md:grid-cols-5">
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Total</p>
                        <p class="text-2xl font-bold">{mockWaves.length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Completed</p>
                        <p class="text-2xl font-bold text-green-600">{mockWaves.filter(w => w.status === 'COMPLETED').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">In Progress</p>
                        <p class="text-2xl font-bold text-blue-600">{mockWaves.filter(w => w.status === 'IN_PROGRESS').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Failed</p>
                        <p class="text-2xl font-bold text-red-600">{mockWaves.filter(w => w.status === 'FAILED').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Rolled Back</p>
                        <p class="text-2xl font-bold text-yellow-600">{mockWaves.filter(w => w.status === 'ROLLED_BACK').length}</p>
                    </CardContent>
                </Card>
            </div>
            
            <!-- Waves table -->
            <div class="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Wave Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Devices</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead class="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each mockWaves as wave (wave.id)}
                            <TableRow 
                                class="cursor-pointer {selectedWaveId === wave.id ? 'bg-muted/70' : ''}"
                                on:click={() => selectWave(wave.id)}
                            >
                                <TableCell>
                                    <div class="font-medium">{wave.name}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(wave.status)}>
                                        {getStatusDisplay(wave.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div>
                                        {wave.devicesCompleted}/{wave.devicesTotal}
                                        {#if wave.devicesFailed > 0}
                                            <span class="text-destructive ml-1">
                                                ({wave.devicesFailed} failed)
                                            </span>
                                        {/if}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div class="w-[100px] space-y-1">
                                        <Progress value={wave.progress} />
                                        <div class="text-xs text-muted-foreground text-right">{wave.progress}%</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {formatDate(wave.startTime)}
                                </TableCell>
                                <TableCell>
                                    {formatDate(wave.endTime)}
                                </TableCell>
                                <TableCell class="text-right">
                                    <div class="flex justify-end space-x-2">
                                        <button 
                                            class="text-sm text-blue-600 hover:underline" 
                                            on:click|stopPropagation={() => viewWaveDetails(wave.id)}
                                        >
                                            View
                                        </button>
                                        
                                        {#if wave.status === 'PENDING'}
                                            <button 
                                                class="text-sm text-green-600 hover:underline" 
                                                on:click|stopPropagation={() => startWave(wave.id)}
                                            >
                                                Start
                                            </button>
                                        {/if}
                                        
                                        {#if wave.status === 'IN_PROGRESS'}
                                            <button 
                                                class="text-sm text-yellow-600 hover:underline" 
                                                on:click|stopPropagation={() => pauseWave(wave.id)}
                                            >
                                                Pause
                                            </button>
                                        {/if}
                                    </div>
                                </TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
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
