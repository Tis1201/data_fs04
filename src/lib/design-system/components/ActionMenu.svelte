<script context="module" lang="ts">
	export interface ActionMenuItem {
		id: string;
		label: string;
		icon?: any;
		shortcut?: string;
		destructive?: boolean;
		disabled?: boolean;
		dividerAfter?: boolean;
		checked?: boolean;
		showCheckbox?: boolean;
	}
</script>

<script lang="ts">
	import { createEventDispatcher, onMount, tick, afterUpdate } from 'svelte';
	import { MoreVertical, MoreHorizontal, ChevronDown, Check } from 'lucide-svelte';
	import { Checkbox, Button } from '$lib/design-system/components';
	
	export let items: ActionMenuItem[] = [];
	export let triggerIcon: 'dots-vertical' | 'dots-horizontal' | 'chevron-down' | 'none' = 'dots-vertical';
	export let disabled: boolean = false;
	export let align: 'left' | 'right' = 'right';
	export let size: 'sm' | 'md' = 'md';
	export let width: string = 'auto'; // 'auto' | '150px' | '170px' | '200px' etc.
	export let showTrigger: boolean = true;
	
	// For programmatic control
	export let open: boolean = false;
	
	// Support external trigger element (for custom triggers like in TopNavigation)
	export let externalTriggerRef: HTMLElement | null = null;
	
	let menuRef: HTMLDivElement;
	let triggerRef: HTMLButtonElement | HTMLElement | null = null;
	let triggerWrapperRef: HTMLDivElement;
	let menuPosition = { top: 0, left: 0 };
	
	const dispatch = createEventDispatcher<{
		select: ActionMenuItem;
		open: void;
		close: void;
	}>();
	
	async function toggle() {
		if (disabled) return;
		open = !open;
		if (open) {
			dispatch('open');
			await tick();
			calculatePosition();
		} else {
			dispatch('close');
		}
	}
	
	// Watch external triggerRef changes and calculate position
	$: if (open && externalTriggerRef && menuRef) {
		tick().then(() => calculatePosition());
	}
	
	export function close() {
		open = false;
		dispatch('close');
	}
	
	export function openMenu() {
		open = true;
		dispatch('open');
		tick().then(calculatePosition);
	}
	
	function handleSelect(item: ActionMenuItem) {
		if (item.disabled) return;
		dispatch('select', item);
		if (!item.showCheckbox) {
			close();
		}
	}
	
	function handleClickOutside(event: MouseEvent) {
		const trigger = externalTriggerRef || (triggerWrapperRef || null);
		if (menuRef && !menuRef.contains(event.target as Node) && 
			trigger && !trigger.contains(event.target as Node)) {
			close();
		}
	}
	
	function handleToggleClick(event: CustomEvent | MouseEvent) {
		// Stop propagation to prevent triggering parent click handlers
		if (event instanceof MouseEvent) {
			event.stopPropagation();
		}
		toggle();
	}
	
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}
	
	function calculatePosition() {
		// Use external trigger if provided, otherwise use internal trigger wrapper
		const trigger = externalTriggerRef || (triggerWrapperRef || null);
		if (!trigger || !menuRef) return;
		
		const triggerRect = trigger.getBoundingClientRect();
		const menuRect = menuRef.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		
		// Calculate top position
		let top = triggerRect.bottom + 4;
		if (top + menuRect.height > viewportHeight - 16) {
			// Open above if not enough space below
			top = triggerRect.top - menuRect.height - 4;
		}
		
		// Calculate left position
		let left = align === 'right' 
			? triggerRect.right - menuRect.width 
			: triggerRect.left;
		
		// Ensure menu stays within viewport
		if (left + menuRect.width > viewportWidth - 16) {
			left = viewportWidth - menuRect.width - 16;
		}
		if (left < 16) {
			left = 16;
		}
		
		menuPosition = { top, left };
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
		};
	});
	
	// Recalculate position when open state changes (only for fixed positioning)
	$: if (open && !externalTriggerRef) {
		tick().then(() => {
			if (triggerWrapperRef) calculatePosition();
		});
	}
	
	$: iconSize = size === 'sm' ? 16 : 20;
	$: menuWidth = width === 'auto' ? 'min-width: 150px;' : `width: ${width};`;
</script>

