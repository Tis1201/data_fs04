<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { sseStore, type SSEMessage } from '$lib/stores/sse-store';
    import { Badge } from "$lib/components/ui/badge";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Button } from "$lib/components/ui/button";
    import { ChevronDown, ChevronUp } from "lucide-svelte";

    const pageCrumbs = [
        ["Admin", "/admin"],
        "Debug",
        "SSE"
    ];

    let connected = false;
    let error: string | null = null;
    let expandedMessages = new Set<string>();
    let messages: SSEMessage[] = [];

    function toggleMessage(messageId: string) {
        if (expandedMessages.has(messageId)) {
            expandedMessages.delete(messageId);
        } else {
            expandedMessages.add(messageId);
        }
        expandedMessages = expandedMessages; // Trigger reactivity
    }

    onMount(() => {
        // Subscribe to the SSE store to get messages and connection status
        const unsubscribe = sseStore.subscribe((state) => {
            messages = state.messages;
            connected = state.status === 'OPEN';
            error = state.error?.message || null;
        });

        // Connect to the SSE endpoint
        sseStore.connect('/api/sse');

        return () => {
            unsubscribe();
            sseStore.disconnect();
        };
    });

    onDestroy(() => {
        sseStore.disconnect();
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="SSE Debug">
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
                    {#each messages as message}
                        <div class="border rounded-lg overflow-hidden">
                            <div class="p-4 space-y-2">
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
                                        <div class="text-sm text-muted-foreground">
                                            {new Date(message.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        on:click={() => toggleMessage(message.id)}
                                    >
                                        {#if expandedMessages.has(message.id)}
                                            <ChevronUp class="h-4 w-4" />
                                        {:else}
                                            <ChevronDown class="h-4 w-4" />
                                        {/if}
                                    </Button>
                                </div>

                                {#if message.content}
                                    <div class="text-sm font-mono bg-muted rounded p-2">
                                        {message.content}
                                    </div>
                                {/if}
                            </div>

                            {#if expandedMessages.has(message.id)}
                                <div class="border-t bg-muted">
                                    <pre class="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code>{JSON.stringify(message.data, null, 4)}</code>
                                    </pre>
                                </div>
                            {/if}
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