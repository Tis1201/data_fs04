<script lang="ts">
  import { cn } from "$lib/utils"
  import type { HTMLButtonAttributes } from "svelte/elements"
  import { X } from "lucide-svelte"

  type $$Props = HTMLButtonAttributes

  let className: string | undefined = undefined
  export { className as class }
</script>

<button
  class={cn(
    "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
    className
  )}
  on:click
  on:keydown
  {...$$restProps}
>
  <X class="h-4 w-4" />
  <span class="sr-only">Close</span>
</button>
