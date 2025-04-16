<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { roomStore } from '$lib/stores/room-store';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import {Badge} from "$lib/components/ui/badge";
    import {Alert, AlertTitle, AlertDescription} from "$lib/components/ui/alert";
    // Svelte auto-subscription
    $: room = $roomStore;
    
    function handleCreateRoom() {
        console.log("Create Room")
        roomStore.createRoom();
    }
</script>

<div class="space-y-2 p-2">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Room</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex items-center justify-between mb-2">
        <h1 class="text-xl font-semibold">Room</h1>
        <Button size="sm" on:click={handleCreateRoom}>
            <Plus class="mr-2 h-4 w-4" />
            Create Room
        </Button>
    </div>

    <!-- Enhanced Room Visualization -->
    <div class="mt-4 space-y-4">
        {#if room.error}
            <Alert color="destructive" class="mt-2">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{room.error}</AlertDescription>
                <Button size="sm" variant="ghost" on:click={() => roomStore.clearError()}>Dismiss</Button>
            </Alert>
        {/if}
        {#if room.roomId}
            <Card class="border shadow-sm">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        Room <Badge color="green">{room.roomId}</Badge>
                    </CardTitle>
                    <CardDescription>Created At: {room.status?.createdAt}</CardDescription>
                    {#if room.status?.createdBy}
                        <div class="text-xs text-gray-500 mt-1">Created By: <Badge color="purple">{room.status.createdBy}</Badge></div>
                    {/if}
                </CardHeader>
                <CardContent class="space-y-2">
                    <div class="flex flex-wrap gap-4">
                        <div>
                            <span class="font-semibold">Participants:</span>
                            <Badge color="blue">{room.status?.participantCount ?? 0}</Badge>
                        </div>
                        <div>
                            <span class="font-semibold">Has Password:</span>
                            <Badge color={room.status?.hasPassword ? 'yellow' : 'gray'}>{room.status?.hasPassword ? 'Yes' : 'No'}</Badge>
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
                                    <Badge color="gray">{admin}</Badge>{i < room.status.admins.length - 1 ? ', ' : ''}
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
                                        <span class="font-mono">{p.userId}</span>
                                        {#if p.socketId}
                                            <span class="text-gray-400">({p.socketId})</span>
                                        {/if}
                                        {#if p.isAdmin}
                                            <Badge color="yellow">admin</Badge>
                                        {/if}
                                        <span class="text-gray-400">joined: {p.joinedAt && (new Date(p.joinedAt)).toLocaleString()}</span>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                    <div>
                        <span class="font-semibold">Metadata:</span>
                        <pre class="bg-gray-50 p-2 rounded text-xs mt-1">{JSON.stringify(room.status?.metadata, null, 2)}</pre>
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
            <summary class="text-xs text-gray-500 cursor-pointer">roomStore debug (JSON)</summary>
            <pre class="bg-gray-100 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(room, null, 2)}</pre>
        </details>
    </div>
</div>
