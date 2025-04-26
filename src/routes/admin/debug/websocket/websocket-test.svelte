<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { ScrollArea } from '$lib/components/ui/scroll-area';
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input";
    import { Trash2, Send, Zap, Key, RefreshCw, ChevronsUpDown } from 'lucide-svelte';
    import { socketStore } from '$lib/stores/websocket-store';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Label } from "$lib/components/ui/label";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import * as Collapsible from '$lib/components/ui/collapsible/index.js';
    import CodeBlock from '$lib/components/ui_components_sveltekit/code/CodeBlock.svelte';

    let messageInput = '';
    let apiKeyInput = '';
    let messages: any[] = [];
    let connected = false;
    let error: Error | null = null;
    let loading = false;
    let socketId = '';

    // Subscribe to socket store
    $: if ($socketStore) {
        messages = $socketStore.messages;
        connected = $socketStore.status === 'OPEN';
        error = $socketStore.error;
        socketId = $socketStore.socketId;
    }

    function sendMessage() {
        if (messageInput.trim()) {
            socketStore.send({ 
                type: 'message', 
                scope: 'user:self',
                payload: {content:messageInput} });
            messageInput = '';
        }
    }

    async function sendTestMessage() {
        try {
            loading = true;
            await fetch('/api/ws/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'system',
                    message: `Test broadcast message from HTTP route at ${new Date().toLocaleTimeString()}`
                })
            });
        } catch (error) {
            console.error('Failed to send test message:', error);
        } finally {
            loading = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    }

    function reconnectWs() {
        socketStore.disconnect();
        socketStore.connect();
    }

    function connectWithApiKey() {
        if (!apiKeyInput.trim()) return;
        
        socketStore.disconnect();
        socketStore.connect(`?apiKey=${encodeURIComponent(apiKeyInput.trim())}`);
    }

    function clearWsMessages() {
        socketStore.clearMessages();
    }

    function getMessageColor(type: string) {
        switch (type) {
            case 'system':
                return 'text-blue-500';
            case 'error':
                return 'text-red-500';
            case 'echo':
                return 'text-green-500';
            default:
                return 'text-gray-500';
        }
    }
</script>

<Card>
    <CardHeader>
        <div class="flex items-center justify-between">
            <div>
                <CardTitle>WebSocket Debug Console</CardTitle>
                <CardDescription>WebSocket testing and debugging</CardDescription>
            </div>
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                    <div class={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"} animate-pulse`}></div>
                    <span class="text-sm font-medium">{connected ? "Connected" : "Disconnected"}</span>
                </div>
                {#if socketId}
                    <span class="text-sm text-muted-foreground">Socket ID: {socketId}</span>
                {/if}
                <!-- <Button size="sm" variant={connected ? "outline" : "default"} on:click={reconnectWs}>
                    <RefreshCw class="h-4 w-4 mr-2" />
                    Reconnect
                </Button> -->
            </div> 
        </div>
    </CardHeader>
    <CardContent class="space-y-4">
        <Tabs defaultValue="message" class="w-full">
            <TabsList class="grid grid-cols-2">
                <TabsTrigger value="message">Send Message</TabsTrigger>
                <TabsTrigger value="auth">Authentication</TabsTrigger>
            </TabsList>
            <TabsContent value="message" class="space-y-4">
                <div class="flex gap-2">
                    <div class="flex-1">
                        <Input
                            type="text"
                            placeholder="Type a message..."
                            bind:value={messageInput}
                            on:keydown={handleKeydown}
                        />
                    </div>
                    <Button on:click={sendMessage}>
                        <Send class="h-4 w-4 mr-2" />
                        Send
                    </Button>
                    <Button variant="secondary" on:click={sendTestMessage} disabled={loading}>
                        {#if loading}
                            <Skeleton class="h-4 w-4 mr-2 rounded-full" />
                        {:else}
                            <Zap class="h-4 w-4 mr-2" />
                        {/if}
                        Test
                    </Button>
                    <Button variant="outline" size="icon" on:click={clearWsMessages}>
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
            </TabsContent>
            <TabsContent value="auth">
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label for="apiKey">API Key</Label>
                        <div class="flex gap-2">
                            <Input
                                id="apiKey"
                                type="text"
                                placeholder="Enter API key..."
                                bind:value={apiKeyInput}
                            />
                            <Button on:click={connectWithApiKey}>
                                <Key class="h-4 w-4 mr-2" />
                                Connect
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Connect using an API key instead of session cookies. This is useful for integration with external services.
                        </p>
                    </div>
                </div>
            </TabsContent>
        </Tabs>

        <ScrollArea class="h-[500px] rounded-md border">
            <div class="p-4 space-y-3">
                {#if messages}
                    {#each messages as message}
                        {#if message.type !== 'pong'}
                            <div class="p-3 rounded-lg bg-muted/50">
                                <div class="flex items-center gap-2 mb-1.5">
                                    <Badge variant={message.type === 'system' ? 'secondary' : message.type === 'error' ? 'destructive' : 'default'}>
                                        {message.type}
                                    </Badge>
                                    {#if message.data?.timestamp}
                                        <span class="text-xs text-muted-foreground">{new Date(message.data.timestamp).toLocaleTimeString()}</span>
                                    {/if}
                                    {#if socketId}
                                        <span class="text-xs font-mono text-muted-foreground">ID: {socketId}</span>
                                    {/if}
                                    {#if message.data?.authMethod}
                                        <Badge variant="outline">{message.data.authMethod}</Badge>
                                    {/if}
                                </div>
                                {JSON.stringify(message)}
                                
                                {#if message.data?.originalMessage}
                                    <div class="text-sm font-mono text-muted-foreground mt-1">
                                        {message.data.originalMessage}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    {/each}
                {/if}
            </div>
        </ScrollArea>
    </CardContent>
    <CardFooter>
        <p class="text-sm text-muted-foreground">
            Status: {$socketStore.status}
            {#if error}
                <span class="text-destructive ml-2">Error: {error.message}</span>
            {/if}
        </p>
    </CardFooter> 
</Card>
