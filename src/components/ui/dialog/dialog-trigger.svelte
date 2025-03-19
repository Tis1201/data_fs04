<script lang="ts">
    import { Dialog as DialogPrimitive } from "bits-ui";
    import { cn } from "$lib/utils";

    type $$Props = DialogPrimitive.TriggerProps;
    let className: $$Props["class"] = undefined;
    export { className as class };
</script>

<DialogPrimitive.Trigger
    class={cn(className)}
    {...$$restProps}
>
    <slot />
</DialogPrimitive.Trigger>
