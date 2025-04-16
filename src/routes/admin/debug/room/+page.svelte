<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { roomStore } from '$lib/stores/room-store';
    
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

    <!-- Debug Logging Output -->
    <div class="mt-4">
        <div class="text-xs text-gray-500">roomStore debug:</div>
        <pre class="bg-gray-100 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(room, null, 2)}</pre>
        {#if room.roomId}
            <div class="mt-2 p-2 bg-green-100 rounded">
                <div>Room created: <strong>{room.roomId}</strong></div>
                {#if room.status}
                    <div class="mt-2">
                        <div><span class="font-semibold">Participants:</span> {room.status.participantCount}</div>
                        <div><span class="font-semibold">Has Password:</span> {room.status.hasPassword ? 'Yes' : 'No'}</div>
                        <div><span class="font-semibold">Created At:</span> {room.status.createdAt}</div>
                        <div><span class="font-semibold">Last Activity:</span> {room.status.lastActivity}</div>
                        <div><span class="font-semibold">Admins:</span> {room.status.admins && room.status.admins.length > 0 ? room.status.admins.join(', ') : 'None'}</div>
                        <div><span class="font-semibold">Metadata:</span> <pre class="inline bg-gray-50 p-1 rounded">{JSON.stringify(room.status.metadata, null, 2)}</pre></div>
                    </div>
                {/if}
            </div>
        {/if}
        {#if room.error}
            <div class="mt-2 p-2 bg-red-100 rounded">Error: {room.error}</div>
        {/if}
    </div>
</div>
