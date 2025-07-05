<script lang="ts">
    import {
        RefreshCw,
        SendHorizonal,
        Server,
        ChevronDown,
        ChevronUp,
        Radio,
        Users,
        MessageSquare,
    } from "lucide-svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import {
        Tooltip,
        TooltipTrigger,
        TooltipContent
    } from "$lib/components/ui/tooltip";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import {
        Card,
        CardHeader,
        CardTitle,
        CardDescription,
        CardContent,
        CardFooter,
    } from "$lib/components/ui/card";
    import {
        Tabs,
        TabsContent,
        TabsList,
        TabsTrigger,
    } from "$lib/components/ui/tabs";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import {
        Accordion,
        AccordionContent,
        AccordionItem,
        AccordionTrigger,
    } from "$lib/components/ui/accordion";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import { writable } from "svelte/store";
    
    // Track which payloads are expanded
    let showFullPayload = {};

    // Get data from page data
    export let data;

    // Define breadcrumbs for this page
    const pageCrumbs = [["Admin", "/admin"], ["Debug"], "Messaging"];

    // Store for real-time data
    const connections = writable([]);
    const subscriptions = writable([]);
    const userConnections = writable({});
    const keySubscriptions = writable({});
    const connectionCount = writable(0);
    const subscriptionCount = writable(0);
    const userCount = writable(0);
    const whatsAppClients = writable([]);
    const whatsAppClientCount = writable(0);
    const messageTraces = writable([]);

    // Message tester state
    let messageType = "message";
    let messageScope = "";
    let messagePayload = "{}";
    let sendResult = "";
    let sendStatus = "";

    // Refresh data
    async function refreshData() {
        try {
            // First clean up any stale connections
            await fetch("/admin/debug/messaging/api/data/cleanup", {
                method: "POST",
            });

            // Then fetch main debug data
            const debugResponse = await fetch(
                `/admin/debug/messaging/api/data?_=${Date.now()}`,
            );
            const debugJson = await debugResponse.json();

            if (debugJson.success) {
                connections.set(debugJson.connections || []);
                subscriptions.set(debugJson.subscriptions || []);
                userConnections.set(debugJson.userConnections || {});
                keySubscriptions.set(debugJson.keySubscriptions || {});
                connectionCount.set(debugJson.connectionCount || 0);
                subscriptionCount.set(debugJson.subscriptionCount || 0);
                userCount.set(debugJson.userCount || 0);
                whatsAppClients.set(debugJson.whatsAppClients || []);
                whatsAppClientCount.set(debugJson.whatsAppClientCount || 0);
            }

            // Fetch message traces from dedicated API endpoint
            const tracesResponse = await fetch(
                `/admin/debug/messaging/api/traces?_=${Date.now()}`,
            );
            const tracesJson = await tracesResponse.json();

            if (
                tracesJson.success &&
                tracesJson.messageTraces &&
                tracesJson.messageTraces.length > 0
            ) {
                messageTraces.set(tracesJson.messageTraces);
            }
        } catch (err) {
            console.error("Failed to refresh messaging data:", err);
        }
    }

    // Send test message
    async function sendTestMessage() {
        try {
            sendStatus = "sending";
            let payload;
            try {
                payload = JSON.parse(messagePayload);
            } catch (err) {
                sendResult = `Error parsing JSON payload: ${err.message}`;
                sendStatus = "error";
                return;
            }

            const response = await fetch(`/admin/debug/messaging/api/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: messageType,
                    scope: messageScope,
                    payload,
                }),
            });

            const result = await response.json();
            sendResult = JSON.stringify(result, null, 2);
            sendStatus = response.ok ? "success" : "error";

            // Refresh data after sending
            await refreshData();
        } catch (err) {
            sendResult = `Error sending message: ${err.message}`;
            sendStatus = "error";
        }
    }

    // Auto-refresh interval
    let refreshInterval;

    // Handle page load
    onMount(() => {
        // Load data immediately
        refreshData();
        // Then refresh data every 5 seconds
        refreshInterval = setInterval(refreshData, 5000);
    });

    // Clean up on destroy
    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });

    // Format number with commas
    function formatNumber(num) {
        if (num === undefined || num === null) return "0";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Format date
    function formatDate(timestamp) {
        if (!timestamp) return "N/A";
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Format duration with relative time
    function formatDuration(timestamp) {
        if (!timestamp) return "N/A";
        
        const now = new Date();
        const date = new Date(timestamp);
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        
        // Less than 1 minute
        if (seconds < 60) {
            return seconds <= 0 ? "just now" : `${seconds}s ago`;
        }
        
        // Less than 1 hour
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes}m${minutes > 1 ? '' : ''} ago`;
        }
        
        // Less than 24 hours
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h${hours > 1 ? '' : ''} ago`;
        }
        
        // Less than 30 days
        const days = Math.floor(hours / 24);
        if (days < 30) {
            return `${days}d${days > 1 ? '' : ''} ago`;
        }
        
        // More than 30 days - show date
        return date.toLocaleDateString();
    }

    // Format protocol badge
    function getProtocolBadge(protocol) {
        switch (protocol) {
            case "websocket":
                return "bg-blue-500";
            case "sse":
                return "bg-green-500";
            case "webhook":
                return "bg-purple-500";
            case "mqtt":
                return "bg-orange-500";
            default:
                return "bg-gray-500";
        }
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Messaging Debug">
        <svelte:fragment slot="action">
            <ActionButton
                label="Refresh"
                icon={RefreshCw}
                onClick={refreshData}
            />
        </svelte:fragment>
    </PageHeader>

    <PageContent>
        <!-- Stats Cards -->
        <div class="grid gap-4 md:grid-cols-4 mb-6">
            <!-- Active Connections Card -->
            <Card class="relative overflow-hidden">
                <div
                    class="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-blue-400 to-blue-600"
                ></div>
                <CardHeader class="pb-1 pt-4">
                    <div class="flex items-center justify-between">
                        <CardTitle class="text-3xl font-bold">
                            {formatNumber($connectionCount)}
                        </CardTitle>
                        <div class="p-2 rounded-full bg-blue-100 text-blue-600">
                            <Users class="h-5 w-5" />
                        </div>
                    </div>
                    <p class="text-xs font-medium text-muted-foreground mt-1">
                        Active Connections
                    </p>
                </CardHeader>
                <CardContent>
                    <div class="flex items-center text-sm">
                        <div
                            class="h-2 w-2 rounded-full bg-green-500 mr-2"
                        ></div>
                        <span class="font-medium"
                            >{Object.keys($userConnections).length} users connected</span
                        >
                    </div>
                </CardContent>
            </Card>



            <!-- Subscriptions Card -->
            <Card class="relative overflow-hidden">
                <div
                    class="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-purple-400 to-purple-600"
                ></div>
                <CardHeader class="pb-1 pt-4">
                    <div class="flex items-center justify-between">
                        <CardTitle class="text-3xl font-bold">
                            {formatNumber($subscriptionCount)}
                        </CardTitle>
                        <div
                            class="p-2 rounded-full bg-purple-100 text-purple-600"
                        >
                            <Radio class="h-5 w-5" />
                        </div>
                    </div>
                    <p class="text-xs font-medium text-muted-foreground mt-1">
                        Active Subscriptions
                    </p>
                </CardHeader>
                <CardContent>
                    <div class="flex items-center text-sm">
                        <span class="font-medium"
                            >Across {formatNumber(
                                Object.keys($keySubscriptions).length,
                            )} topics</span
                        >
                    </div>
                </CardContent>
            </Card>

                        <!-- WhatsApp Clients Card -->
                        <Card class="relative overflow-hidden">
                            <div
                                class="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-green-400 to-green-600"
                            ></div>
                            <CardHeader class="pb-1 pt-4">
                                <div class="flex items-center justify-between">
                                    <CardTitle class="text-3xl font-bold">
                                        {formatNumber($whatsAppClientCount)}
                                    </CardTitle>
                                    <div
                                        class="p-2 rounded-full bg-green-100 text-green-600"
                                    >
                                        <MessageSquare class="h-5 w-5" />
                                    </div>
                                </div>
                                <p class="text-xs font-medium text-muted-foreground mt-1">
                                    WhatsApp Clients
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div class="flex items-center text-sm">
                                    <div
                                        class="h-2 w-2 rounded-full {$whatsAppClientCount >
                                        0
                                            ? 'bg-green-500'
                                            : 'bg-gray-300'} mr-2"
                                    ></div>
                                    <span class="font-medium"
                                        >{$whatsAppClientCount > 0
                                            ? "Active connections"
                                            : "No active connections"}</span
                                    >
                                </div>
                            </CardContent>
                        </Card>

            <!-- System Status Card -->
            <Card class="relative overflow-hidden">
                <div
                    class="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                ></div>
                <CardHeader class="pb-1 pt-4">
                    <div class="flex items-center justify-between">
                        <CardTitle class="text-3xl font-bold">Online</CardTitle>
                        <div
                            class="p-2 rounded-full bg-emerald-100 text-emerald-600"
                        >
                            <Server class="h-5 w-5" />
                        </div>
                    </div>
                    <p class="text-xs font-medium text-muted-foreground mt-1">
                        System Status
                    </p>
                </CardHeader>
                <CardContent>
                    <div class="flex items-center text-sm">
                        <div
                            class="h-2 w-2 rounded-full bg-green-500 mr-2"
                        ></div>
                        <span class="font-medium">All systems operational</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- Main Tabs -->
        <Tabs defaultValue="connections" class="w-full">
            <TabsList class="grid grid-cols-5 mb-4">
                <TabsTrigger value="connections">
                    <Server class="h-4 w-4 mr-2" />
                    Connections
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                    <Radio class="h-4 w-4 mr-2" />
                    Subscriptions
                </TabsTrigger>

                <TabsTrigger value="traces">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-4 w-4 mr-2"
                        ><path d="M17 22v-8.3a2 2 0 0 0-3.1-1.7l-1.9 1.3"
                        ></path><path
                            d="M12 12v4h4.3a2 2 0 0 0 1.7-3.3l-4.3-6.2c-.4-.5-1.1-.5-1.4 0L8 12.7"
                        ></path><path d="M7 17v5"></path><path
                            d="M7 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"
                        ></path></svg
                    >
                    Message Traces
                </TabsTrigger>
                <TabsTrigger value="whatsapp">
                    <MessageSquare class="h-4 w-4 mr-2" />
                    WhatsApp
                </TabsTrigger>
            </TabsList>

            <!-- Connections Tab -->
            <TabsContent value="connections" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Active Connections</CardTitle>
                        <CardDescription
                            >All active connections to the messaging system</CardDescription
                        >
                    </CardHeader>
                    <CardContent>
                        {#if $connections.length === 0}
                            <div class="text-center py-8 text-muted-foreground">
                                <Server
                                    class="mx-auto h-12 w-12 opacity-20 mb-2"
                                />
                                <p>No active connections</p>
                            </div>
                        {:else}
                            <div class="space-y-3">
                                {#each $connections as conn}
                                    <div class="border rounded-md p-3 hover:bg-muted/10 transition-colors">
                                        <div class="flex items-start justify-between mb-2">
                                            <div class="space-y-1 flex-1 min-w-0">
                                                <div class="flex items-center">
                                                    <!-- <span class="font-medium truncate">
                                                        {conn.userInfo?.name || 'Anonymous User'}
                                                    </span> -->
                                                    <span class="font-medium truncate">
                                                        {conn.userInfo?.email}
                                                    </span>
                                                    <!-- <span class="text-muted-foreground text-sm ml-2 truncate">
                                                        [{conn.id}]
                                                    </span> -->
                                                
                                                </div>
                                                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                    <div class="flex items-center">
                                                        <span class="w-20 text-muted-foreground">Type:</span>
                                                        <Badge 
                                                            variant={conn.protocol === 'sse' ? 'secondary' : 'outline'}
                                                            class={getProtocolBadge(conn.protocol) + ' ml-1'}
                                                        >
                                                            {conn.protocol}
                                                        </Badge>
                                                    </div>
                                                    <div class="flex items-center">
                                                        <span class="w-20 text-muted-foreground">Node:</span>
                                                        <span class="font-mono text-xs">{conn.nodeId}</span>
                                                    </div>
                                                    <div class="flex items-center">
                                                        <span class="w-20 text-muted-foreground">Connected:</span>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <span class="ml-1">{formatDuration(conn.connectedAt)}</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{new Date(conn.connectedAt).toLocaleString()}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" class="ml-2" on:click={() => {
                                                const connectionId = conn.id;
                                                const element = document.getElementById(`connection-${connectionId}`);
                                                if (element) {
                                                    element.classList.toggle('hidden');
                                                }
                                            }}>
                                                <ChevronDown class="h-4 w-4" />
                                            </Button>
                                        </div>
                                        
                                        <div id={`connection-${conn.id}`} class="hidden mt-3 pt-3 border-t">
                                            <div class="grid grid-cols-2 gap-2 text-sm">
                                                <div class="col-span-2">
                                                    <span class="text-muted-foreground">Connection ID:</span>
                                                    <code class="ml-1 text-xs bg-muted px-2 py-1 rounded">{conn.id}</code>
                                                </div>
                                                <div>
                                                    <span class="text-muted-foreground">Route:</span>
                                                    <span class="ml-1">{conn.route || "N/A"}</span>
                                                </div>
                                                <div>
                                                    <span class="text-muted-foreground">Session:</span>
                                                    <span class="ml-1">{conn.sessionId || "N/A"}</span>
                                                </div>
                                                <div class="col-span-2">
                                                    <span class="text-muted-foreground">User ID:</span>
                                                    <code class="ml-1 text-xs bg-muted px-2 py-1 rounded">{conn.userInfo?.id || 'N/A'}</code>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            </TabsContent>

            <!-- Subscriptions Tab -->
            <TabsContent value="subscriptions" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Active Subscriptions</CardTitle>
                        <CardDescription
                            >All active subscriptions in the messaging system</CardDescription
                        >
                    </CardHeader>
                    <CardContent>
                        {#if $subscriptions.length === 0}
                            <div class="text-center py-8 text-muted-foreground">
                                <Radio
                                    class="mx-auto h-12 w-12 opacity-20 mb-2"
                                />
                                <p>No active subscriptions</p>
                            </div>
                        {:else}
                            <div class="space-y-4">
                                {#each Object.entries($keySubscriptions) as [key, subs]}
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value={key}>
                                            <AccordionTrigger>
                                                <div
                                                    class="flex items-center justify-between w-full pr-4"
                                                >
                                                    <div
                                                        class="flex items-center"
                                                    >
                                                        <Radio
                                                            class="h-4 w-4 mr-2"
                                                        />
                                                        <span
                                                            class="font-mono text-sm"
                                                            >{key}</span
                                                        >
                                                    </div>
                                                    <Badge variant="outline"
                                                        >{subs.length} subscriber{subs.length !==
                                                        1
                                                            ? "s"
                                                            : ""}</Badge
                                                    >
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div class="space-y-2">
                                                    {#each subs as sub}
                                                        <div
                                                            class="border rounded-md p-3"
                                                        >
                                                            <div
                                                                class="flex items-center justify-between mb-2"
                                                            >
                                                                <div
                                                                    class="font-medium truncate max-w-[70%]"
                                                                >
                                                                    {sub.id}
                                                                </div>
                                                            </div>
                                                            <div
                                                                class="grid grid-cols-1 gap-2 text-sm"
                                                            >
                                                                <div>
                                                                    <span
                                                                        class="text-muted-foreground"
                                                                        >Scope:</span
                                                                    >
                                                                    <span
                                                                        class="font-mono"
                                                                        >{sub.scope}</span
                                                                    >
                                                                </div>
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                {/each}
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            </TabsContent>

            <!-- Message Traces Tab -->
            <TabsContent value="traces" class="space-y-4">
                <Card class="w-full">
                    <CardHeader
                        class="flex flex-row items-center justify-between"
                    >
                        <div>
                            <CardTitle>Message Traces</CardTitle>
                            <CardDescription
                                >Audit log of message flow through the system</CardDescription
                            >
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            on:click={() => {
                                fetch(
                                    "/admin/debug/messaging/api/traces/clear",
                                    {
                                        method: "POST",
                                    },
                                ).then(() => {
                                    // Clear local traces immediately
                                    messageTraces.set([]);
                                    // Then refresh other data
                                    refreshData();
                                });
                            }}
                        >
                            Clear Traces
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {#if $messageTraces.length === 0}
                            <div class="text-center py-8 text-muted-foreground">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    class="mx-auto h-12 w-12 opacity-20 mb-2"
                                    ><path
                                        d="M17 22v-8.3a2 2 0 0 0-3.1-1.7l-1.9 1.3"
                                    ></path><path
                                        d="M12 12v4h4.3a2 2 0 0 0 1.7-3.3l-4.3-6.2c-.4-.5-1.1-.5-1.4 0L8 12.7"
                                    ></path><path d="M7 17v5"></path><path
                                        d="M7 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"
                                    ></path></svg
                                >
                                <p>No message traces recorded</p>
                            </div>
                        {:else}
                            <div class="overflow-x-auto">
                                <table class="w-full border-collapse">
                                    <thead>
                                        <tr class="border-b">
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Time</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >From</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >To</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Direction</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Status</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Type</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Scope</th
                                            >
                                            <th
                                                class="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                                                >Details</th
                                            >
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each $messageTraces as trace}
                                            <tr
                                                class="border-b hover:bg-muted/50"
                                            >
                                                <td class="py-2 px-3 text-sm">
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <span>{formatDuration(trace.timestamp)}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{formatDate(trace.timestamp)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>
                                                <td class="py-2 px-3 text-sm min-w-[150px]">
                                                    {#if trace.from && trace.from !== 'system'}
                                                        <NameWithIdLink
                                                            record={{
                                                                id: trace.from,
                                                                name: trace.userEmail || trace.from,
                                                                email: trace.userEmail
                                                            }}
                                                            baseUrl="/admin/users"
                                                            className="text-sm"
                                                            showId={false}
                                                        />
                                                    {:else}
                                                        <div class="text-muted-foreground">system</div>
                                                    {/if}
                                                </td>
                                                <td class="py-2 px-3 text-sm min-w-[150px]">
                                                    {#if trace.to && trace.to !== 'unknown' && trace.to !== 'system'}
                                                        <NameWithIdLink
                                                            record={{
                                                                id: trace.to,
                                                                name: trace.recipientEmail || trace.to,
                                                                email: trace.recipientEmail
                                                            }}
                                                            baseUrl="/admin/users"
                                                            className="text-sm"
                                                            showId={false}
                                                        />
                                                    {:else}
                                                        <div class="text-muted-foreground">
                                                            {trace.to === 'system' ? 'system' : 'unknown'}
                                                        </div>
                                                    {/if}
                                                </td>
                                                <td class="py-2 px-3 text-sm">
                                                    {#if trace.direction === 'IN'}
                                                        <Badge
                                                            variant="outline"
                                                            class="bg-blue-100 text-blue-800 hover:bg-blue-100"
                                                            >IN</Badge
                                                        >
                                                    {:else}
                                                        <Badge
                                                            variant="outline"
                                                            class="bg-purple-100 text-purple-800 hover:bg-purple-100"
                                                            >OUT</Badge
                                                        >
                                                    {/if}
                                                </td>
                                                <td class="py-2 px-3 text-sm">
                                                    {#if trace.status === "success"}
                                                        <Badge
                                                            variant="outline"
                                                            class="bg-green-100 text-green-800 hover:bg-green-100"
                                                            >Success</Badge
                                                        >
                                                    {:else if trace.status === "error"}
                                                        <Badge
                                                            variant="outline"
                                                            class="bg-red-100 text-red-800 hover:bg-red-100"
                                                            >Error</Badge
                                                        >
                                                    {:else}
                                                        <Badge
                                                            variant="outline"
                                                            class="bg-gray-100 text-gray-800 hover:bg-gray-100"
                                                            >{trace.status}</Badge
                                                        >
                                                    {/if}
                                                </td>
                                                <td class="py-2 px-3 text-sm"
                                                    >{trace.messageType ||
                                                        "unknown"}</td
                                                >
                                                <td class="py-2 px-3 text-sm"
                                                    >{trace.messageScope ||
                                                        "unknown"}</td
                                                >
                                                <td class="py-2 px-3 text-sm max-w-xs">
                                                    <div class="space-y-2">
                                                        <!-- Error Display -->
                                                        {#if trace.error}
                                                            <div class="text-red-600 mb-2">
                                                                <div class="font-medium text-xs">Error:</div>
                                                                <div class="text-xs break-all bg-red-50 p-1.5 rounded border border-red-100">
                                                                    {trace.error}
                                                                </div>
                                                            </div>
                                                        {/if}
                                                        
                                                        <!-- Action Badge -->
                                                        {#if trace.payload?.action}
                                                            <div class="mb-1">
                                                                <div class="flex items-center justify-between">
                                                                    <!-- <span class="text-xs font-medium text-muted-foreground">Action:</span> -->
                                                                    <Badge variant="secondary" class="text-xs">
                                                                        {trace.payload.action}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        {/if}
                                                        
                                                        <!-- Connection Info -->
                                                        <!-- <div class="text-xs space-y-0.5 mt-2 pt-2 border-t">
                                                            <div class="flex items-baseline justify-between">
                                                                <div class="flex items-baseline">
                                                                    <span class="text-muted-foreground mr-1">Type:</span>
                                                                    <span class="font-mono">{trace.messageType}</span>
                                                                </div>
                                                                {#if trace.sudo}
                                                                    <Badge variant="destructive" size="sm" class="text-xs h-4">SUDO</Badge>
                                                                {/if}
                                                            </div>
                                                            
                                                            {#if trace.messageScope}
                                                                <div class="flex items-baseline">
                                                                    <span class="text-muted-foreground mr-1">Scope:</span>
                                                                    <span class="font-mono">{trace.messageScope}</span>
                                                                </div>
                                                            {/if}
                                                            
                                                            {#if trace.connectionId || trace.protocol}
                                                                <div class="flex items-center space-x-3">
                                                                    {#if trace.connectionId}
                                                                        <div class="flex items-baseline">
                                                                            <span class="text-muted-foreground mr-1">Conn:</span>
                                                                            <code class="text-xs font-mono">{trace.connectionId.substring(0, 8)}...</code>
                                                                        </div>
                                                                    {/if}
                                                                    {#if trace.protocol}
                                                                        <div class="flex items-baseline">
                                                                            <span class="text-muted-foreground mr-1">Proto:</span>
                                                                            <span class="font-mono text-xs">{trace.protocol}</span>
                                                                        </div>
                                                                    {/if}
                                                                </div>
                                                            {/if}
                                                        </div> -->
                                                    </div>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            </TabsContent>

            <!-- WhatsApp Clients Tab -->
            <TabsContent value="whatsapp" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Active WhatsApp Clients</CardTitle>
                        <CardDescription
                            >Currently connected WhatsApp client sessions</CardDescription
                        >
                    </CardHeader>
                    <CardContent>
                        {#if $whatsAppClientCount === 0}
                            <p class="text-sm text-muted-foreground">
                                No active WhatsApp clients
                            </p>
                        {:else}
                            <div class="space-y-2">
                                {#each $whatsAppClients as clientId}
                                    <div
                                        class="flex items-center justify-between p-2 border rounded"
                                    >
                                        <div
                                            class="flex items-center space-x-2"
                                        >
                                            <div
                                                class="h-2 w-2 rounded-full bg-green-500"
                                            ></div>
                                            <code class="text-sm font-mono"
                                                >{clientId}</code
                                            >
                                        </div>
                                        <Badge variant="outline" class="text-xs"
                                            >Connected</Badge
                                        >
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            </TabsContent>

            <!-- Message Tester Tab -->
            <TabsContent value="message-tester" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Message Tester</CardTitle>
                        <CardDescription
                            >Send test messages to the messaging system</CardDescription
                        >
                    </CardHeader>
                    <CardContent>
                        <form
                            class="space-y-4"
                            on:submit|preventDefault={sendTestMessage}
                        >
                            <div class="grid gap-4">
                                <div class="grid gap-2">
                                    <Label for="messageType">Message Type</Label
                                    >
                                    <Select bind:value={messageType}>
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder="Select message type"
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="message"
                                                >message</SelectItem
                                            >
                                            <SelectItem value="event"
                                                >event</SelectItem
                                            >
                                            <SelectItem value="whatsapp"
                                                >whatsapp</SelectItem
                                            >
                                            <SelectItem value="device"
                                                >device</SelectItem
                                            >
                                            <SelectItem value="webrtc"
                                                >webrtc</SelectItem
                                            >
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="messageScope"
                                        >Message Scope</Label
                                    >
                                    <Input
                                        id="messageScope"
                                        bind:value={messageScope}
                                        placeholder="e.g., user:123, connection:abc, subscription:whatsapp:xyz"
                                    />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="messagePayload"
                                        >Message Payload (JSON)</Label
                                    >
                                    <Textarea
                                        id="messagePayload"
                                        bind:value={messagePayload}
                                        rows={5}
                                        placeholder="Enter JSON payload here..."
                                    />
                                </div>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter class="flex-col items-start gap-4">
                        <Button class="w-full" on:click={sendTestMessage}>
                            <SendHorizonal class="mr-2 h-4 w-4" />
                            Send Message
                        </Button>

                        {#if sendResult}
                            <div class="w-full">
                                <Label class="mb-2">Result:</Label>
                                <div
                                    class="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-auto max-h-48"
                                >
                                    {sendResult}
                                </div>
                            </div>
                        {/if}
                    </CardFooter>
                </Card>
            </TabsContent>
        </Tabs>
    </PageContent>
</PageContainer>
