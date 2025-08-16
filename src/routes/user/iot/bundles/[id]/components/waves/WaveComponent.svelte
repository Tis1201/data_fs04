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
    // Keep prop for API consistency (no local use)
    export let bundleId: string;
    export let loading = false;
    export let empty = false;
    export let selectedWaveId: string | null = null;
    export let waves: Array<{
        id: string;
        name: string;
        status: string;
        startTime?: string | null;
        endTime?: string | null;
        progress?: number | null;
        devicesTotal?: number | null;
        devicesCompleted?: number | null;
        devicesFailed?: number | null;
    }> = [];
    
    // Event dispatcher
    const dispatch = createEventDispatcher();
    
    // Derive waves list to display
    $: displayWaves = Array.isArray(waves) && waves.length > 0 ? waves : [];
    
    // Format date for display
    function formatDate(date: string | null | undefined) {
        return date ? new Date(date).toLocaleString() : '-';
    }
    
    // Get status badge variant
    function getStatusVariant(status: string): 'success' | 'default' | 'secondary' | 'destructive' | 'outline' {
        const variantMap: Record<string, 'success' | 'default' | 'secondary' | 'destructive' | 'outline'> = {
            'COMPLETED': 'success',
            'IN_PROGRESS': 'default',
            'PENDING': 'secondary',
            'FAILED': 'destructive',
            'ROLLED_BACK': 'secondary'
        };
        return variantMap[status] || 'outline';
    }
    
    // Get status display text
    function getStatusDisplay(status: string) {
        const statusMap: Record<string, string> = {
            'COMPLETED': 'Completed',
            'IN_PROGRESS': 'In Progress',
            'PENDING': 'Pending',
            'FAILED': 'Failed',
            'ROLLED_BACK': 'Rolled Back'
        };
        return statusMap[status] || status;
    }
    
    // Action handler: select wave and emit event
    function viewWaveDetails(waveId: string) {
        selectWave(waveId);
    }
    
    function startWave(waveId: string) {
        console.log(`Start wave ${waveId}`);
    }
    
    function pauseWave(waveId: string) {
        console.log(`Pause wave ${waveId}`);
    }
    
    // Select a wave and emit the event
    function selectWave(waveId: string) {
        selectedWaveId = waveId;
        const selectedWave = displayWaves.find((wave) => wave.id === waveId);
        dispatch('selectWave', { wave: selectedWave });
    }
</script>

<AdminCard>
    <svelte:fragment slot="header">
        <div>
            <h3 class="text-lg font-medium">Deployment Waves</h3>
            <p class="text-sm text-muted-foreground">Manage deployment waves for this bundle</p>
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
                        <p class="text-2xl font-bold">{displayWaves.length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Completed</p>
                        <p class="text-2xl font-bold text-green-600">{displayWaves.filter(w => w.status === 'COMPLETED').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">In Progress</p>
                        <p class="text-2xl font-bold text-blue-600">{displayWaves.filter(w => w.status === 'IN_PROGRESS').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Failed</p>
                        <p class="text-2xl font-bold text-red-600">{displayWaves.filter(w => w.status === 'FAILED').length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent class="p-4 text-center">
                        <p class="text-xs font-medium uppercase text-muted-foreground">Rolled Back</p>
                        <p class="text-2xl font-bold text-yellow-600">{displayWaves.filter(w => w.status === 'ROLLED_BACK').length}</p>
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
                        {#each displayWaves as wave (wave.id)}
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
                                        {(wave.devicesCompleted ?? 0)}/{(wave.devicesTotal ?? 0)}
                                        {#if (wave.devicesFailed ?? 0) > 0}
                                            <span class="text-destructive ml-1">
                                                ({wave.devicesFailed ?? 0} failed)
                                            </span>
                                        {/if}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div class="w-[100px] space-y-1">
                                        <Progress value={wave.progress ?? 0} />
                                        <div class="text-xs text-muted-foreground text-right">{wave.progress ?? 0}%</div>
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
                                            on:click={() => viewWaveDetails(wave.id)}
                                        >
                                            View
                                        </button>
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
