<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { Check } from "lucide-svelte";
	import { cn } from "$lib/utils.js";

	type $$Props = SelectPrimitive.ItemProps & {
		label?: string;
	};

	let className: $$Props["class"] = undefined;
	export let value: $$Props["value"];
	export let label: string | undefined = undefined;
	export { className as class };
</script>

<SelectPrimitive.Item
	class={cn(
		"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
		className
	)}
	{value}
	{...$$restProps}>
	<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
		<SelectPrimitive.ItemIndicator>
			<Check class="h-4 w-4" />
		</SelectPrimitive.ItemIndicator>
	</span>
	<slot>
		{#if label}
			{label}
		{/if}
	</slot>
</SelectPrimitive.Item>
