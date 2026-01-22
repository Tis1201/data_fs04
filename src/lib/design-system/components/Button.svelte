<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// ============================================================================
	// BUTTON COMPONENT - Design System
	// Based on Figma specifications (exact colors, shadows, borders)
	// ============================================================================

	type ButtonVariant = 'filled' | 'outline' | 'text' | 'ghost';
	type ButtonColor = 'primary' | 'gray' | 'danger';
	type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	type VisualState = 'default' | 'hover' | 'focus';
	type IconPosition = 'left' | 'right' | 'only';

	interface $$Props extends HTMLButtonAttributes {
		variant?: ButtonVariant;
		color?: ButtonColor;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		iconLeft?: boolean; // @deprecated - Use icon and iconPosition instead
		iconRight?: boolean; // @deprecated - Use icon and iconPosition instead
		iconOnly?: boolean; // @deprecated - Use icon and iconPosition="only" instead
		icon?: any; // Lucide icon component (e.g., Trash, Edit, etc.)
		iconPosition?: IconPosition; // 'left' | 'right' | 'only' - defaults to 'left' if icon is provided
		iconSize?: number; // Custom icon size (defaults based on button size)
		iconColor?: string; // Custom icon color (defaults to currentColor)
		visualState?: VisualState; // For showcase: force visual state without interaction
	}

	export let variant: ButtonVariant = 'filled';
	export let color: ButtonColor = 'primary';
	export let size: ButtonSize = 'md';
	export let disabled: boolean = false;
	export let loading: boolean = false;
	export let fullWidth: boolean = false;
	export let iconLeft: boolean = false; // @deprecated
	export let iconRight: boolean = false; // @deprecated
	export let iconOnly: boolean = false; // @deprecated
	export let icon: any = undefined; // Lucide icon component
	export let iconPosition: IconPosition | undefined = undefined;
	export let iconSize: number | undefined = undefined;
	export let iconColor: string | undefined = undefined;
	export let visualState: VisualState = 'default'; // default, hover, focus

	const dispatch = createEventDispatcher();

	// Size specifications from Figma (height, padding, gap)
	// Typography varies by size:
	// sm, md: 14px/20px | lg, xl: 16px/24px | 2xl: 18px/24px
	const sizeClasses: Record<ButtonSize, string> = {
		sm: 'btn-size-sm h-9 px-3.5 py-2 gap-2',      // 36px, padding 8px/14px, font 14px/20px
		md: 'btn-size-md h-10 px-4 py-2.5 gap-2',     // 40px, padding 10px/16px, font 14px/20px
		lg: 'btn-size-lg h-11 px-[18px] py-2.5 gap-2', // 44px, padding 10px/18px, font 16px/24px
		xl: 'btn-size-xl h-12 px-5 py-3 gap-2',       // 48px, padding 12px/20px, font 16px/24px
		'2xl': 'btn-size-2xl h-14 px-7 py-4 gap-3'    // 56px, padding 16px/28px, font 18px/24px
	};

	// Icon-only button sizes from Figma (square buttons)
	// sm: 36x36 p-8 | md: 40x40 p-10 | lg: 44x44 p-12 | xl: 48x48 p-14 | 2xl: 56x56 p-16
	const iconOnlySizeClasses: Record<ButtonSize, string> = {
		sm: 'btn-size-sm w-9 h-9 p-2',        // 36x36px, padding 8px
		md: 'btn-size-md w-10 h-10 p-2.5',    // 40x40px, padding 10px
		lg: 'btn-size-lg w-11 h-11 p-3',      // 44x44px, padding 12px
		xl: 'btn-size-xl w-12 h-12 p-3.5',    // 48x48px, padding 14px
		'2xl': 'btn-size-2xl w-14 h-14 p-4'   // 56x56px, padding 16px
	};

	// Base classes for all buttons
	const baseClasses = `
		inline-flex items-center justify-center
		font-medium
		rounded-lg
		transition-all duration-200 ease-out
		outline-none
		select-none
		border
	`;

	// Compute final classes
	$: classes = [
		baseClasses,
		showIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
		showIconOnly ? '' : 'min-w-[100px]',
		fullWidth ? 'w-full' : '',
		loading ? 'relative' : ''
	].join(' ');

	// Compute variant-specific styles (inline for exact Figma match)
	$: variantStyles = getVariantStyles(variant, color, disabled, visualState);

	function getVariantStyles(v: ButtonVariant, c: ButtonColor, isDisabled: boolean, state: VisualState): string {
		// Shadow/xs from Figma: 0 1px 2px rgba(16, 24, 40, 0.05)
		const shadowXs = '0 1px 2px rgba(16, 24, 40, 0.05)';
		// Focus ring from Figma: 4px spread gray-100 (#F2F4F7)
		const focusRingGray = '0 0 0 4px #F2F4F7';
		const focusRingError = '0 0 0 4px #FEE4E2'; // For danger buttons

		if (v === 'filled') {
			if (c === 'primary') {
				if (isDisabled) {
					return `
						--btn-bg: #B9E6FE;
						--btn-border: #B9E6FE;
						--btn-text: white;
						--btn-shadow: none;
					`;
				}
				// Apply visual state colors directly for showcase
				const bgColor = state === 'focus' ? '#065986' : state === 'hover' ? '#026AA2' : '#0086C9';
				const borderColor = state === 'focus' ? '#065986' : state === 'hover' ? '#026AA2' : '#0086C9';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #026AA2;
					--btn-bg-focus: #065986;
					--btn-border: ${borderColor};
					--btn-border-hover: #026AA2;
					--btn-border-focus: #065986;
					--btn-text: white;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'gray') {
				// Figma: Gray Filled uses light backgrounds with dark text
				if (isDisabled) {
					// Figma: Bg=#F5F5F5, Border=#F5F5F5, Text=#A3A3A3
					return `
						--btn-bg: #F5F5F5;
						--btn-border: #F5F5F5;
						--btn-text: #A3A3A3;
						--btn-shadow: ${shadowXs};
					`;
				}
				// Default: Bg=#F5F5F5, Hover: Bg=#E5E5E5, Focused: Border=#E5E5E5
				const bgColor = state === 'hover' ? '#E5E5E5' : '#F5F5F5';
				const borderColor = state === 'focus' ? '#E5E5E5' : state === 'hover' ? '#E5E5E5' : '#F5F5F5';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #E5E5E5;
					--btn-bg-focus: #F5F5F5;
					--btn-border: ${borderColor};
					--btn-border-hover: #E5E5E5;
					--btn-border-focus: #E5E5E5;
					--btn-text: #292929;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'danger') {
				// Figma: Danger Filled specs
				if (isDisabled) {
					// Figma: Bg=#FECDCA (Error/200), Border=#FECDCA
					return `
						--btn-bg: #FECDCA;
						--btn-border: #FECDCA;
						--btn-text: white;
						--btn-shadow: ${shadowXs};
					`;
				}
				// Default: #D92D20 (Error/600), Hover: #B42318 (Error/700)
				const bgColor = state === 'hover' ? '#B42318' : '#D92D20';
				const borderColor = state === 'hover' ? '#B42318' : '#D92D20';
				const shadow = state === 'focus' ? `${focusRingError}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #B42318;
					--btn-bg-focus: #D92D20;
					--btn-border: ${borderColor};
					--btn-border-hover: #B42318;
					--btn-border-focus: #D92D20;
					--btn-text: white;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingError}, ${shadowXs};
				`;
			}
		}

		if (v === 'outline') {
			if (c === 'primary') {
				if (isDisabled) {
					// Figma: Bg=White (#FFFFFF), Border=Neutral-True/200 (#E5E5E5), Text=Neutral-True/400 (#A3A3A3)
					return `
						--btn-bg: #FFFFFF;
						--btn-border: #E5E5E5;
						--btn-text: #A3A3A3;
						--btn-shadow: ${shadowXs};
					`;
				}
				// Figma: Border=Blue light/500 (#0BA5EC), Text=Blue light/700 (#026AA2)
				// Hover: Border=Blue light/500 (#0BA5EC - same), Text=Blue light/800 (#065986), Bg=#F0F9FF
				// Focused: Same as default + focus ring
				const bgColor = state === 'hover' ? '#F0F9FF' : 'white';
				const borderColor = '#0BA5EC'; // Border stays same on hover
				const textColor = state === 'hover' ? '#065986' : '#026AA2';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #F0F9FF;
					--btn-bg-focus: white;
					--btn-border: ${borderColor};
					--btn-border-hover: #0BA5EC;
					--btn-border-focus: #0BA5EC;
					--btn-text: ${textColor};
					--btn-text-hover: #065986;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'gray') {
				// Figma: Gray Outline specs
				if (isDisabled) {
					// Figma: Bg=#FFFFFF, Border=#E5E5E5 (Neutral-True/200), Text=#A3A3A3
					return `
						--btn-bg: #FFFFFF;
						--btn-border: #E5E5E5;
						--btn-text: #A3A3A3;
						--btn-shadow: ${shadowXs};
					`;
				}
				// Default: Border=#D6D6D6, Text=#424242
				// Hover: Bg=#F5F5F5, Text=#292929
				// Focused: Border=#D6D6D6, Text=#292929
				const bgColor = state === 'hover' ? '#F5F5F5' : '#FFFFFF';
				const borderColor = '#D6D6D6'; // Same for all states
				const textColor = state === 'hover' || state === 'focus' ? '#292929' : '#424242';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #F5F5F5;
					--btn-bg-focus: #FFFFFF;
					--btn-border: ${borderColor};
					--btn-border-hover: #D6D6D6;
					--btn-border-focus: #D6D6D6;
					--btn-text: ${textColor};
					--btn-text-hover: #292929;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'danger') {
				// Figma: Danger Outline specs
				if (isDisabled) {
					// Figma: Bg=#FFFFFF, Border=#FECDCA (Error/200), Text=#FDA29B (Error/300)
					return `
						--btn-bg: #FFFFFF;
						--btn-border: #FECDCA;
						--btn-text: #FDA29B;
						--btn-shadow: ${shadowXs};
					`;
				}
				// Default: Border=#FDA29B (Error/300), Text=#B42318 (Error/700)
				// Hover: Bg=#FEF3F2 (Error/50), Text=#912018 (Error/800)
				const bgColor = state === 'hover' ? '#FEF3F2' : '#FFFFFF';
				const borderColor = '#FDA29B'; // Same for all active states
				const textColor = state === 'hover' ? '#912018' : '#B42318';
				const shadow = state === 'focus' ? `${focusRingError}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #FEF3F2;
					--btn-bg-focus: #FFFFFF;
					--btn-border: ${borderColor};
					--btn-border-hover: #FDA29B;
					--btn-border-focus: #FDA29B;
					--btn-text: ${textColor};
					--btn-text-hover: #912018;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingError}, ${shadowXs};
				`;
			}
		}

		// TEXT VARIANT - Transparent background, only text color changes
		if (v === 'text') {
			if (c === 'primary') {
				if (isDisabled) {
					return `
						--btn-bg: transparent;
						--btn-border: transparent;
						--btn-text: #A3A3A3;
						--btn-shadow: none;
					`;
				}
				const bgColor = state === 'hover' ? '#F0F9FF' : 'transparent';
				const textColor = state === 'focus' ? '#065986' : state === 'hover' ? '#065986' : '#026AA2';
				const shadow = state === 'focus' ? focusRingGray : 'none';
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #F0F9FF;
					--btn-bg-focus: transparent;
					--btn-border: transparent;
					--btn-border-hover: transparent;
					--btn-border-focus: transparent;
					--btn-text: ${textColor};
					--btn-text-hover: #065986;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray};
				`;
			}
			if (c === 'gray') {
				if (isDisabled) {
					return `
						--btn-bg: transparent;
						--btn-border: transparent;
						--btn-text: #A3A3A3;
						--btn-shadow: none;
					`;
				}
				const bgColor = state === 'hover' ? '#F5F5F5' : 'transparent';
				const textColor = '#292929';
				const shadow = state === 'focus' ? focusRingGray : 'none';
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #F5F5F5;
					--btn-bg-focus: transparent;
					--btn-border: transparent;
					--btn-border-hover: transparent;
					--btn-border-focus: transparent;
					--btn-text: ${textColor};
					--btn-text-hover: #292929;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray};
				`;
			}
			if (c === 'danger') {
				// Figma: Danger Text - Transparent bg
				if (isDisabled) {
					return `
						--btn-bg: transparent;
						--btn-border: transparent;
						--btn-text: #FDA29B;
						--btn-shadow: none;
					`;
				}
				const bgColor = state === 'hover' ? '#FEF3F2' : 'transparent';
				const textColor = state === 'hover' ? '#912018' : '#B42318';
				const shadow = state === 'focus' ? focusRingError : 'none';
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #FEF3F2;
					--btn-bg-focus: transparent;
					--btn-border: transparent;
					--btn-border-hover: transparent;
					--btn-border-focus: transparent;
					--btn-text: ${textColor};
					--btn-text-hover: #912018;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingError};
				`;
			}
		}

		// GHOST VARIANT - Light background with border
		if (v === 'ghost') {
			if (c === 'primary') {
				if (isDisabled) {
					return `
						--btn-bg: #F0F9FF;
						--btn-border: #F0F9FF;
						--btn-text: #A3A3A3;
						--btn-shadow: ${shadowXs};
					`;
				}
				const bgColor = state === 'hover' ? '#E0F2FE' : '#F0F9FF';
				const borderColor = state === 'hover' ? '#E0F2FE' : '#F0F9FF';
				const textColor = state === 'hover' ? '#065986' : '#026AA2';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #E0F2FE;
					--btn-bg-focus: #F0F9FF;
					--btn-border: ${borderColor};
					--btn-border-hover: #E0F2FE;
					--btn-border-focus: #F0F9FF;
					--btn-text: ${textColor};
					--btn-text-hover: #065986;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'gray') {
				if (isDisabled) {
					return `
						--btn-bg: #FAFAFA;
						--btn-border: #FAFAFA;
						--btn-text: #A3A3A3;
						--btn-shadow: ${shadowXs};
					`;
				}
				const bgColor = state === 'hover' ? '#F5F5F5' : '#FAFAFA';
				const borderColor = state === 'hover' ? '#F5F5F5' : '#FAFAFA';
				const textColor = '#292929';
				const shadow = state === 'focus' ? `${focusRingGray}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #F5F5F5;
					--btn-bg-focus: #FAFAFA;
					--btn-border: ${borderColor};
					--btn-border-hover: #F5F5F5;
					--btn-border-focus: #FAFAFA;
					--btn-text: ${textColor};
					--btn-text-hover: #292929;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingGray}, ${shadowXs};
				`;
			}
			if (c === 'danger') {
				// Figma: Danger Ghost specs
				// Default: Bg=#FEF3F2 (Error/50), Border=#FEF3F2, Text=#B42318 (Error/700)
				// Hovering: Bg=#FEE4E2 (Error/100), Border=#FEE4E2, Text=#912018 (Error/800)
				// Focused: Bg=#FEF3F2, Border=#FEF3F2, Text=#B42318, Focus ring 4px #FEE4E2
				// Disable: Bg=#FFFBFA (Error/25), Border=#FFFBFA, Text=#FDA29B (Error/300)
				if (isDisabled) {
					return `
						--btn-bg: #FFFBFA;
						--btn-border: #FFFBFA;
						--btn-text: #FDA29B;
						--btn-shadow: ${shadowXs};
					`;
				}
				const bgColor = state === 'hover' ? '#FEE4E2' : '#FEF3F2';
				const borderColor = state === 'hover' ? '#FEE4E2' : '#FEF3F2';
				const textColor = state === 'hover' ? '#912018' : '#B42318';
				const shadow = state === 'focus' ? `${focusRingError}, ${shadowXs}` : shadowXs;
				return `
					--btn-bg: ${bgColor};
					--btn-bg-hover: #FEE4E2;
					--btn-bg-focus: #FEF3F2;
					--btn-border: ${borderColor};
					--btn-border-hover: #FEE4E2;
					--btn-border-focus: #FEF3F2;
					--btn-text: ${textColor};
					--btn-text-hover: #912018;
					--btn-shadow: ${shadow};
					--btn-shadow-focus: ${focusRingError}, ${shadowXs};
				`;
			}
		}

		return '';
	}

	function handleClick(event: MouseEvent) {
		if (!disabled && !loading) {
			dispatch('click', event);
		}
	}

	// Icon size from Figma: 2xl = 24px, others = 20px
	// Using exact pixel values to ensure consistent sizing
	$: defaultIconSize = size === '2xl' ? 24 : 20;
	$: finalIconSize = iconSize || defaultIconSize;
	$: iconSizeStyle = `width: ${finalIconSize}px; height: ${finalIconSize}px; min-width: ${finalIconSize}px; min-height: ${finalIconSize}px;`;
	$: iconViewBox = size === '2xl' ? '0 0 24 24' : '0 0 20 20';
	$: iconRadius = size === '2xl' ? 9 : 7;
	$: iconCenter = size === '2xl' ? 12 : 10;
	
	// Determine icon position: prioritize new icon prop, fallback to deprecated props
	// Chỉ hiển thị icon nếu có iconLeft/iconRight/iconOnly props hoặc có icon prop
	$: hasIcon = !!icon;
	$: hasIconProps = iconLeft || iconRight || iconOnly;
	
	// Nếu có icon prop, dùng iconPosition hoặc mặc định 'left'
	// Nếu không có icon prop, dùng deprecated props (iconLeft/iconRight/iconOnly)
	$: finalIconPosition = hasIcon 
		? (iconPosition || 'left')
		: (iconOnly ? 'only' : iconRight ? 'right' : iconLeft ? 'left' : undefined);
	
	// Chỉ show icon nếu có iconLeft/iconRight/iconOnly props HOẶC có icon prop
	$: showIconLeft = hasIcon 
		? (finalIconPosition === 'left')
		: iconLeft; // Chỉ show nếu có iconLeft prop
	
	$: showIconRight = hasIcon
		? (finalIconPosition === 'right')
		: iconRight; // Chỉ show nếu có iconRight prop
		
	$: showIconOnly = hasIcon
		? (finalIconPosition === 'only')
		: iconOnly; // Chỉ show nếu có iconOnly prop
</script>

<button
	{...$$restProps}
	class="{classes} {$$restProps.class || ''}"
	class:btn-disabled={disabled}
	class:btn-loading={loading}
	style={variantStyles}
	disabled={disabled || loading}
	on:click={handleClick}
	on:focus
	on:blur
	on:mouseenter
	on:mouseleave
>
	{#if loading}
		<span class="absolute inset-0 flex items-center justify-center">
			<svg
				class="animate-spin"
				style={iconSizeStyle}
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				/>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		</span>
	{/if}

	{#if showIconOnly}
		<!-- Icon-only mode: single centered icon -->
		{#if icon}
			<!-- Use icon prop if provided -->
			<svelte:component 
				this={icon} 
				size={finalIconSize} 
				strokeWidth={2}
				color={iconColor || 'currentColor'}
				class="shrink-0"
			/>
		{:else if $$slots.icon}
			<!-- Use slot content if provided -->
			<slot name="icon" />
		{:else}
			<!-- Show placeholder circle only in showcase mode (no icon prop, no slot) -->
			<svg style={iconSizeStyle} viewBox={iconViewBox} fill="none" class="shrink-0">
				<circle cx={iconCenter} cy={iconCenter} r={iconRadius} stroke="currentColor" stroke-width="1.5" fill="none" />
			</svg>
		{/if}
	{:else}
		{#if showIconLeft}
			{#if icon && finalIconPosition === 'left'}
				<!-- Use icon prop if provided and position is left -->
				<svelte:component 
					this={icon} 
					size={finalIconSize} 
					strokeWidth={2}
					color={iconColor || 'currentColor'}
					class="shrink-0"
				/>
			{:else if $$slots['icon-left']}
				<!-- Use slot content if provided -->
				<slot name="icon-left" />
			{:else}
				<!-- Show placeholder circle only in showcase mode (no icon prop, no slot) -->
				<svg style={iconSizeStyle} viewBox={iconViewBox} fill="none" class="shrink-0">
					<circle cx={iconCenter} cy={iconCenter} r={iconRadius} stroke="currentColor" stroke-width="1.5" fill="none" />
				</svg>
			{/if}
		{/if}

		<span class:invisible={loading}>
			<slot>Button CTA</slot>
		</span>

		{#if showIconRight}
			{#if icon && finalIconPosition === 'right'}
				<!-- Use icon prop if provided and position is right -->
				<svelte:component 
					this={icon} 
					size={finalIconSize} 
					strokeWidth={2}
					color={iconColor || 'currentColor'}
					class="shrink-0"
				/>
			{:else if $$slots['icon-right']}
				<!-- Use slot content if provided -->
				<slot name="icon-right" />
			{:else}
				<!-- Show placeholder circle only in showcase mode (no icon prop, no slot) -->
				<svg style={iconSizeStyle} viewBox={iconViewBox} fill="none" class="shrink-0">
					<circle cx={iconCenter} cy={iconCenter} r={iconRadius} stroke="currentColor" stroke-width="1.5" fill="none" />
				</svg>
			{/if}
		{/if}
	{/if}
</button>

<style>
	/* Button base typography from Design System tokens */
	button {
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium);
		letter-spacing: 0;
		
		/* Apply CSS variables for colors */
		background-color: var(--btn-bg);
		border-color: var(--btn-border);
		color: var(--btn-text);
		box-shadow: var(--btn-shadow);
	}

	/* Typography by size - using Design System tokens */
	/* sm, md: Body/14px/14-Medium */
	button:global(.btn-size-sm),
	button:global(.btn-size-md) {
		font-size: var(--ds-text-sm); /* 14px */
		line-height: var(--ds-leading-sm); /* 20px */
	}

	/* lg, xl: Body/16px/16-Medium */
	button:global(.btn-size-lg),
	button:global(.btn-size-xl) {
		font-size: var(--ds-text-md); /* 16px */
		line-height: var(--ds-leading-md); /* 24px */
	}

	/* 2xl: Body/18px/18-Medium */
	button:global(.btn-size-2xl) {
		font-size: var(--ds-text-lg); /* 18px */
		line-height: var(--ds-leading-md); /* 24px */
	}

	/* Hover state */
	button:not(.btn-disabled):not(.btn-loading):hover {
		background-color: var(--btn-bg-hover, var(--btn-bg));
		border-color: var(--btn-border-hover, var(--btn-border));
		color: var(--btn-text-hover, var(--btn-text));
	}

	/* Focus state - Figma uses darker background + focus ring */
	button:not(.btn-disabled):not(.btn-loading):focus-visible {
		background-color: var(--btn-bg-focus, var(--btn-bg));
		border-color: var(--btn-border-focus, var(--btn-border));
		box-shadow: var(--btn-shadow-focus, var(--btn-shadow));
	}

	/* Active/Pressed state */
	button:not(.btn-disabled):not(.btn-loading):active {
		background-color: var(--btn-bg-focus, var(--btn-bg));
		border-color: var(--btn-border-focus, var(--btn-border));
	}

	/* Disabled state */
	button.btn-disabled {
		cursor: not-allowed;
	}

	/* Loading state */
	button.btn-loading {
		cursor: wait;
	}
	
	button.btn-loading > span:first-of-type {
		color: var(--btn-text);
	}
</style>
