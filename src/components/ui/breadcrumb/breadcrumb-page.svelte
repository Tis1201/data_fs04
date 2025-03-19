<script lang="ts">
    import { cn } from "$lib/utils";

    let className: string | undefined = undefined;
    export { className as class };
</script>

<span
    class={cn("font-normal text-foreground", className)}
    aria-current="page"
    {...$$restProps}
>
    <slot />
</span>
