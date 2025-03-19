<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	type $$Props = HTMLAttributes<HTMLElement>;

	let className: string | undefined = undefined;
	export { className as class };
</script>

<nav
	class={cn(
		"flex",
		"flex-wrap items-center text-sm text-muted-foreground",
		className
	)}
	aria-label="breadcrumb"
	{...$$restProps}
>
	<ol class="flex items-center space-x-2">
		<slot />
	</ol>
</nav>
