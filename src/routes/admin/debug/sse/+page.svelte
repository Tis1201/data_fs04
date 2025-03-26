<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { sseMessages, type SSEMessage } from '$lib/stores/sse-store';
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Debug",
        "SSE"
    ];

    let connected = false;
    let error: string | null = null;
    let eventSource: EventSource | null = null;

    onMount(() => {
        connectSSE();
    });

    onDestroy(() => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    });

    function connectSSE() {
        try {
            eventSource = new EventSource('/api/sse');
            
            eventSource.onopen = () => {
                connected = true;
                error = null;
            };

            eventSource.onerror = (e) => {
                connected = false;
                error = 'Connection error';
                console.error('SSE error:', e);
            };

            // Handle all messages regardless of event name
            const handleEvent = (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    const message: SSEMessage = {
                        event: e.type === 'message' ? data.event || 'message' : e.type,
                        data,
                        timestamp: data.timestamp || new Date().toISOString(),
                        sender: data.sender
                    };
                    sseMessages.addMessage(message);
                    console.log('Received SSE message:', message);
                } catch (err) {
                    console.error(`Error parsing ${e.type} event:`, err);
                }
            };

            // Listen for all incoming events
            eventSource.onmessage = handleEvent;
            eventSource.addEventListener('connected', handleEvent);

        } catch (err) {
            error = err.message;
            console.error('Error connecting to SSE:', err);
        }
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="SSE Debug">
        <svelte:fragment slot="description">
            View real-time Server-Sent Events
        </svelte:fragment>
        <svelte:fragment slot="action">
            <Badge variant={connected ? "success" : "destructive"}>
                {connected ? "Connected" : "Disconnected"}
            </Badge>
        </svelte:fragment>
    </PageHeader>

    {#if error}
        <div class="text-destructive mb-4">
            Error: {error}
        </div>
    {/if}

    <Card>
        <CardHeader>
            <CardTitle>SSE Messages</CardTitle>
            <CardDescription>
                Real-time messages from the SSE server
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div class="space-y-4">
                {#if !connected}
                    <div class="space-y-3">
                        <Skeleton class="h-[40px] w-full" />
                        <Skeleton class="h-[40px] w-full" />
                        <Skeleton class="h-[40px] w-full" />
                    </div>
                {:else}
                    {#each $sseMessages as message}
                        <div class="border rounded-lg p-4">
                            <div class="flex justify-between items-start gap-4">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                        {message.event}
                                    </Badge>
                                    {#if message.sender}
                                        <Badge variant="secondary">
                                            {message.sender.name || message.sender.email}
                                        </Badge>
                                    {/if}
                                </div>
                                <div class="text-sm text-muted-foreground whitespace-nowrap">
                                    {new Date(message.timestamp).toLocaleString()}
                                </div>
                            </div>
                            
                            <div class="mt-4">
                                <div class="bg-muted rounded-md">
                                    <pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
                                        <code>{JSON.stringify(message.data, null, 4)}</code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="text-center text-muted-foreground py-8">
                            No messages yet
                        </div>
                    {/each}
                {/if}
            </div>
        </CardContent>
    </Card>
</PageContainer>