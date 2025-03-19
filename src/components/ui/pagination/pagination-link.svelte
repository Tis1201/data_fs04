<script lang="ts">
    import { cn } from "$lib/utils";

    let className: string | undefined = undefined;
    export { className as class };
    export let isActive = false;
</script>

<button
    class={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-accent text-accent-foreground",
        className
    )}
    {...$$restProps}
>
    <slot />
</button>
