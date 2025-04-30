<script lang="ts">
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";

    import { get } from 'svelte/store';
    import { roomStore } from "$lib/stores/room-store";

    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";

    import { Badge } from "$lib/components/ui/badge";

    import {
        Alert,
        AlertTitle,
        AlertDescription,
    } from "$lib/components/ui/alert";
    // Svelte auto-subscription
    $: room = $roomStore;
    $: console.log('roomStore debug:', $roomStore);

    function handleCreateRoom() {
        console.log("Create Room");
        roomStore.createRoom();
    }

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["User", "/user"],
        "IOT",
        "Devices"
    ];
  
    onMount(() => {
        const roomState = get(roomStore);
        if (!roomState?.roomId) {
            console.log('Calling createRoom...');
            roomStore.createRoom();
        }
    });
</script>

<PageContainer crumbs={pageCrumbs}>

    <PageHeader title="Devices">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Device"
                icon={Plus}
                onClick={handleCreateRoom}
            />
        </svelte:fragment>
    </PageHeader>


    <!-- Enhanced Room Visualization -->
    <div class="mt-4 space-y-4">
        {#if room.error}
            <Alert color="destructive" class="mt-2">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{room.error}</AlertDescription>
                <Button
                    size="sm"
                    variant="ghost"
                    on:click={() => roomStore.clearError()}>Dismiss</Button
                >
            </Alert>
        {/if}
        {#if room.roomId}
            <Card class="border shadow-sm">
                <CardHeader>
                    <CardTitle>
                        <div class="flex items-center gap-2">
                            <span>Room</span>
                            <div class="flex items-center gap-2">
                                <Badge variant="outline" class="font-mono">{room.roomId}</Badge>
                                <button 
                                    class="text-muted-foreground hover:text-foreground" 
                                    title="Copy Room ID"
                                    on:click={() => {
                                        navigator.clipboard.writeText(room.roomId);
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                </button>
                            </div>
                        </div>
                    </CardTitle>
                    
                    <CardDescription>
                        <div class="flex flex-col space-y-1">
                            <div class="flex items-center justify-between">
                                <span>Created: {new Date(room.status?.createdAt).toLocaleString()}</span>
                                {#if room.status?.createdBy}
                                    <span>By: <Badge variant="secondary" class="font-mono text-xs">{room.status.createdBy}</Badge></span>
                                {/if}
                            </div>
                            
                            {#if room.status?.password}
                                <div class="flex items-center justify-between mt-2 text-sm">
                                    <div class="flex items-center gap-2">
                                        <span class="text-muted-foreground">Password:</span>
                                        <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{room.status.password}</code>
                                    </div>
                                    <button 
                                        class="text-muted-foreground hover:text-foreground" 
                                        title="Copy Password"
                                        on:click={() => {
                                            navigator.clipboard.writeText(room.status.password);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent class="space-y-2">
                    <div class="flex flex-wrap gap-4">
                        <div>
                            <span class="font-semibold">Participants:</span>
                            <Badge color="blue"
                                >{room.status?.participantCount ?? 0}</Badge
                            >
                        </div>
                        <div>
                            <span class="font-semibold">Has Password:</span>
                            <Badge
                                color={room.status?.hasPassword
                                    ? "yellow"
                                    : "gray"}
                                >{room.status?.hasPassword
                                    ? "Yes"
                                    : "No"}</Badge
                            >
                        </div>
                        <div>
                            <span class="font-semibold">Last Activity:</span>
                            <span>{room.status?.lastActivity}</span>
                        </div>
                    </div>
                    <div>
                        <span class="font-semibold">Admins:</span>
                        {#if room.status?.admins && room.status.admins.length > 0}
                            <span>
                                {#each room.status.admins as admin, i}
                                    <Badge color="gray">{admin}</Badge>{i <
                                    room.status.admins.length - 1
                                        ? ", "
                                        : ""}
                                {/each}
                            </span>
                        {:else}
                            <span class="text-gray-400">None</span>
                        {/if}
                    </div>
                    {#if room.status?.participants && room.status.participants.length > 0}
                        <div>
                            <span class="font-semibold">Participants:</span>
                            <ul class="mt-1 space-y-1">
                                {#each room.status.participants as p}
                                    <li class="flex items-center gap-2 text-xs">
                                        <span class="font-mono">{p.userId}</span
                                        >
                                        {#if p.socketId}
                                            <span class="text-gray-400"
                                                >({p.socketId})</span
                                            >
                                        {/if}
                                        {#if p.isAdmin}
                                            <Badge color="yellow">admin</Badge>
                                        {/if}
                                        <span class="text-gray-400"
                                            >joined: {p.joinedAt &&
                                                new Date(
                                                    p.joinedAt,
                                                ).toLocaleString()}</span
                                        >
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                    <div>
                        <span class="font-semibold">Metadata:</span>
                        <pre
                            class="bg-gray-50 p-2 rounded text-xs mt-1">{JSON.stringify(
                                room.status?.metadata,
                                null,
                                2,
                            )}</pre>
                    </div>
                </CardContent>
            </Card>
        {/if}
        {#if room.error}
            <Alert color="destructive" class="mt-2">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{room.error}</AlertDescription>
            </Alert>
        {/if}
        <!-- Collapsible debug output for developers -->
        <details class="mt-2">
            <summary class="text-xs text-gray-500 cursor-pointer"
                >roomStore debug (JSON)</summary
            >
            <pre
                class="bg-gray-100 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(
                    room,
                    null,
                    2,
                )}</pre>
        </details>
    </div>
</PageContainer>
