<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Check, X, Clock, RotateCw, Key, RefreshCw, Ban, Activity } from "lucide-svelte";
    
    // Define props interface
    export let props = {
        metrics: {
            total: 0,
            success: 0,
            failure: 0,
            last24Hours: 0,
            lastWeek: 0,
            lastMonth: 0,
            tokenTypeDistribution: [] as { type: string; count: number }[],
            actionDistribution: [] as { type: string; count: number }[]
        }
    };
    
    // Calculate success rate percentage
    $: successRate = props.metrics.total > 0 
        ? Math.round((props.metrics.success / props.metrics.total) * 100) 
        : 0;
    
    // Helper function to get icon for token type
    function getTokenTypeIcon(type: string) {
        switch (type) {
            case 'access':
                return Activity;
            case 'refresh':
                return RefreshCw;
            case 'api_key':
                return Key;
            default:
                return Key;
        }
    }
    
    // Helper function to get icon for action
    function getActionIcon(action: string) {
        switch (action) {
            case 'issue':
                return Key;
            case 'refresh':
                return RefreshCw;
            case 'revoke':
                return Ban;
            case 'use':
                return Activity;
            case 'rotate':
                return RotateCw;
            default:
                return Activity;
        }
    }
    
    // Helper function to get human-readable token type name
    function getTokenTypeName(type: string) {
        switch (type) {
            case 'access':
                return 'Access Token';
            case 'refresh':
                return 'Refresh Token';
            case 'api_key':
                return 'API Key';
            default:
                return type;
        }
    }
    
    // Helper function to get human-readable action name
    function getActionName(action: string) {
        switch (action) {
            case 'issue':
                return 'Issue';
            case 'refresh':
                return 'Refresh';
            case 'revoke':
                return 'Revoke';
            case 'use':
                return 'Use';
            case 'rotate':
                return 'Rotate';
            default:
                return action;
        }
    }
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <!-- Total Logs -->
    <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Total Logs</CardTitle>
            <Activity class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div class="text-2xl font-bold">{props.metrics.total.toLocaleString()}</div>
            <p class="text-xs text-muted-foreground">Lifetime token operations</p>
        </CardContent>
    </Card>
    
    <!-- Success Rate -->
    <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Success Rate</CardTitle>
            <Check class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div class="text-2xl font-bold">{successRate}%</div>
            <Progress value={successRate} class="h-2" />
            <div class="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{props.metrics.success.toLocaleString()} successful</span>
                <span>{props.metrics.failure.toLocaleString()} failed</span>
            </div>
        </CardContent>
    </Card>
    
    <!-- Recent Activity -->
    <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Recent Activity</CardTitle>
            <Clock class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div class="text-2xl font-bold">{props.metrics.last24Hours.toLocaleString()}</div>
            <p class="text-xs text-muted-foreground">Last 24 hours</p>
            <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                    <span class="font-medium">7 days:</span> {props.metrics.lastWeek.toLocaleString()}
                </div>
                <div>
                    <span class="font-medium">30 days:</span> {props.metrics.lastMonth.toLocaleString()}
                </div>
            </div>
        </CardContent>
    </Card>
    
    <!-- Token Type Distribution -->
    <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Token Types</CardTitle>
            <Key class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div class="space-y-2">
                {#each props.metrics.tokenTypeDistribution as item}
                    <div class="flex items-center">
                        <svelte:component this={getTokenTypeIcon(item.type)} class="mr-2 h-4 w-4 text-muted-foreground" />
                        <div class="flex-1 text-xs">
                            {getTokenTypeName(item.type)}
                            <span class="text-muted-foreground ml-2">({item.count.toLocaleString()})</span>
                        </div>
                        <div class="ml-auto text-xs font-medium">
                            {props.metrics.total > 0 ? Math.round((item.count / props.metrics.total) * 100) : 0}%
                        </div>
                    </div>
                {/each}
            </div>
        </CardContent>
    </Card>
</div>

<!-- Second row with action distribution -->
<div class="grid gap-4 mt-4">
    <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Action Distribution</CardTitle>
            <Activity class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {#each props.metrics.actionDistribution as item}
                    <div class="flex flex-col items-center justify-center p-2 bg-muted rounded-lg">
                        <svelte:component this={getActionIcon(item.type)} class="mb-2 h-5 w-5 text-primary" />
                        <div class="text-sm font-medium">{getActionName(item.type)}</div>
                        <div class="text-xs text-muted-foreground">{item.count.toLocaleString()}</div>
                    </div>
                {/each}
            </div>
        </CardContent>
    </Card>
</div>
