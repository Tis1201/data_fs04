<script lang="ts">
  import { cn } from "$lib/utils"
  import type { HTMLButtonAttributes } from "svelte/elements"

  type $$Props = HTMLButtonAttributes

  let className: string | undefined = undefined
  export { className as class }

  export type ToastActionElement = HTMLButtonElement
</script>

<button
  class={cn(
    "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
    className
  )}
  on:click
  on:keydown
  {...$$restProps}
>
  <slot />
</button>
