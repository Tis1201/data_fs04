<script lang="ts">
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
	import type { ComponentType, SvelteComponent } from "svelte";
	
	// Card props
	export let title: string = "";
	export let description: string = "";
	export let icon: ComponentType<SvelteComponent> | null = null;
	export let class_name: string = "";
	export let compact: boolean = false;
</script>

<Card class="w-full {class_name}">
	<CardHeader class={compact ? "pb-2" : ""}>
		{#if title}
			<CardTitle class={`${icon ? "flex items-center" : ""} ${compact ? "text-base" : ""}`}>
				{#if icon}
					<svelte:component this={icon} class="mr-2 {compact ? 'h-4 w-4' : 'h-5 w-5'}" />
				{/if}
				{title}
			</CardTitle>
		{/if}
		
		{#if description}
			<CardDescription class={compact ? "text-xs" : ""}>
				{description}
			</CardDescription>
		{/if}
		
		<!-- Additional header content -->
		<slot name="header" />
	</CardHeader>
	
	<CardContent class={compact ? "pt-0 px-4 pb-4" : ""}>
		<!-- Card content -->
		<slot />
	</CardContent>
	
	<!-- Optional footer -->
	{#if $$slots.footer}
		<div class="px-6 py-4">
			<slot name="footer" />
		</div>
	{/if}
</Card>
