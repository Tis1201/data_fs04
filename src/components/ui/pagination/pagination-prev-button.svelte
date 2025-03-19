<script lang="ts">
    import { ChevronLeft } from "lucide-svelte";
    import { cn } from "$lib/utils";

    let className: string | undefined = undefined;
    export { className as class };
</script>

<button
    class={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
    )}
    {...$$restProps}
>
    <ChevronLeft class="h-4 w-4" />
    <span class="sr-only">Previous page</span>
</button>
