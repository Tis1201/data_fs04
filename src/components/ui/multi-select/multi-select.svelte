<script lang="ts">
  import { Check, X, ChevronsUpDown } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import {
    Popover,
    PopoverTrigger,
    PopoverContent,
  } from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  export let options: { value: string; label: string }[] = [];
  export let selected: string[] = [];
  export let placeholder = 'Select items...';

  let open = false;

  $: selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  function handleSelect(value: string) {
    if (selected.includes(value)) {
      selected = selected.filter((item) => item !== value);
    } else {
      selected = [...selected, value];
    }
  }

  function removeItem(value: string) {
    selected = selected.filter((item) => item !== value);
  }
</script>

<Popover bind:open>
  <PopoverTrigger asChild let:builder>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      class="w-full justify-between"
      builders={[builder]}
    >
      {#if selected.length === 0}
        <span class="text-muted-foreground">{placeholder}</span>
      {:else}
        <div class="flex gap-1 flex-wrap">
          {#each selectedLabels as label}
            <div
              class="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
            >
              <span class="text-sm">{label}</span>
              <button
                type="button"
                class="text-secondary-foreground/50 hover:text-secondary-foreground"
                on:click|stopPropagation={() =>
                  removeItem(
                    options.find((option) => option.label === label)?.value || ''
                  )}
              >
                <X class="h-3 w-3" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
      <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent class="w-full p-0">
    <Command.Root>
      <Command.Input placeholder="Search items..." />
      <Command.Empty>No item found.</Command.Empty>
      <Command.Group>
        {#each options as option}
          <Command.Item
            value={option.value}
            onSelect={() => handleSelect(option.value)}
          >
            <div class="flex items-center gap-2">
              <div
                class={cn(
                  'flex h-4 w-4 items-center justify-center rounded border',
                  selected.includes(option.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-primary opacity-50'
                )}
              >
                {#if selected.includes(option.value)}
                  <Check class="h-3 w-3" />
                {/if}
              </div>
              {option.label}
            </div>
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.Root>
  </PopoverContent>
</Popover>
