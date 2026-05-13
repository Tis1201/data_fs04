<script context="module" lang="ts">
    // ==========================================================================
    // TYPES
    // ==========================================================================

    export type CardVariant = 'default' | 'outlined' | 'elevated' | 'filled';
    export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
    export type CardRadius = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'none';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // ==========================================================================
    // PROPS
    // ==========================================================================

    export let variant: CardVariant = 'default';
    export let padding: CardPadding = 'md';
    export let radius: CardRadius = '2xl'; // Default to 16px to match design specs
    export let hoverable: boolean = false;
    export let clickable: boolean = false;
    export let selected: boolean = false;
    export let disabled: boolean = false;
    export let fullWidth: boolean = false;

    // Header props
    export let title: string = '';
    export let subtitle: string = '';
    export let showHeader: boolean = false;
    export let headerDivider: boolean = true;

    // Footer props
    export let showFooter: boolean = false;
    export let footerDivider: boolean = true;

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    const dispatch = createEventDispatcher<{
        click: void;
    }>();

    function handleClick() {
        if (disabled) return;
        if (clickable) {
            dispatch('click');
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return;
        if (clickable && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            dispatch('click');
        }
    }

    // ==========================================================================
    // COMPUTED STYLES
    // ==========================================================================

    const paddingClasses: Record<CardPadding, string> = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6'
    };

    const headerPaddingClasses: Record<CardPadding, string> = {
        none: 'px-0 py-0',
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4'
    };

    const footerPaddingClasses: Record<CardPadding, string> = {
        none: 'px-0 py-0',
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4'
    };

    // Radius classes mapping
    $: radiusClasses = {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        '2xl': 'rounded-2xl'
    }[radius];

    // Compute variant-specific CSS custom properties
    $: variantStyles = getVariantStyles(variant, hoverable, clickable, selected, disabled);

    function getVariantStyles(
        v: CardVariant,
        isHoverable: boolean,
        isClickable: boolean,
        isSelected: boolean,
        isDisabled: boolean
    ): string {
        const parts: string[] = [];
        
        // Base variant styles - use direct values to ensure they work even if CSS variables are not loaded
        switch (v) {
            case 'default':
                parts.push('--card-bg: #FFFFFF;');
                parts.push('--card-border: #E5E5E5;');
                parts.push('--card-border-width: 1px;');
                break;
            case 'outlined':
                parts.push('--card-bg: transparent;');
                parts.push('--card-border: #E5E5E5;');
                parts.push('--card-border-width: 1px;');
                break;
            case 'elevated':
                parts.push('--card-bg: #FFFFFF;');
                parts.push('--card-border: transparent;');
                parts.push('--card-border-width: 0;');
                parts.push('--card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);');
                break;
            case 'filled':
                parts.push('--card-bg: #F9FAFB;');
                parts.push('--card-border: transparent;');
                parts.push('--card-border-width: 0;');
                break;
        }

        // Hover styles
        if (isHoverable && !isDisabled) {
            parts.push('--card-shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);');
            parts.push('--card-border-hover: var(--ds-border-hover);');
        }

        // Selected styles
        if (isSelected) {
            parts.push('--card-ring-width: 2px;');
            parts.push('--card-ring-color: var(--ds-color-primary-500);');
            parts.push('--card-border-selected: var(--ds-color-primary-500);');
        }

        // Disabled styles
        if (isDisabled) {
            parts.push('--card-opacity: 0.5;');
            parts.push('--card-cursor: not-allowed;');
        }

        // Clickable styles
        if (isClickable && !isDisabled) {
            parts.push('--card-cursor: pointer;');
        }

        return parts.join(' ');
    }

    $: cardClasses = [
        radiusClasses,
        'overflow-hidden',
        fullWidth ? 'w-full' : '',
        hoverable && !disabled ? 'card-hoverable' : '',
        clickable && !disabled ? 'card-clickable' : '',
        selected ? 'card-selected' : '',
        disabled ? 'card-disabled' : ''
    ].filter(Boolean).join(' ');
</script>

<div
    class="ds-card {cardClasses}"
    style={variantStyles}
    role={clickable ? 'button' : undefined}
    tabindex={clickable && !disabled ? 0 : undefined}
    on:click={handleClick}
    on:keydown={handleKeydown}
    {...$$restProps}
>
    <!-- Header -->
    {#if showHeader || title || $$slots.header}
        <div 
            class="card-header {headerPaddingClasses[padding]}"
            class:border-b={headerDivider}
            style={headerDivider ? 'border-color: var(--ds-border-subtle);' : ''}
        >
            {#if $$slots.header}
                <slot name="header" />
            {:else}
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        {#if title}
                            <h3 class="text-[var(--ds-text-lg)] font-[var(--ds-font-semibold)] text-[var(--ds-text-primary)] truncate">
                                {title}
                            </h3>
                        {/if}
                        {#if subtitle}
                            <p class="mt-1 text-[var(--ds-text-sm)] text-[var(--ds-text-secondary)]">
                                {subtitle}
                            </p>
                        {/if}
                    </div>
                    {#if $$slots['header-actions']}
                        <div class="flex items-center gap-2 shrink-0">
                            <slot name="header-actions" />
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}

    <!-- Body -->
    <div class="card-body {paddingClasses[padding]}">
        <slot />
    </div>

    <!-- Footer -->
    {#if showFooter || $$slots.footer}
        <div 
            class="card-footer {footerPaddingClasses[padding]}"
            class:border-t={footerDivider}
            style={footerDivider ? 'border-color: var(--ds-border-subtle);' : ''}
        >
            <slot name="footer" />
        </div>
    {/if}
</div>

<style>
    /* Base card styles - apply to any element with --card-bg CSS variable or .ds-card class */
    :global(div.ds-card),
    :global([style*="--card-bg"]) {
        font-family: var(--ds-font-family-primary, 'Poppins', system-ui, sans-serif) !important;
        /* Use CSS custom properties with direct fallback values */
        background-color: var(--card-bg, #FFFFFF) !important;
        border: var(--card-border-width, 1px) solid var(--card-border, #E5E5E5) !important;
        border-radius: 16px !important;
        box-shadow: var(--card-shadow, none) !important;
        opacity: var(--card-opacity, 1) !important;
        cursor: var(--card-cursor, default) !important;
        transition: all 0.2s ease-out !important;
    }

    :global(div.ds-card.card-hoverable:hover),
    :global([style*="--card-bg"].card-hoverable:hover) {
        box-shadow: var(--card-shadow-hover, var(--card-shadow, none)) !important;
        border-color: var(--card-border-hover, var(--card-border, #E5E5E5)) !important;
    }

    :global(div.ds-card.card-selected),
    :global([style*="--card-bg"].card-selected) {
        box-shadow: 0 0 0 var(--card-ring-width, 0) var(--card-ring-color, transparent) !important;
        border-color: var(--card-border-selected, var(--card-border, #E5E5E5)) !important;
    }

    :global(div.ds-card.card-clickable:focus),
    :global([style*="--card-bg"].card-clickable:focus) {
        outline: none !important;
        box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--ds-color-primary-200, #B2CCFF) !important;
    }

    :global(div.ds-card.card-disabled),
    :global([style*="--card-bg"].card-disabled) {
        pointer-events: none !important;
    }
</style>
