<script lang="ts">
  import { ToastViewport } from "."
  import { useToast } from "./use-toast"
  import Toast from "./toast.svelte"
  import { ToastTitle } from "."
  import { ToastDescription } from "."
  import { ToastAction } from "."

  const { toasts } = useToast()
</script>

{#each $toasts as toast (toast.id)}
  <Toast {...toast}>
    {#if toast.title}
      <ToastTitle>
        {toast.title}
      </ToastTitle>
    {/if}
    {#if toast.description}
      <ToastDescription>
        {toast.description}
      </ToastDescription>
    {/if}
    {#if toast.action}
      <ToastAction>
        {toast.action}
      </ToastAction>
    {/if}
  </Toast>
{/each}

<ToastViewport />