<div class="action-menu">
	<!-- Trigger Button - dùng Button component từ design-system -->
	{#if showTrigger}
		<div bind:this={triggerWrapperRef} class="action-menu-trigger-wrapper">
			<Button
				variant="ghost"
				size={size}
				iconPosition="only"
				disabled={disabled}
				on:click={handleToggleClick}
				aria-haspopup="menu"
				aria-expanded={open}
			>
				{#if triggerIcon === 'dots-vertical'}
					<MoreVertical size={iconSize} strokeWidth={2} />
				{:else if triggerIcon === 'dots-horizontal'}
					<MoreHorizontal size={iconSize} strokeWidth={2} />
				{:else if triggerIcon === 'chevron-down'}
					<span class="chevron" class:open>
						<ChevronDown size={iconSize} strokeWidth={2} />
					</span>
				{:else}
					<slot name="trigger" />
				{/if}
			</Button>
		</div>
	{/if}
	
	<!-- Dropdown Menu -->
	{#if open}
		<div
			bind:this={menuRef}
			class="menu"
			class:external-trigger={!!externalTriggerRef}
			style="{menuWidth} {externalTriggerRef ? '' : `top: ${menuPosition.top}px; left: ${menuPosition.left}px;`}"
			role="menu"
			tabindex="-1"
		>
			{#each items as item}
				<button
					type="button"
					class="menu-item"
					class:destructive={item.destructive}
					class:disabled={item.disabled}
					disabled={item.disabled}
					role="menuitem"
					on:click={() => handleSelect(item)}
				>
					<!-- Checkbox (optional) -->
					{#if item.showCheckbox}
						<div class="menu-item-checkbox">
							<Checkbox 
								checked={item.checked} 
								size="sm"
								on:change={() => handleSelect(item)}
							/>
						</div>
					{/if}
					
					<!-- Icon (optional) -->
					{#if item.icon && !item.showCheckbox}
						<div class="menu-item-icon" class:destructive={item.destructive}>
							<svelte:component 
								this={item.icon} 
								size={20} 
								strokeWidth={1.67} 
							/>
						</div>
					{/if}
					
					<!-- Content -->
					<div class="menu-item-content">
						<span class="menu-item-label" class:destructive={item.destructive}>
							{item.label}
						</span>
						{#if item.shortcut}
							<span class="menu-item-shortcut">{item.shortcut}</span>
						{/if}
					</div>
					
					<!-- Check mark (for selected items without checkbox) -->
					{#if item.checked && !item.showCheckbox}
						<div class="menu-item-check">
							<Check size={20} strokeWidth={2} />
						</div>
					{/if}
				</button>
				
				{#if item.dividerAfter}
					<div class="menu-divider" />
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.action-menu {
		position: relative;
		display: inline-block;
		font-family: var(--ds-font-family-primary);
	}
	
	/* Trigger Button Wrapper - Button component với custom wrapper */
	.action-menu-trigger-wrapper {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	
	.chevron {
		display: flex;
		transition: transform 0.2s ease;
	}
	
	.chevron.open {
		transform: rotate(180deg);
	}
	
	/* Menu Container */
	.menu {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: var(--ds-spacing-1) 0;
		background: var(--ds-bg-primary);
		border: 1px solid var(--ds-border-default);
		border-radius: var(--ds-radius-lg);
		box-shadow: var(--ds-shadow-lg);
	}
	
	/* When used with external trigger, use relative positioning */
	.menu.external-trigger {
		position: relative;
		top: auto;
		left: auto;
	}
	
	/* Menu Item */
	.menu-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--ds-space-3);
		width: 100%;
		padding: var(--ds-space-2) var(--ds-space-4);
		min-height: 54px;
		/* Default: transparent background */
		background: transparent;
		border: none;
		border-radius: var(--ds-radius-md);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s ease;
	}
	
	/* Hover: #FAFAFA (Neutral - True/50) */
	.menu-item:hover:not(.disabled) {
		background: var(--ds-color-neutral-true-50);
	}
	
	/* Disabled: transparent background */
	.menu-item.disabled {
		background: transparent;
		cursor: not-allowed;
	}
	
	/* Menu Item Checkbox */
	.menu-item-checkbox {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	
	/* Menu Item Icon */
	.menu-item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		/* Default/Hover: #292929 (Neutral - True/800) */
		color: var(--ds-color-neutral-true-800);
	}
	
	/* Disabled: #D6D6D6 (Neutral - True/300) */
	.menu-item.disabled .menu-item-icon {
		color: var(--ds-color-neutral-true-300);
	}
	
	.menu-item-icon.destructive {
		color: var(--ds-color-error-600);
	}
	
	/* Menu Item Content */
	.menu-item-content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	
	.menu-item-label {
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-regular);
		font-size: var(--ds-text-sm);
		line-height: var(--ds-leading-sm);
		/* Default: #292929 (Neutral - True/800) */
		color: var(--ds-color-neutral-true-800);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	/* Hover: #141414 (Neutral - True/900) */
	.menu-item:hover:not(.disabled) .menu-item-label {
		color: var(--ds-color-neutral-true-900);
	}
	
	/* Disabled: #D6D6D6 (Neutral - True/300) */
	.menu-item.disabled .menu-item-label {
		color: var(--ds-color-neutral-true-300);
	}
	
	.menu-item-label.destructive {
		color: var(--ds-color-error-600);
	}
	
	.menu-item-shortcut {
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-regular);
		font-size: var(--ds-text-xs);
		line-height: var(--ds-leading-xs);
		letter-spacing: 0.01em;
		/* Default/Hover: #667085 (Gray/500) */
		color: var(--ds-color-gray-500);
	}
	
	/* Disabled: #D0D5DD (Gray/300) */
	.menu-item.disabled .menu-item-shortcut {
		color: var(--ds-color-gray-300);
	}
	
	/* Menu Item Check */
	.menu-item-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--ds-color-primary-600);
	}
	
	/* Divider */
	.menu-divider {
		width: 100%;
		height: 1px;
		margin: var(--ds-spacing-1) 0;
		background: var(--ds-border-default);
	}
</style>
