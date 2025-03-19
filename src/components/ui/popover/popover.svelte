<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	export let open = false;
</script>

<PopoverPrimitive.Root bind:open {...$$restProps}>
	<slot />
</PopoverPrimitive.Root>
