<script lang="ts">
    import { Dialog as DialogPrimitive } from "bits-ui";
    import { cn } from "$lib/utils";
    import { fade } from "svelte/transition";

    type $$Props = DialogPrimitive.Props;

    export let open = false;
</script>

<DialogPrimitive.Root bind:open {...$$restProps}>
    {#if open}
        <div
            class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            transition:fade={{ duration: 150 }}
            data-state={open ? "open" : "closed"}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
            <slot />
        </div>
    {/if}
</DialogPrimitive.Root>
