<script lang="ts">
    import {
        DropdownMenu,
        DropdownMenuTrigger,
        DropdownMenuContent,
        DropdownMenuItem,
    } from "$lib/components/ui/dropdown-menu";
    import { Button } from "$lib/components/ui/button";
    import { MoreVertical } from "lucide-svelte";

    export let items: {
        label: string;
        icon?: any; // Optional icon component
        onClick: () => void; // Action handler
        className?: string; // Optional class for styling
    }[] = []; // Array of dropdown items
</script>

<DropdownMenu>
    <div class="relative">
        <DropdownMenuTrigger asChild let:builder>
            <Button variant="ghost" size="icon" builders={[builder]}>
                <MoreVertical class="h-4 w-4" />
                <span class="sr-only">Open menu</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            {#each items as item}
                <DropdownMenuItem
                    on:click={item.onClick}
                    class={`flex items-center px-4 py-2 hover:bg-gray-100 hover:text-primary transition-all ${
                        item.className ?? ""
                    }`}
                >
                    {#if item.icon}
                        <svelte:component
                            this={item.icon}
                            class="mr-2 h-4 w-4"
                        />
                    {/if}
                    <span>{item.label}</span>
                </DropdownMenuItem>
            {/each}
        </DropdownMenuContent>
    </div>
</DropdownMenu>
