<script context="module" lang="ts">
    export type TooltipTheme = 'light' | 'dark';
    export type TooltipArrow = 
        | 'none' 
        | 'top' 
        | 'top-left' 
        | 'top-right' 
        | 'bottom' 
        | 'bottom-left' 
        | 'bottom-right' 
        | 'left' 
        | 'right';
    export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
</script>

<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    
    // Props
    export let text: string = 'This is a tooltip';
    export let supportingText: string = '';
    export let theme: TooltipTheme = 'dark';
    export let arrow: TooltipArrow = 'bottom';
    export let trigger: 'hover' | 'click' | 'manual' = 'hover';
    export let position: TooltipPosition = 'top';
    export let maxWidth: number = 320;
    export let open: boolean = false; // For manual control or click trigger
    
    const dispatch = createEventDispatcher<{
        show: void;
        hide: void;
    }>();
    
    // Theme colors
    const themeConfig = {
        light: {
            background: '#FFFFFF',
            border: '1px solid #F5F5F5',
            titleColor: '#292929',
            supportingColor: '#737373',
            arrowBg: '#FFFFFF'
        },
        dark: {
            background: '#292929',
            border: 'none',
            titleColor: '#FFFFFF',
            supportingColor: '#D6D6D6',
            arrowBg: '#292929'
        }
    };
    
    $: config = themeConfig[theme];
    $: hasSupportingText = !!supportingText;
    
    // Click handler for click trigger
    function handleClick() {
        if (trigger === 'click') {
            open = !open;
            if (open) {
                dispatch('show');
            } else {
                dispatch('hide');
            }
        }
    }
    
    // Close on outside click for click trigger
    function handleOutsideClick(event: MouseEvent) {
        if (trigger === 'click' && open) {
            const target = event.target as HTMLElement;
            if (!target.closest('.tooltip-wrapper')) {
                open = false;
                dispatch('hide');
            }
        }
    }
    
    // Add/remove outside click listener
    $: if (typeof window !== 'undefined') {
        if (trigger === 'click' && open) {
            setTimeout(() => {
                window.addEventListener('click', handleOutsideClick);
            }, 0);
        } else {
            window.removeEventListener('click', handleOutsideClick);
        }
    }
    
    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('click', handleOutsideClick);
        }
    });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<span 
    class="tooltip-wrapper"
    class:hover-trigger={trigger === 'hover'}
    class:click-open={trigger === 'click' && open}
    class:manual-open={trigger === 'manual' && open}
    on:click={handleClick}
>
    <!-- Trigger slot -->
    <slot />
    
    <!-- Tooltip -->
    <div 
        class="tooltip tooltip-{position}"
        class:has-arrow={arrow !== 'none'}
        role="tooltip"
        style="
            --tooltip-bg: {config.background};
            --tooltip-border: {theme === 'light' && arrow === 'none' ? config.border : 'none'};
            --tooltip-title-color: {config.titleColor};
            --tooltip-supporting-color: {config.supportingColor};
            --tooltip-arrow-bg: {config.arrowBg};
            --tooltip-max-width: {maxWidth}px;
        "
    >
        <div class="tooltip-content" class:with-supporting={hasSupportingText}>
            <span class="tooltip-title">{text}</span>
            
            {#if hasSupportingText}
                <span class="tooltip-supporting">{supportingText}</span>
            {/if}
        </div>
        
        <!-- Arrow -->
        {#if arrow !== 'none'}
            <div class="tooltip-arrow arrow-{arrow}"></div>
        {/if}
    </div>
</span>

<style>
    .tooltip-wrapper {
        position: relative;
        display: inline-flex;
        cursor: pointer;
    }
    
    .tooltip {
        position: absolute;
        z-index: 9999;
        pointer-events: none;
        white-space: normal;
        word-wrap: break-word;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s ease, visibility 0.15s ease;
        box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
    }
    
    /* Show tooltip on hover */
    .tooltip-wrapper.hover-trigger:hover .tooltip,
    .tooltip-wrapper.click-open .tooltip,
    .tooltip-wrapper.manual-open .tooltip {
        opacity: 1;
        visibility: visible;
    }
    
    /* Position: top */
    .tooltip.tooltip-top {
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
    }
    
    /* Position: bottom */
    .tooltip.tooltip-bottom {
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 8px;
    }
    
    /* Position: left */
    .tooltip.tooltip-left {
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-right: 8px;
    }
    
    /* Position: right */
    .tooltip.tooltip-right {
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-left: 8px;
    }
    
    .tooltip-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 8px 12px;
        background: var(--tooltip-bg);
        border: var(--tooltip-border);
        border-radius: 8px;
        max-width: var(--tooltip-max-width);
        position: relative;
        z-index: 1;
    }
    
    .tooltip-content.with-supporting {
        padding: 12px;
        gap: 4px;
    }
    
    .tooltip-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--tooltip-title-color);
    }
    
    .tooltip-supporting {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--tooltip-supporting-color);
    }
    
    /* Arrow base */
    .tooltip-arrow {
        position: absolute;
        width: 12px;
        height: 12px;
        background: var(--tooltip-arrow-bg);
        border-radius: 1px;
        transform: rotate(45deg);
        z-index: 0;
    }
    
    /* Arrow positions */
    .tooltip-arrow.arrow-bottom {
        left: 50%;
        bottom: -5px;
        margin-left: -6px;
    }
    
    .tooltip-arrow.arrow-bottom-left {
        left: 16px;
        bottom: -5px;
    }
    
    .tooltip-arrow.arrow-bottom-right {
        right: 16px;
        bottom: -5px;
    }
    
    .tooltip-arrow.arrow-top {
        left: 50%;
        top: -5px;
        margin-left: -6px;
    }
    
    .tooltip-arrow.arrow-top-left {
        left: 16px;
        top: -5px;
    }
    
    .tooltip-arrow.arrow-top-right {
        right: 16px;
        top: -5px;
    }
    
    .tooltip-arrow.arrow-left {
        left: -5px;
        top: 50%;
        margin-top: -6px;
    }
    
    .tooltip-arrow.arrow-right {
        right: -5px;
        top: 50%;
        margin-top: -6px;
    }
</style>
