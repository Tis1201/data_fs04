<script lang="ts">
    import { cn } from "$lib/utils";

    let className: string | undefined = undefined;
    export { className as class };
</script>

<ol
    class={cn(
        "flex flex-wrap items-center gap-1.5 break-words",
        className
    )}
    {...$$restProps}
>
    <slot />
</ol>
