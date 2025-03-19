<script lang="ts">
  import { cn } from "$lib/utils"

  let className: string | undefined = undefined
  export { className as class }
</script>

<div
  class={cn(
    "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
    className
  )}
>
  <slot />
</div>
