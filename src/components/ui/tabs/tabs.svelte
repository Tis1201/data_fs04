<!-- Tabs.svelte -->
<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	type $$Props = TabsPrimitive.Props;

	export let value: $$Props["value"] = undefined;
	export let defaultValue: $$Props["defaultValue"] = undefined;
	export let onValueChange: $$Props["onValueChange"] = undefined;
	export let activationMode: $$Props["activationMode"] = undefined;
	export let orientation: $$Props["orientation"] = undefined;
	export let dir: $$Props["dir"] = undefined;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<TabsPrimitive.Root
	{value}
	{defaultValue}
	{onValueChange}
	{activationMode}
	{orientation}
	{dir}
	class={cn("", className)}
	{...$$restProps}
>
	<slot />
</TabsPrimitive.Root>
