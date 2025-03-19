<script lang="ts">
	import { cn } from "$lib/utils";
	import { ChevronRight } from "lucide-svelte";

	let className: string | undefined = undefined;
	export { className as class };
</script>

<li
	class={cn("inline-flex items-center", className)}
	aria-hidden="true"
	{...$$restProps}
>
	<slot>
		<ChevronRight class="h-4 w-4" />
	</slot>
</li>
