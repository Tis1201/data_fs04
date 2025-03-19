<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
	import { Check } from "lucide-svelte";
	import { cn } from "$lib/utils.js";

	type $$Props = RadioGroupPrimitive.ItemProps & {
		value: string;
	};
	type $$Events = RadioGroupPrimitive.ItemEvents;

	let className: $$Props["class"] = undefined;
	export let value: $$Props["value"];
	export { className as class };
</script>

<RadioGroupPrimitive.Item
	class={cn(
		"aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{value}
	{...$$restProps}>
	<RadioGroupPrimitive.ItemIndicator class="flex items-center justify-center">
		<Check class="h-3 w-3" />
	</RadioGroupPrimitive.ItemIndicator>
</RadioGroupPrimitive.Item>
