<script lang="ts">
    import { debounce } from "lodash-es";
    import { goto } from "$app/navigation";
    import { onDestroy } from "svelte";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { X, Search } from "lucide-svelte";
  
    export let placeholder: string = "Search...";
    export let value: string = ""; // String value instead of Writable store
    export let paramKey: string = "search"; // URL query parameter key
    export let resetPage: boolean = true; // Reset "page" parameter to 1 when filtering
    export let className: string = "";

    let inputValue = value;
  
    // Debounced function to update the URL
    const debouncedUpdate = debounce((query: string) => {
      const url = new URL(window.location.href);
  
      // Update URL query parameters
      url.searchParams.set(paramKey, query || "");
      if (resetPage) {
        url.searchParams.set("page", "1");
      }
      goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
  
      console.log(`${paramKey} updated to:`, query);
    }, 300);
  
    // Clear search input
    function clearSearch() {
      inputValue = ""; // Reset the input
      debouncedUpdate(""); // Trigger a debounced update with an empty query
    }
  
    // Cleanup the debounce timer on destroy
    onDestroy(() => {
      debouncedUpdate.cancel();
    });

    // Handle input changes
    function handleInput(event: Event) {
      const target = event.target as HTMLInputElement;
      inputValue = target.value;
      debouncedUpdate(inputValue);
    }
  </script>
  
  <div class="relative {className}">
    <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  
    <Input
      type="text"
      {placeholder}
      value={inputValue}
      on:input={handleInput}
      class="pl-8 pr-8"
    />
  
    {#if inputValue}
      <Button
        variant="ghost"
        size="icon"
        class="absolute right-1 top-1 h-8 w-8 p-0"
        on:click={clearSearch}
      >
        <X class="h-4 w-4" />
      </Button>
    {/if}
  </div>