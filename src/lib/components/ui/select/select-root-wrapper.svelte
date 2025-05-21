<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { createEventDispatcher } from "svelte";

	// Add the value prop to handle the warning
	export let value: any = undefined;
	
	// Forward all other props
	const dispatch = createEventDispatcher();
	
	// Handle value changes
	function handleSelectedChange(event) {
		if (value !== undefined) {
			dispatch('change', event.detail);
		}
	}
</script>

<SelectPrimitive.Root
	{...$$restProps}
	on:selectedChange={handleSelectedChange}
>
	<slot />
</SelectPrimitive.Root>
