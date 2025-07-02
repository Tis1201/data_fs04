<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from "bits-ui";
	import { cn } from "$lib/utils/ui-utils";
	import { Check } from "lucide-svelte";

	type $$Props = CheckboxPrimitive.Props;
	type $$Events = CheckboxPrimitive.Events;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<CheckboxPrimitive.Root
	class={cn(
		"peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
		className
	)}
	{...$$restProps}
	on:click
	on:keydown
>
	<CheckboxPrimitive.Indicator
		class={cn("flex items-center justify-center text-current")}
	>
		<Check class="h-4 w-4" />
	</CheckboxPrimitive.Indicator>
</CheckboxPrimitive.Root>
