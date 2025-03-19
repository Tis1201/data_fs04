<script lang="ts">
    import { cn } from "$lib/utils";
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
    import { ChevronDown, ChevronRight } from "lucide-svelte";
    export let item: MenuItem;
    export let isActive: (href: string) => boolean;
    export let expandedItems: Set<string>;
    export let toggleExpand: (label: string) => void;
</script>

{#if item.subItems}
    <!-- Menu item with sub-items -->
    <Collapsible open={expandedItems.has(item.label)}>
        <CollapsibleTrigger
            class={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                expandedItems.has(item.label) && "bg-accent/50",
            )}
            on:click={() => toggleExpand(item.label)}
        >
            <div class="flex items-center gap-3">
                <svelte:component this={item.icon} class="h-4 w-4" />
                {item.label}
            </div>
            {#if expandedItems.has(item.label)}
                <ChevronDown class="h-4 w-4" />
            {:else}
                <ChevronRight class="h-4 w-4" />
            {/if}
        </CollapsibleTrigger>
        <CollapsibleContent>
            <div class="mt-1 space-y-1 pl-6">
                {#each item.subItems as subItem}
                    <a
                        href={subItem.href}
                        class={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                            isActive(subItem.href) && "bg-accent text-accent-foreground",
                        )}
                    >
                        {#if subItem.icon}
                            <svelte:component this={subItem.icon} class="h-4 w-4" />
                        {/if}
                        {subItem.label}
                    </a>
                {/each}
            </div>
        </CollapsibleContent>
    </Collapsible>
{:else}
    <!-- Regular menu item -->
    <a
        href={item.href}
        class={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
            isActive(item.href || "") && "bg-accent text-accent-foreground",
        )}
    >
        <svelte:component this={item.icon} class="h-4 w-4" />
        {item.label}
    </a>
{/if}
