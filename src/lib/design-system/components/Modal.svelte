<script context="module" lang="ts">
	export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
	export type ModalType = 'default' | 'info' | 'warning' | 'error';
</script>

<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { X, AlertTriangle, Info, CircleAlert } from 'lucide-svelte';
	import { Button } from '$lib/design-system/components';

	// ==========================================================================
	// PROPS
	// ==========================================================================

	export let open: boolean = false;
	export let title: string = '';
	export let size: ModalSize = 'md';
	export let width: string | undefined = undefined;
	export let type: ModalType = 'default';
	export let showCloseButton: boolean = true;
	export let closeOnBackdrop: boolean = true;
	export let closeOnEscape: boolean = true;
	export let showFooter: boolean = true;
	// Backdrop/overlay styling (Figma uses blue-tinted overlay + blur)
	// Add Device Modal: rgba(0,78,235,0.03), Filter Modal: rgba(0,78,235,0.05)
	export let overlayBg: string = 'rgba(0, 78, 235, 0.03)';
	export let overlayBlurPx: number = 12;

	// Footer button props
	export let confirmText: string = 'Confirm';
	export let cancelText: string = 'Cancel';
	export let showCancel: boolean = true;
	export let showTextButton: boolean = false;
	export let textButtonText: string = '';
	export let confirmLoading: boolean = false;
	export let confirmDisabled: boolean = false;

	// ==========================================================================
	// EVENTS
	// ==========================================================================

	const dispatch = createEventDispatcher<{
		close: void;
		confirm: void;
		cancel: void;
		textButtonClick: void;
	}>();

	// ==========================================================================
	// LIFECYCLE
	// ==========================================================================

	let modalElement: HTMLDivElement;
	let previousActiveElement: Element | null = null;

	onMount(() => {
		if (open && typeof document !== 'undefined') {
			previousActiveElement = document.activeElement;
			document.body.style.overflow = 'hidden';
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	$: if (typeof document !== 'undefined') {
		if (open) {
			previousActiveElement = document.activeElement;
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
			if (previousActiveElement && previousActiveElement instanceof HTMLElement) {
				previousActiveElement.focus();
			}
		}
	}

	// ==========================================================================
	// HANDLERS
	// ==========================================================================

	function handleClose() {
		dispatch('close');
		open = false;
	}

	function handleConfirm() {
		dispatch('confirm');
	}

	function handleCancel() {
		dispatch('cancel');
		handleClose();
	}

	function handleTextButtonClick() {
		dispatch('textButtonClick');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (closeOnBackdrop && event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		// Handle keyboard events for accessibility
		if (closeOnBackdrop && event.key === 'Escape' && event.target === event.currentTarget) {
			event.preventDefault();
			handleClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (closeOnEscape && event.key === 'Escape') {
			handleClose();
		}
	}

	// ==========================================================================
	// COMPUTED STYLES
	// ==========================================================================

	// Size configurations (Figma default is 550px)
	const sizeConfig: Record<ModalSize, string> = {
		sm: '400px',
		md: '550px',
		lg: '700px',
		xl: '900px',
		full: '100%'
	};

	// Type configurations for header icons
	const typeConfig: Record<ModalType, { icon: any; iconColor: string }> = {
		default: { icon: null, iconColor: '' },
		info: { 
			icon: Info, 
			iconColor: '#155EEF' // Blue True/600
		},
		warning: { 
			icon: AlertTriangle, 
			iconColor: '#DC6803' // Warning/600
		},
		error: { 
			icon: CircleAlert, // circle-alert icon from Figma
			iconColor: '#F04438' // Error/500
		}
	};

	$: currentTypeConfig = typeConfig[type];
	$: modalWidth = width ?? sizeConfig[size];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- Backdrop - Modal backdrop is clickable to close, keyboard handler added for accessibility -->
	<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
	>
		<!-- Overlay -->
		<div
			class="modal-overlay"
			style="background: {overlayBg}; backdrop-filter: blur({overlayBlurPx}px);"
		/>
		
		<!-- Modal Container -->
		<div
			bind:this={modalElement}
			class="modal-container"
			style="width: {modalWidth}; max-width: calc(100% - 32px);"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Header -->
			<div class="modal-header" class:has-border={type === 'default'}>
				{#if currentTypeConfig.icon}
					<div class="modal-header-icon">
						<svelte:component 
							this={currentTypeConfig.icon} 
							size={24} 
							strokeWidth={2} 
							color={currentTypeConfig.iconColor} 
						/>
					</div>
				{/if}
				
				{#if title}
					<h2 id="modal-title" class="modal-title">
						{title}
					</h2>
				{/if}

				<!-- Optional header actions (e.g. CSV Template button) - between title and close -->
				{#if $$slots['header-actions']}
					<div class="modal-header-actions">
						<slot name="header-actions" />
					</div>
				{/if}
				
				{#if showCloseButton}
					<!-- Close Button - uses Button component from design-system -->
					<div class="modal-close-btn-wrapper">
						<Button
							variant="text"
							color="gray"
							size="sm"
							icon={X}
							iconPosition="only"
							iconSize={20}
							on:click={handleClose}
							aria-label="Close modal"
						/>
					</div>
				{/if}
			</div>

			<!-- Body -->
			<div class="modal-body" class:has-icon={currentTypeConfig.icon}>
				<slot />
			</div>

			<!-- Footer -->
			{#if showFooter || $$slots.footer}
				<div class="modal-footer">
					{#if $$slots.footer}
						<slot name="footer" />
					{:else}
						<!-- Footer Buttons - use Button component from design-system -->
						{#if showTextButton && textButtonText}
							<div class="modal-btn-wrapper">
								<Button
									variant="text"
									size="lg"
									color="primary"
									on:click={handleTextButtonClick}
								>
									{textButtonText}
								</Button>
							</div>
						{/if}
						{#if showCancel}
							<div class="modal-btn-wrapper">
								<Button
									variant="outline"
									size="lg"
									color="primary"
									on:click={handleCancel}
								>
									{cancelText}
								</Button>
							</div>
						{/if}
						<div class="modal-btn-wrapper">
							<Button
								variant="filled"
								size="lg"
								color="primary"
								loading={confirmLoading}
								disabled={confirmDisabled || confirmLoading}
								on:click={handleConfirm}
							>
								{confirmText}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Backdrop */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	/* Overlay */
	.modal-overlay {
		position: absolute;
		inset: 0;
		/* default overridden via inline styles */
		background: rgba(0, 78, 235, 0.03);
		backdrop-filter: blur(12px);
	}

	/* Modal Container - Figma specs (border-radius 16px, Base/White) */
	.modal-container {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0;
		background: var(--ds-color-white);
		border-radius: var(--ds-radius-2xl);
		box-shadow: var(--ds-modal-shadow);
		overflow: hidden; /* Prevent content from overflowing container */
		max-height: calc(100vh - 32px); /* Account for backdrop padding */
		max-height: calc(100dvh - 32px); /* Use dynamic viewport height for mobile */
	}

	/* Modal Header - Figma specs (56px height, 16px padding, gap 12px, Neutral True/200 border) */
	.modal-header {
		box-sizing: border-box;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: var(--ds-space-4);
		gap: var(--ds-space-3);
		width: 100%;
		min-height: 56px;
		background: var(--ds-color-white);
		border-radius: var(--ds-radius-2xl) var(--ds-radius-2xl) 0 0; /* Match parent top corners */
		flex: none;
		flex-shrink: 0; /* Prevent header from shrinking */
		order: 0;
		align-self: stretch;
		position: relative;
		z-index: 1; /* Keep header above body so expand/close are never covered */
	}

	.modal-header.has-border {
		border-bottom: 1px solid var(--ds-color-neutral-true-200);
	}

	/* Header Icon */
	.modal-header-icon {
		width: 24px;
		height: 24px;
		flex: none;
		order: 0;
		flex-grow: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Modal Title - using Design System tokens (18px/24px from Figma) */
	.modal-title {
		height: 24px;
		font-family: var(--ds-font-family-primary);
		font-style: normal;
		font-weight: var(--ds-font-medium); /* 500 from Figma */
		font-size: var(--ds-text-lg); /* 18px from Figma */
		line-height: var(--ds-leading-md); /* 24px from Figma */
		color: var(--ds-color-neutral-true-900); /* #141414 from Figma */
		flex: none;
		order: 1;
		flex-grow: 1;
		margin: 0;
	}

	/* Header actions slot (e.g. CSV Template button) - between title and close */
	.modal-header-actions {
		flex: none;
		order: 2;
		flex-grow: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-left: auto;
	}
	.modal-header-actions:empty {
		display: none;
	}

	/* Close Button Wrapper - Button component with custom positioning */
	.modal-close-btn-wrapper {
		flex: none;
		order: 3;
		flex-grow: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Modal Body - using Design System tokens (Figma: padding 16px, gap 16px) */
	.modal-body {
		display: flex;
		flex-direction: column;
		align-items: stretch; /* So slot content fills width */
		padding: var(--ds-space-4); /* 16px */
		gap: var(--ds-space-4);
		width: 100%;
		box-sizing: border-box;
		background: var(--ds-color-white);
		flex: 1 1 auto; /* Allow body to grow and shrink, but can scroll */
		order: 1;
		align-self: stretch;
		overflow-y: auto; /* Enable scrolling when content exceeds available space */
		overflow-x: visible; /* Allow dropdowns to overflow horizontally if needed */
		min-height: 0; /* Important: allows flex child to shrink below content size */
		/* Stacking context so dropdown can appear above other elements */
		position: relative;
		z-index: 0;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-regular);
		font-size: var(--ds-text-md);
		line-height: var(--ds-leading-md);
		color: var(--ds-text-primary);
	}

	/* Slot content fills body width */
	.modal-body :global(> *) {
		min-width: 0;
		width: 100%;
	}

	/* When modal has icon, align body text with title */
	/* Header: padding 16px + icon 24px + gap 12px = 52px */
	.modal-body.has-icon {
		padding-left: 52px;
	}

	/* Modal Footer - Figma specs (76px height, 16px padding, gap 16px, Neutral True/200 border) */
	.modal-footer {
		box-sizing: border-box;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap; /* Allow buttons to wrap on small screens */
		justify-content: flex-end;
		align-items: center;
		padding: var(--ds-space-4);
		gap: var(--ds-space-4);
		width: 100%;
		min-height: 76px;
		background: var(--ds-color-white);
		border-top: 1px solid var(--ds-color-neutral-true-200);
		border-radius: 0 0 var(--ds-radius-2xl) var(--ds-radius-2xl); /* Match parent bottom corners */
		flex: none;
		flex-shrink: 0; /* Prevent footer from shrinking */
		order: 2;
	}

	/* Footer Button Wrappers - Button component with custom min-width from Figma specs */
	.modal-btn-wrapper {
		min-width: 100px;
		flex-shrink: 0; /* Prevent buttons from shrinking */
	}

	/* Responsive: Stack buttons vertically on very small screens */
	@media (max-width: 480px) {
		.modal-footer {
			flex-direction: column-reverse; /* Primary action on top when stacked */
			gap: 8px;
			padding: 12px 16px;
			min-height: auto;
		}

		.modal-btn-wrapper {
			width: 100%;
			min-width: unset;
		}

		/* Make buttons full width on mobile */
		.modal-btn-wrapper :global(button) {
			width: 100%;
		}

		/* Handle custom footer slots with flex containers */
		.modal-footer :global([class*="footer-action"]),
		.modal-footer :global([class*="modal-footer-action"]) {
			flex-direction: column-reverse !important;
			width: 100%;
		}

		.modal-footer :global([class*="footer-action"]) :global(button),
		.modal-footer :global([class*="modal-footer-action"]) :global(button) {
			width: 100%;
		}
	}

	/* Ensure modal body text inherits styles */
	.modal-body :global(p) {
		margin: 0;
	}
</style>
