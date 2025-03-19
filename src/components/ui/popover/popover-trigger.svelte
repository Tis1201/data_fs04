<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let className: string | undefined = undefined;
	export { className as class };
</script>

<PopoverPrimitive.Trigger
	class={cn("inline-flex items-center justify-center", className)}
	{...$$restProps}
>
	<slot />
</PopoverPrimitive.Trigger>
