<script lang="ts">
    import { ArrowLeft, Send, RefreshCw, Trash2 } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '$lib/components/ui/card';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { sseStore } from '$lib/stores/sse-store';
    import { onMount } from 'svelte';
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Debug", "/admin/debug"],
        "SSE"
    ];

    let message = '';
    let sending = false;
    let connected = false;
    let error: string | null = null;
    
    // Subscribe to the SSE store
    $: messages = $sseStore.messages;
    $: connected = $sseStore.status === 'OPEN';
    $: connectionId = $sseStore.connectionId;

    // Connect to SSE when the component mounts
    onMount(() => {
        if (!connected) {
            sseStore.connect('/api/sse');
        }
        
        return () => {
            // Disconnect when the component is destroyed
            sseStore.disconnect();
        };
    });

    /**
     * Helper function to send a message via the SSE store
     * @param type Message type
     * @param scope Message scope
     * @param payload Message payload
     * @returns Promise that resolves when the message is sent
     */
    async function sendSSEMessage(type: string, scope: string, payload: Record<string, unknown>) {
        try {
            // Use the new sendRequest function from the SSE store
            return await sseStore.sendRequest(
                { 
                    type, 
                    scope, 
                    payload 
                }
            );
        } catch (e) {
            error = `Error sending message: ${e.message}`;
            throw e;
        }
    }
    
    // Send a user message from the input field
    async function sendMessage() {
        if (!message.trim()) return;
        
        try {
            sending = true;
            
            // Send the message with the helper function using the standard format
            await sendSSEMessage('message', `connection:${connectionId}`, { content: message });
            
            // Clear the message input on success
            message = '';
        } catch (e) {
            // Error is already set in sendSSEMessage
            console.error('Failed to send message:', e);
        } finally {
            sending = false;
        }
    }

    // Reconnect to SSE
    function reconnect() {
        sseStore.disconnect();
        sseStore.connect('/api/sse');
    }

    // Clear all messages
    function clearMessages() {
        sseStore.clearMessages();
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="SSE Debug">
        <svelte:fragment slot="action">
            <ActionButton
                label="Back"
                icon={ArrowLeft}
                href="/admin/debug"
            />
        </svelte:fragment>
    </PageHeader>
    
    <PageContent>
        <Card class="w-full">
            <CardHeader>
                <CardTitle>SSE Debug Console</CardTitle>
                <CardDescription>Simple Server-Sent Events testing</CardDescription>
                <div class="flex items-center gap-4 mt-2">
                    {#if connected}
                        <Badge variant="success">Connected</Badge>
                        {#if connectionId}
                            <Badge variant="outline">ID: {connectionId}</Badge>
                        {/if}
                    {:else}
                        <Badge variant="destructive">Disconnected</Badge>
                    {/if}
                    <Button size="sm" variant={connected ? "outline" : "default"} on:click={reconnect}>
                        <RefreshCw class="h-4 w-4 mr-2" />
                        Reconnect
                    </Button>
                    <Button size="sm" variant="outline" on:click={clearMessages}>
                        <Trash2 class="h-4 w-4 mr-2" />
                        Clear
                    </Button>
                </div>
            </CardHeader>
            
            <CardContent class="space-y-4">
                <!-- Simple message input -->
                <div class="flex items-center space-x-2">
                    <Input 
                        type="text" 
                        placeholder="Type a message..." 
                        bind:value={message} 
                        on:keydown={(e) => e.key === 'Enter' && sendMessage()}
                        disabled={sending || !connected}
                    />
                    <Button 
                        on:click={sendMessage} 
                        disabled={sending || !connected || !message.trim()}
                    >
                        <Send class="h-4 w-4 mr-2" />
                        Send
                    </Button>
                </div>
                
                <!-- Message list -->
                <ScrollArea class="h-[400px] border rounded-md p-4">
                    {#if messages && messages.length > 0}
                        <div class="space-y-4">
                            {#each [...messages].reverse() as message}
                                <div class="border rounded-lg p-4 space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">
                                            {message.event}
                                        </Badge>
                                        {#if message.timestamp}
                                            <span class="text-xs text-muted-foreground">
                                                {new Date(message.timestamp).toLocaleTimeString()}
                                            </span>
                                        {/if}
                                    </div>
                                    
                                    {#if message.content}
                                        <div class="text-sm">
                                            {message.content}
                                        </div>
                                    {/if}
                                    
                                    <div class="text-xs font-mono bg-muted rounded p-2 overflow-x-auto">
                                        {JSON.stringify(message.data, null, 2)}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="flex items-center justify-center h-32 text-muted-foreground">
                            No messages yet. Send a message to see it appear here.
                        </div>
                    {/if}
                </ScrollArea>
            </CardContent>
            
            <CardFooter>
                <p class="text-sm text-muted-foreground">
                    Status: {$sseStore.status}
                    {#if error}
                        <span class="text-destructive ml-2">Error: {error}</span>
                    {/if}
                </p>
            </CardFooter>
        </Card>
    </PageContent>
</PageContainer>