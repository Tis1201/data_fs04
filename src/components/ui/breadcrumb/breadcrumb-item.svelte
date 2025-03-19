<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	interface $$Props extends HTMLAnchorAttributes {
		href?: string;
		current?: boolean;
	}

	let className: string | undefined = undefined;
	export { className as class };
	export let current = false;
	export let href: string | undefined = undefined;
</script>

{#if href}
	<a
		{href}
		class={cn(
			"transition-colors hover:text-foreground",
			current && "font-medium text-foreground",
			className
		)}
		aria-current={current ? "page" : undefined}
		{...$$restProps}
	>
		<slot />
	</a>
{:else}
	<li
		class={cn(
			"inline-flex items-center gap-1.5 text-sm font-medium",
			current && "font-medium text-foreground",
			className
		)}
		aria-current={current ? "page" : undefined}
		{...$$restProps}
	>
		<slot />
	</li>
{/if}
