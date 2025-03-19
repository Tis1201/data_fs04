<!-- TabsContent.svelte -->
<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import { fade } from "svelte/transition";

	type $$Props = TabsPrimitive.ContentProps;

	export let value: $$Props["value"];
	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<TabsPrimitive.Content
	{value}
	class={cn(
		"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		className
	)}
	{...$$restProps}
>
	<div transition:fade={{ duration: 150 }}>
		<slot />
	</div>
</TabsPrimitive.Content>
