<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import * as AlertDialog from "./index.js";
	import { cn, flyAndScale } from "$lib/utils/ui-utils.js";

	type $$Props = AlertDialogPrimitive.ContentProps;

	export let transition: $$Props["transition"] = flyAndScale;
	export let transitionConfig: $$Props["transitionConfig"] = undefined;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<AlertDialog.Portal>
	<AlertDialog.Overlay />
	<AlertDialogPrimitive.Content
		{transition}
		{transitionConfig}
		class={cn(
			"bg-background fixed left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] gap-4 border shadow-lg sm:rounded-lg md:w-full",
			// RESPONSIVE POSITIONING , HEIGHT CONSTRAINTS , PADDING , CUSTOM SCOLLBAR
			"top-[5vh] sm:top-[50%] translate-y-0 sm:translate-y-[-50%] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
			className
		)}
		{...$$restProps}
	>
		<slot />
	</AlertDialogPrimitive.Content>
</AlertDialog.Portal>
