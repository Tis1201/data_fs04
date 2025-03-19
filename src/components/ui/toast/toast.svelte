<script lang="ts">
  import { cn } from "$lib/utils"
  import { X } from "lucide-svelte"
  import { fly } from "svelte/transition"
  import { onMount } from "svelte"
  import ToastClose from "./toast-close.svelte"
  import { toastVariants } from "./toast-variants"
  import type { ToastProps } from "./types"

  let className: string | undefined = undefined
  export { className as class }
  export let variant: ToastProps["variant"] = "default"
  export let duration = 5000
  export let open = true
  export let onOpenChange: ((value: boolean) => void) | undefined = undefined

  let mounted = false
  let timeout: NodeJS.Timeout

  onMount(() => {
    mounted = true
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  })

  function handleClose() {
    if (onOpenChange) {
      onOpenChange(false)
    }
  }

  $: if (mounted && duration && open) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(handleClose, duration)
  }
</script>

<div
  class={cn(toastVariants({ variant }), className)}
  data-state={open ? "open" : "closed"}
  role="alert"
  transition:fly={{ duration: 150, y: 100 }}
>
  <div class="grid gap-1">
    <slot />
  </div>
  <ToastClose on:click={handleClose} />
</div>
