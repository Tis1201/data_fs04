<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
  
    // Props
    export let label: string; // Column label
    export let sortKey: string; // Column's unique sort key
    export let currentSortField: string; // Currently sorted field
    export let currentSortOrder: "asc" | "desc"; // Current sort order
  
    // Dispatcher
    const dispatch = createEventDispatcher();
  
    // Emit sorting event
    $: isActive = currentSortField === sortKey;

    function handleClick() {
        let order: "asc" | "desc";
        if (!isActive || currentSortOrder === "desc") {
            order = "asc";
        } else {
            order = "desc";
        }
        console.log('Sort clicked:', { field: sortKey, order });
        dispatch("sort", { field: sortKey, order });
    }
  </script>
  
  <Button
    variant="ghost"
    size="sm"
    class="h-8 flex items-center gap-1 px-2 -ml-2 hover:bg-muted"
    on:click={handleClick}
  >
    <span>{label}</span>
    {#if isActive}
        {#if currentSortOrder === "asc"}
            <ArrowUp class="h-4 w-4 text-foreground ml-2" />
        {:else}
            <ArrowDown class="h-4 w-4 text-foreground ml-2" />
        {/if}
    {:else}
        <ArrowUpDown class="h-4 w-4 text-muted-foreground ml-2" />
    {/if}
  </Button>