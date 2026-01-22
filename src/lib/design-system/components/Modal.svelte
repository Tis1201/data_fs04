<script context="module" lang="ts">
	export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
	export type ModalType = 'default' | 'info' | 'warning' | 'error';
</script>

<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { X, AlertTriangle, Info, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/design-system/components';

	// ==========================================================================
	// PROPS
	// ==========================================================================

	export let open: boolean = false;
	export let title: string = '';
	export let size: ModalSize = 'md';
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
			icon: AlertCircle, 
			iconColor: '#F04438' // Error/500
		}
	};

	$: currentTypeConfig = typeConfig[type];
	$: modalWidth = sizeConfig[size];
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
				
				{#if showCloseButton}
					<!-- Close Button - dùng Button component từ design-system -->
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
						<!-- Footer Buttons - dùng Button component từ design-system -->
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

	/* Modal Container - Figma specs */
	.modal-container {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0;
		background: #FFFFFF;
		border-radius: 16px;
		box-shadow: 0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03);
		overflow: visible; /* Allow dropdowns to overflow */
	}

	/* Modal Header - Figma specs */
	.modal-header {
		box-sizing: border-box;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 16px;
		gap: 12px;
		width: 100%;
		height: 56px;
		background: #FFFFFF;
		border-radius: 16px 16px 0 0; /* Match parent top corners */
		flex: none;
		order: 0;
		align-self: stretch;
		flex-grow: 0;
	}

	.modal-header.has-border {
		border-bottom: 1px solid #E5E5E5;
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

	/* Modal Title - using Design System tokens */
	.modal-title {
		height: 24px;
		font-family: var(--ds-font-family-primary);
		font-style: normal;
		font-weight: var(--ds-font-medium);
		font-size: var(--ds-text-lg);
		line-height: var(--ds-leading-md);
		color: var(--ds-color-gray-900);
		flex: none;
		order: 1;
		flex-grow: 1;
		margin: 0;
	}

	/* Close Button Wrapper - Button component với custom positioning */
	.modal-close-btn-wrapper {
		flex: none;
		order: 2;
		flex-grow: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Modal Body - using Design System tokens */
	.modal-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: var(--ds-space-4);
		gap: var(--ds-space-4);
		width: 100%;
		box-sizing: border-box;
		background: var(--ds-color-white);
		flex: none;
		order: 1;
		align-self: stretch;
		flex-grow: 1;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-regular);
		font-size: var(--ds-text-md);
		line-height: var(--ds-leading-md);
		color: var(--ds-text-primary);
	}

	/* When modal has icon, align body text with title */
	/* Header: padding 16px + icon 24px + gap 12px = 52px */
	.modal-body.has-icon {
		padding-left: 52px;
	}

	/* Modal Footer - Figma specs */
	.modal-footer {
		box-sizing: border-box;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		align-items: center;
		padding: 16px;
		gap: 16px;
		width: 100%;
		height: 76px;
		background: #FFFFFF;
		border-top: 1px solid #E5E5E5;
		border-radius: 0 0 16px 16px; /* Match parent bottom corners */
		flex: none;
		order: 2;
		flex-grow: 0;
	}

	/* Footer Button Wrappers - Button component với custom min-width từ Figma specs */
	.modal-btn-wrapper {
		min-width: 100px;
	}

	/* Ensure modal body text inherits styles */
	.modal-body :global(p) {
		margin: 0;
	}
</style>
