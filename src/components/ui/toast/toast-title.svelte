<script lang="ts">
  import { cn } from "$lib/utils"
  import type { HTMLAttributes } from "svelte/elements"

  type $$Props = HTMLAttributes<HTMLDivElement>

  let className: string | undefined = undefined
  export { className as class }
</script>

<div
  class={cn("text-sm font-semibold", className)}
  {...$$restProps}
>
  <slot />
</div>
