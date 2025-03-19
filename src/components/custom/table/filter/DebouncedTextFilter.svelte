<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { debounce } from "lodash-es";
    import { goto } from "$app/navigation";
    import { onDestroy } from "svelte";
    import { Input } from "$lib/components/ui/input";
    import { X, Search } from "lucide-svelte";
  
    export let placeholder: string = "Search...";
    export let value: Writable<string>; // Writable store for the filter value
    export let debounceTime: number = 300; // Debounce delay in milliseconds
    export let paramKey: string = "search"; // URL query parameter key
    export let resetPage: boolean = true; // Reset "page" parameter to 1 when filtering
  
    // Debounced function to update the URL and store
    const debouncedUpdate = debounce((query: string) => {
      const url = new URL(window.location.href);
  
      // Update URL query parameters
      url.searchParams.set(paramKey, query || "");
      if (resetPage) {
        url.searchParams.set("page", "1");
      }
      goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
  
      // Update the writable store
      value.set(query);
  
      console.log(`${paramKey} updated to:`, query);
    }, debounceTime);
  
    // Clear search input
    function clearSearch() {
      value.set(""); // Reset the store
      debouncedUpdate(""); // Trigger a debounced update with an empty query
    }
  
    // Cleanup the debounce timer on destroy
    onDestroy(() => {
      debouncedUpdate.cancel();
    });
  </script>
  
  <div class="relative flex-1 max-w-sm">
    <!-- Search Icon -->
    <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  
    <!-- Search Input -->
    <Input
      type="text"
      placeholder={placeholder}
      class="pl-8"
      bind:value={$value}
      on:input={(e) => debouncedUpdate(e.currentTarget.value)}
    />
  
    <!-- Clear Button -->
    {#if $value}
      <button
        class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
        on:click={clearSearch}
      >
        <X class="h-4 w-4" />
      </button>
    {/if}
  </div>
  