<script lang="ts">
    import { cn } from "$lib/utils";

    let className: string | undefined = undefined;
    export { className as class };
</script>

<div
    class={cn(
        "flex h-9 w-9 items-center justify-center",
        className
    )}
>
    <slot />
</div>
