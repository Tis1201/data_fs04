<script lang="ts">
    import { RefreshCw, SendHorizonal, Server, Radio, Users, MessageSquare } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "$lib/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import { writable } from "svelte/store";
    
    // Get data from page data
    export let data;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Debug"],
        "Messaging"
    ];
    
    // Store for real-time data
    const connections = writable(data.connections || []);
    const subscriptions = writable(data.subscriptions || []);
    const userConnections = writable(data.userConnections || {});
    const keySubscriptions = writable(data.keySubscriptions || {});
    const connectionCount = writable(data.connectionCount || 0);
    const subscriptionCount = writable(data.subscriptionCount || 0);
    const userCount = writable(data.userCount || 0);
    
    // Message tester state
    let messageType = "message";
    let messageScope = "";
    let messagePayload = "{}";
    let sendResult = "";
    let sendStatus = "";
    
    // Refresh data
    async function refreshData() {
        try {
            const response = await fetch(`/admin/debug/messaging?_=${Date.now()}`);
            const json = await response.json();
            
            connections.set(json.connections || []);
            subscriptions.set(json.subscriptions || []);
            userConnections.set(json.userConnections || {});
            keySubscriptions.set(json.keySubscriptions || {});
            connectionCount.set(json.connectionCount || 0);
            subscriptionCount.set(json.subscriptionCount || 0);
            userCount.set(json.userCount || 0);
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
            
            const response = await fetch(`/admin/debug/messaging/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: messageType,
                    scope: messageScope,
                    payload
                })
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
        // Refresh data every 5 seconds
        refreshInterval = setInterval(refreshData, 5000);
    });
    
    // Clean up on destroy
    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
    
    // Format date
    function formatDate(timestamp) {
        if (!timestamp) return "N/A";
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
    
    // Format duration
    function formatDuration(timestamp) {
        if (!timestamp) return "N/A";
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
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
        <div class="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium">Active Connections</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{$connectionCount}</div>
                    <p class="text-xs text-muted-foreground">Across {$userCount} users</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium">Active Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{$subscriptionCount}</div>
                    <p class="text-xs text-muted-foreground">Across {Object.keys($keySubscriptions).length} topics</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium">System Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="flex items-center">
                        <div class="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        <div class="font-medium">Operational</div>
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <!-- Main Tabs -->
        <Tabs defaultValue="connections" class="w-full">
            <TabsList class="grid grid-cols-3 mb-4">
                <TabsTrigger value="connections">Connections</TabsTrigger>
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                <TabsTrigger value="message-tester">Message Tester</TabsTrigger>
            </TabsList>
            
            <!-- Connections Tab -->
            <TabsContent value="connections" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Active Connections</CardTitle>
                        <CardDescription>All active connections to the messaging system</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {#if $connections.length === 0}
                            <div class="text-center py-8 text-muted-foreground">
                                <Server class="mx-auto h-12 w-12 opacity-20 mb-2" />
                                <p>No active connections</p>
                            </div>
                        {:else}
                            <div class="space-y-4">
                                {#each Object.entries($userConnections) as [userId, userConns]}
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value={userId}>
                                            <AccordionTrigger>
                                                <div class="flex items-center justify-between w-full pr-4">
                                                    <div class="flex items-center">
                                                        <Users class="h-4 w-4 mr-2" />
                                                        <span>{userConns[0]?.userInfo?.name || userId}</span>
                                                    </div>
                                                    <Badge variant="outline">{userConns.length} connection{userConns.length !== 1 ? 's' : ''}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div class="space-y-2">
                                                    {#each userConns as conn}
                                                        <div class="border rounded-md p-3">
                                                            <div class="flex items-center justify-between mb-2">
                                                                <div class="font-medium truncate max-w-[70%]">{conn.id}</div>
                                                                <Badge class={getProtocolBadge(conn.protocol)}>{conn.protocol}</Badge>
                                                            </div>
                                                            <div class="grid grid-cols-2 gap-2 text-sm">
                                                                <div>
                                                                    <span class="text-muted-foreground">Connected:</span> {formatDuration(conn.connectedAt)}
                                                                </div>
                                                                <div>
                                                                    <span class="text-muted-foreground">Route:</span> {conn.route || 'N/A'}
                                                                </div>
                                                                <div>
                                                                    <span class="text-muted-foreground">Node:</span> {conn.nodeId}
                                                                </div>
                                                                <div>
                                                                    <span class="text-muted-foreground">Session:</span> {conn.sessionId || 'N/A'}
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
            
            <!-- Subscriptions Tab -->
            <TabsContent value="subscriptions" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Active Subscriptions</CardTitle>
                        <CardDescription>All active subscriptions in the messaging system</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {#if $subscriptions.length === 0}
                            <div class="text-center py-8 text-muted-foreground">
                                <Radio class="mx-auto h-12 w-12 opacity-20 mb-2" />
                                <p>No active subscriptions</p>
                            </div>
                        {:else}
                            <div class="space-y-4">
                                {#each Object.entries($keySubscriptions) as [key, subs]}
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value={key}>
                                            <AccordionTrigger>
                                                <div class="flex items-center justify-between w-full pr-4">
                                                    <div class="flex items-center">
                                                        <Radio class="h-4 w-4 mr-2" />
                                                        <span class="font-mono text-sm">{key}</span>
                                                    </div>
                                                    <Badge variant="outline">{subs.length} subscriber{subs.length !== 1 ? 's' : ''}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div class="space-y-2">
                                                    {#each subs as sub}
                                                        <div class="border rounded-md p-3">
                                                            <div class="flex items-center justify-between mb-2">
                                                                <div class="font-medium truncate max-w-[70%]">{sub.id}</div>
                                                            </div>
                                                            <div class="grid grid-cols-1 gap-2 text-sm">
                                                                <div>
                                                                    <span class="text-muted-foreground">Scope:</span> 
                                                                    <span class="font-mono">{sub.scope}</span>
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
            
            <!-- Message Tester Tab -->
            <TabsContent value="message-tester" class="space-y-4">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Message Tester</CardTitle>
                        <CardDescription>Send test messages to the messaging system</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form class="space-y-4" on:submit|preventDefault={sendTestMessage}>
                            <div class="grid gap-4">
                                <div class="grid gap-2">
                                    <Label for="messageType">Message Type</Label>
                                    <Select bind:value={messageType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select message type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="message">message</SelectItem>
                                            <SelectItem value="event">event</SelectItem>
                                            <SelectItem value="whatsapp">whatsapp</SelectItem>
                                            <SelectItem value="device">device</SelectItem>
                                            <SelectItem value="webrtc">webrtc</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div class="grid gap-2">
                                    <Label for="messageScope">Message Scope</Label>
                                    <Input id="messageScope" bind:value={messageScope} placeholder="e.g., user:123, connection:abc, subscription:whatsapp:xyz" />
                                </div>
                                
                                <div class="grid gap-2">
                                    <Label for="messagePayload">Message Payload (JSON)</Label>
                                    <Textarea id="messagePayload" bind:value={messagePayload} rows={5} placeholder="Enter JSON payload here..." />
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
                                <div class="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-auto max-h-48">
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
