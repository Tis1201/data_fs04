<script lang="ts">
	import { cn } from "$lib/utils";

	type $$Props = svelte.JSX.IntrinsicElements["textarea"];

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<textarea
	class={cn(
		"flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{...$$restProps}
/>
