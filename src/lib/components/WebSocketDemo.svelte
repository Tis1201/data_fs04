<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { socketStore, WebSocketStatus } from '$lib/stores/socket-store';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Skeleton } from '$lib/components/ui/skeleton';
    
    let message = '';
    let connecting = false;
    let $socketStore;
    
    // Subscribe to the socket store
    const unsubscribe = socketStore.subscribe(store => {
        $socketStore = store;
    });
    
    function connect() {
        connecting = true;
        socketStore.connect();
        setTimeout(() => {
            connecting = false;
        }, 1000);
    }
    
    function disconnect() {
        socketStore.disconnect();
    }
    
    function sendMessage() {
        if (!message.trim()) return;
        
        try {
            socketStore.send({
                type: 'message',
                content: message,
                timestamp: new Date().toISOString()
            });
            message = '';
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    
    function clearMessages() {
        socketStore.clearMessages();
    }
    
    onMount(() => {
        // Auto-connect when component mounts
        connect();
    });
    
    onDestroy(() => {
        // Clean up subscription and disconnect when component is destroyed
        unsubscribe();
        disconnect();
    });
</script>

<div class="space-y-4 p-4 border rounded-lg">
    <h2 class="text-xl font-bold">WebSocket Demo</h2>
    
    <div class="flex items-center gap-2">
        <div class="flex-1">
            <div class="flex items-center gap-2">
                <div class={`w-3 h-3 rounded-full ${
                    $socketStore.status === WebSocketStatus.OPEN 
                        ? 'bg-green-500' 
                        : $socketStore.status === WebSocketStatus.CONNECTING 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                }`}></div>
                <span>Status: {$socketStore.status}</span>
            </div>
        </div>
        
        <div class="space-x-2">
            {#if $socketStore.status !== WebSocketStatus.OPEN}
                <Button 
                    variant="outline" 
                    size="sm" 
                    on:click={connect} 
                    disabled={connecting || $socketStore.status === WebSocketStatus.CONNECTING}
                >
                    {#if connecting || $socketStore.status === WebSocketStatus.CONNECTING}
                        Connecting...
                    {:else}
                        Connect
                    {/if}
                </Button>
            {:else}
                <Button 
                    variant="outline" 
                    size="sm" 
                    on:click={disconnect}
                >
                    Disconnect
                </Button>
            {/if}
            
            <Button 
                variant="outline" 
                size="sm" 
                on:click={clearMessages}
            >
                Clear Messages
            </Button>
        </div>
    </div>
    
    {#if $socketStore.error}
        <div class="p-2 bg-red-100 text-red-800 rounded">
            Error: {$socketStore.error.message}
        </div>
    {/if}
    
    <div class="flex gap-2">
        <Input 
            type="text" 
            placeholder="Type a message..." 
            bind:value={message} 
            on:keydown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={$socketStore.status !== WebSocketStatus.OPEN}
        />
        <Button 
            on:click={sendMessage}
            disabled={$socketStore.status !== WebSocketStatus.OPEN || !message.trim()}
        >
            Send
        </Button>
    </div>
    
    <div class="border rounded-lg p-2 h-64 overflow-y-auto">
        <h3 class="font-semibold mb-2">Messages</h3>
        
        {#if $socketStore.status === WebSocketStatus.CONNECTING}
            <div class="space-y-2">
                <Skeleton class="h-6 w-full" />
                <Skeleton class="h-6 w-3/4" />
                <Skeleton class="h-6 w-5/6" />
            </div>
        {:else if $socketStore.messages.length === 0}
            <p class="text-gray-500 italic">No messages yet</p>
        {:else}
            <div class="space-y-2">
                {#each $socketStore.messages as msg, i}
                    <div class="p-2 bg-gray-100 rounded">
                        {#if typeof msg === 'string'}
                            <pre class="whitespace-pre-wrap text-sm">{msg}</pre>
                        {:else}
                            <pre class="whitespace-pre-wrap text-sm">{JSON.stringify(msg, null, 2)}</pre>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
