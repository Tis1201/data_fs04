<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { RefreshCw, Trash2 } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    let stats: any = null;
    let loading = false;
    let cleanupLoading = false;

    async function loadStats() {
        loading = true;
        try {
            const response = await fetch('/api/admin/debug/connections');
            if (response.ok) {
                stats = await response.json();
            } else {
                toast.error('Failed to load connection stats');
            }
        } catch (error) {
            toast.error('Error loading connection stats');
            console.error(error);
        } finally {
            loading = false;
        }
    }

    async function cleanupConnections() {
        cleanupLoading = true;
        try {
            const response = await fetch('/api/admin/debug/connections/cleanup', {
                method: 'POST'
            });
            if (response.ok) {
                const result = await response.json();
                toast.success(result.message);
                await loadStats(); // Refresh stats after cleanup
            } else {
                toast.error('Failed to cleanup connections');
            }
        } catch (error) {
            toast.error('Error cleaning up connections');
            console.error(error);
        } finally {
            cleanupLoading = false;
        }
    }

    onMount(() => {
        loadStats();
    });
</script>

<div class="container mx-auto p-6 space-y-6">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">SSE Connection Monitor</h1>
        <div class="space-x-2">
            <Button 
                variant="outline" 
                on:click={loadStats} 
                disabled={loading}
            >
                <RefreshCw class="w-4 h-4 mr-2" class:animate-spin={loading} />
                Refresh
            </Button>
            <Button 
                variant="destructive" 
                on:click={cleanupConnections} 
                disabled={cleanupLoading}
            >
                <Trash2 class="w-4 h-4 mr-2" class:animate-spin={cleanupLoading} />
                Cleanup Stale
            </Button>
        </div>
    </div>

    {#if stats}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Connection Stats -->
            <Card>
                <CardHeader>
                    <CardTitle>Connections</CardTitle>
                    <CardDescription>Active SSE connections</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex justify-between items-center">
                        <span>Total Connections:</span>
                        <Badge variant="outline">{stats.connections.total}</Badge>
                    </div>
                    
                    {#if stats.connections.usersWithManyConnections.length > 0}
                        <div>
                            <h4 class="font-medium text-red-600 mb-2">Users with Many Connections:</h4>
                            <div class="space-y-1">
                                {#each stats.connections.usersWithManyConnections as [userId, count]}
                                    <div class="flex justify-between text-sm">
                                        <span class="font-mono">{userId}</span>
                                        <Badge variant="destructive">{count}</Badge>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- Subscription Stats -->
            <Card>
                <CardHeader>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Active channel subscriptions</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex justify-between items-center">
                        <span>Total Subscriptions:</span>
                        <Badge variant="outline">{stats.subscriptions.total}</Badge>
                    </div>
                    
                    {#if stats.subscriptions.highSubscriptionChannels.length > 0}
                        <div>
                            <h4 class="font-medium text-red-600 mb-2">High Subscription Channels:</h4>
                            <div class="space-y-1">
                                {#each stats.subscriptions.highSubscriptionChannels as [channel, count]}
                                    <div class="flex justify-between text-sm">
                                        <span class="font-mono truncate">{channel}</span>
                                        <Badge variant="destructive">{count}</Badge>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </CardContent>
            </Card>
        </div>

        <!-- Detailed Lists -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- All Connections -->
            <Card>
                <CardHeader>
                    <CardTitle>All Connections</CardTitle>
                    <CardDescription>Detailed connection list</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="space-y-2 max-h-96 overflow-y-auto">
                        {#each stats.connections.allConnections as conn}
                            <div class="flex justify-between items-center p-2 border rounded text-sm">
                                <div>
                                    <div class="font-mono">{conn.id}</div>
                                    <div class="text-muted-foreground">User: {conn.userId}</div>
                                </div>
                                <Badge variant="secondary">{conn.protocol}</Badge>
                            </div>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <!-- All Subscriptions -->
            <Card>
                <CardHeader>
                    <CardTitle>All Subscriptions</CardTitle>
                    <CardDescription>Detailed subscription list</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="space-y-2 max-h-96 overflow-y-auto">
                        {#each stats.subscriptions.allSubscriptions as sub}
                            <div class="flex justify-between items-center p-2 border rounded text-sm">
                                <div>
                                    <div class="font-mono">{sub.key}</div>
                                    <div class="text-muted-foreground">{sub.scope}</div>
                                </div>
                                <Badge variant="secondary">{sub.id}</Badge>
                            </div>
                        {/each}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div class="text-sm text-muted-foreground">
            Last updated: {new Date(stats.timestamp).toLocaleString()}
        </div>
    {:else if loading}
        <div class="flex justify-center items-center h-32">
            <RefreshCw class="w-8 h-8 animate-spin" />
        </div>
    {:else}
        <div class="text-center text-muted-foreground">
            No connection data available
        </div>
    {/if}
</div>
