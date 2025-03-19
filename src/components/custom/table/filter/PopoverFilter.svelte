<script lang="ts">
    import { writable } from 'svelte/store';
    import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { goto } from "$app/navigation";
  
    export let label: string;
    export let options: { label: string; value: string }[];
    export let selectedValues: string[] = [];
    export let onChange: ((values: string[]) => void) | undefined = undefined; // Made optional with a default value
    export let key: string | null = null; // Optional key for auto URL updates
  
    // Internal state for selected values
    const selected = writable<string[]>(selectedValues);
  
    // Helper function to build a URL
    function buildUrl(params: Record<string, string | null>) {
      const url = new URL(window.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value === null) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      });
      return url.toString();
    }
  
    // Emit updated values or handle URL updates
    function handleUpdate(value: string, checked: boolean) {
      selected.update((current) => {
        const updated = checked
          ? [...current, value]
          : current.filter((v) => v !== value);
  
        if (key) {
          // If `key` is provided, automatically update the URL
          const newUrl = buildUrl({ [key]: updated.length ? updated.join(',') : null, page: '1' });
          goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
        } else {
          // If no `key`, invoke the `onChange` callback
          onChange?.(updated);
        }
  
        return updated;
      });
    }
  </script>
  
  <Popover>
    <PopoverTrigger asChild let:builder>
      <Button
        variant="outline"
        class="flex items-center space-x-2 relative"
        builders={[builder]}
      >
        {label}
        {#if $selected.length > 0}
          <div class="absolute -top-2 -right-2 rounded-full bg-primary min-w-[1.25rem] h-5 flex items-center justify-center text-xs text-primary-foreground">
            {$selected.length}
          </div>
        {/if}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px] p-3">
      <div class="space-y-2">
        {#each options as option}
          <div class="flex items-center space-x-2">
            <Checkbox
              checked={$selected.includes(option.value)}
              onCheckedChange={(checked) => handleUpdate(option.value, checked)}
            />
            <label class="text-sm">{option.label}</label>
          </div>
        {/each}
      </div>
    </PopoverContent>
  </Popover>
  