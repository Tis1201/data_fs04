<script lang="ts">
	import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
	import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
	import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
	import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
	import type { ComponentType, SvelteComponent } from "svelte";
	
	// Props for the layout
	export let title: string;
	export let crumbs: [string, string][] = [];
	
	// Action button props
	export let actionLabel: string = "";
	export let actionIcon: ComponentType<SvelteComponent> | null = null;
	export let actionHref: string = "";
	export let actionOnClick: (() => void) | null = null;
	
	// Button group props
	export let actionButtons: {
		label: string;
		icon?: ComponentType<SvelteComponent> | null;
		href?: string;
		onClick?: (() => void) | null;
		variant?: string;
	}[] = [];
	
	// Layout options
	export let contentSpacing: string = "space-y-6";
	export let compact: boolean = false;
	export let gridLayout: boolean = false;
	export let gridCols: string = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
	export let gridGap: string = "gap-4";
	
	// Additional props that are being used in the application
	// Using export const instead of export let for properties that are only for external reference
	export const loading: boolean = false;
	export const showCreateButton: boolean = true;
	export const breadcrumbs: any[] = [];
</script>

<PageContainer crumbs={crumbs}>
	<PageHeader title={title}>
		<div slot="action">
			{#if actionButtons.length > 0}
				<div class="flex items-center gap-2">
					{#each actionButtons as button}
						<ActionButton
							label={button.label}
							icon={button.icon || null}
							href={button.href || undefined}
							onClick={button.onClick || undefined}
							variant={button.variant || 'default'}
						/>
					{/each}
				</div>
			{:else if actionLabel && (actionHref || actionOnClick) && actionIcon}
				<ActionButton
					label={actionLabel}
					icon={actionIcon}
					href={actionHref || undefined}
					onClick={actionOnClick || undefined}
				/>
			{/if}
		</div>
		
		<!-- Additional header content -->
		<slot name="header" />
	</PageHeader>
	
	<PageContent>
	{#if gridLayout}
		<div class="grid {gridCols} {gridGap}">
			<!-- Grid content -->
			<slot />
		</div>
	{:else}
		<div class={compact ? "space-y-4" : contentSpacing}>
			<!-- Main content -->
			<slot />
		</div>
	{/if}
</PageContent>
</PageContainer>
