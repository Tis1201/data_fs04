<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
  
    // Props
    export let label: string; // Column label
    export let sortKey: string; // Column's unique sort key
    export let currentSortField: string; // Currently sorted field
    export let currentSortOrder: "asc" | "desc" | undefined; // Current sort order (undefined if not sorted)
  
    // Dispatcher
    const dispatch = createEventDispatcher();
  
    // Emit sorting event
    function emitSort() {
      const newOrder =
        currentSortField === sortKey && currentSortOrder === "asc"
          ? "desc"
          : "asc"; // Toggle sort order
      dispatch("sort", { field: sortKey, order: newOrder });
    }
  </script>
  
  <div
    class="sortable-header flex items-center gap-2 cursor-pointer select-none"
    on:click={emitSort}
  >
    {#if currentSortField === sortKey}
      {#if currentSortOrder === "desc"}
        <ArrowUp class="h-4 w-4 text-primary" />
      {:else if currentSortOrder === "asc"}
        <ArrowDown class="h-4 w-4 text-primary" />
      {/if}
    {:else}
      <ArrowUpDown class="h-4 w-4" />
    {/if}
    <span>{label}</span>
  </div>
  
  <style>
    .sortable-header {
      user-select: none;
    }
    .sortable-header:hover {
      color: var(--hover-color, #007bff); /* Example hover color */
    }
  </style>
  