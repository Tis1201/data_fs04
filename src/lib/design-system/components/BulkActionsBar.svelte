<script context="module" lang="ts">
	export interface BulkAction {
		id: string;
		label: string;
		icon?: any;
		destructive?: boolean;
		disabled?: boolean;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Checkbox from './Checkbox.svelte';
	import { Button } from '$lib/design-system/components';
	
	export let selectedCount: number = 0;
	export let totalCount: number = 0;
	export let actions: BulkAction[] = [];
	export let visible: boolean = true;
	
	const dispatch = createEventDispatcher<{
		action: BulkAction;
		selectAll: void;
		clearSelection: void;
	}>();
	
	function handleAction(action: BulkAction) {
		if (action.disabled) return;
		dispatch('action', action);
	}
	
	function handleSelectAll() {
		if (selectedCount === totalCount) {
			dispatch('clearSelection');
		} else {
			dispatch('selectAll');
		}
	}
	
	$: allSelected = totalCount > 0 && selectedCount === totalCount;
	$: someSelected = selectedCount > 0 && selectedCount < totalCount;
</script>

{#if visible && selectedCount > 0}
	<div class="bulk-actions-bar">
		<!-- Selection Checkbox and Count -->
		<div class="selection-info">
			<Checkbox
				checked={allSelected}
				indeterminate={someSelected}
				size="md"
				on:change={handleSelectAll}
			/>
			<span class="selection-count">
				{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
			</span>
		</div>
		
		<!-- Divider -->
		<div class="divider" />
		
		<!-- Action Buttons - dùng Button component từ design-system -->
		<div class="actions">
			{#each actions as action}
				<Button
					variant="text"
					size="md"
					color={action.destructive ? 'danger' : 'primary'}
					disabled={action.disabled}
					on:click={() => handleAction(action)}
					icon={action.icon}
					iconPosition="left"
					iconSize={20}
				>
					{action.label}
				</Button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.bulk-actions-bar {
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 12px 16px;
		gap: 16px;
		background: var(--ds-color-white);
		border: 1px solid var(--ds-border-default);
		border-radius: var(--ds-radius-xl);
		box-shadow: var(--ds-shadow-lg);
		font-family: var(--ds-font-family-primary);
		flex-wrap: wrap;
		max-width: 100%;
	}
	
	.selection-info {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}
	
	.selection-count {
		font-weight: 500;
		font-size: 14px;
		line-height: 20px;
		color: #344054;
		white-space: nowrap;
	}
	
	.divider {
		width: 1px;
		height: 20px;
		background: #EAECF0;
		flex-shrink: 0;
	}
	
	.actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--ds-space-2); /* 8px */
		flex-wrap: wrap;
	}
	
	/* Responsive: smaller screens */
	@media (max-width: 768px) {
		.bulk-actions-bar {
			padding: 10px 12px;
			gap: 12px;
		}
		
		/* Button component sẽ tự handle responsive sizing */
		
		.selection-count {
			font-size: 13px;
		}
	}
	
	/* Very small screens: stack vertically */
	@media (max-width: 480px) {
		.bulk-actions-bar {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}
		
		.divider {
			width: 100%;
			height: 1px;
		}
		
		.actions {
			justify-content: center;
		}
		
		.selection-info {
			justify-content: center;
		}
	}
</style>
