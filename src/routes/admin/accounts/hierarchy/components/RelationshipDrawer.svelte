<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly } from 'svelte/transition';
    import { X } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import RelationshipDetailsPanel from './RelationshipDetailsPanel.svelte';

    export let open = false;
    export let assignment: any = null;
    export let loading = false;

    const dispatch = createEventDispatcher();

    function close() {
        open = false;
        dispatch('close');
    }

    function handleEdit(event: CustomEvent) {
        dispatch('edit', event.detail);
    }

    function handleDelete(event: CustomEvent) {
        dispatch('delete', event.detail);
    }

    function handleSuspend(event: CustomEvent) {
        dispatch('suspend', event.detail);
    }

    function handleActivate(event: CustomEvent) {
        dispatch('activate', event.detail);
    }
</script>

<!-- Custom Drawer - No overlay, slides in from right -->
{#if open}
    <div 
        class="fixed top-0 right-0 h-screen w-full sm:w-[480px] bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col"
        transition:fly={{ x: 480, duration: 250, opacity: 1 }}
    >
        <!-- Header - Fixed -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
            <h2 class="text-lg font-semibold text-gray-900">Relationship Details</h2>
            <Button 
                variant="ghost" 
                size="icon"
                class="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors"
                on:click={close}
            >
                <X class="h-4 w-4" />
                <span class="sr-only">Close</span>
            </Button>
        </div>

        <!-- Scrollable Content Area -->
        <div class="flex-1 overflow-y-auto overscroll-contain">
            <div class="p-6">
                <RelationshipDetailsPanel 
                    {assignment}
                    {loading}
                    on:edit={handleEdit}
                    on:delete={handleDelete}
                    on:suspend={handleSuspend}
                    on:activate={handleActivate}
                />
            </div>
        </div>
    </div>
{/if}
