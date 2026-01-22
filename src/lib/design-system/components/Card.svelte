<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // ==========================================================================
    // TYPES
    // ==========================================================================

    export type CardVariant = 'default' | 'outlined' | 'elevated' | 'filled';
    export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

    // ==========================================================================
    // PROPS
    // ==========================================================================

    export let variant: CardVariant = 'default';
    export let padding: CardPadding = 'md';
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

    $: variantClasses = {
        default: 'bg-[var(--ds-surface-primary)] border border-[var(--ds-border-default)]',
        outlined: 'bg-transparent border border-[var(--ds-border-default)]',
        elevated: 'bg-[var(--ds-surface-primary)] shadow-md border-0',
        filled: 'bg-[var(--ds-bg-secondary)] border-0'
    }[variant];

    $: hoverClasses = hoverable && !disabled 
        ? 'hover:shadow-lg hover:border-[var(--ds-border-hover)] transition-all duration-200' 
        : '';

    $: clickableClasses = clickable && !disabled 
        ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ds-color-primary-200)] focus:ring-offset-2' 
        : '';

    $: selectedClasses = selected 
        ? 'ring-2 ring-[var(--ds-color-primary-500)] border-[var(--ds-color-primary-500)]' 
        : '';

    $: disabledClasses = disabled 
        ? 'opacity-50 cursor-not-allowed' 
        : '';

    $: cardClasses = [
        'rounded-lg overflow-hidden',
        variantClasses,
        hoverClasses,
        clickableClasses,
        selectedClasses,
        disabledClasses,
        fullWidth ? 'w-full' : ''
    ].filter(Boolean).join(' ');
</script>

<div
    class="ds-card {cardClasses}"
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
            class:border-[var(--ds-border-subtle)]={headerDivider}
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
            class:border-[var(--ds-border-subtle)]={footerDivider}
        >
            <slot name="footer" />
        </div>
    {/if}
</div>

<style>
    .ds-card {
        font-family: var(--ds-font-family-primary);
    }
</style>
