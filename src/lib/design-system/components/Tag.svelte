<script context="module" lang="ts">
    export type TagSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { X } from 'lucide-svelte';

    // Props
    export let label: string = 'Label';
    export let size: TagSize = 'md';
    
    // Element visibility
    export let showDot: boolean = false;
    export let showAvatar: boolean = false;
    export let showCount: boolean = false;
    export let showClose: boolean = false;
    
    // Values
    export let dotColor: string = '#12B76A'; // Green - true/500 from Figma
    export let avatar: string | undefined = undefined;
    export let avatarAlt: string = '';
    export let avatarInitials: string = '';
    export let count: number = 5;
    
    // State
    export let disabled: boolean = false;

    const dispatch = createEventDispatcher<{
        remove: void;
        click: void;
    }>();

    function handleRemove(e: MouseEvent) {
        e.stopPropagation();
        if (!disabled) dispatch('remove');
    }

    function handleClick() {
        if (!disabled) dispatch('click');
    }

    // ==========================================================================
    // FIGMA SIZE SPECS
    // ==========================================================================
    
    // Tag specs from Figma:
    // sm: 24px height, padding 4px, gap 4px
    // md: 28px height, padding 4px 6px, gap 6px
    // lg: 32px height, padding 6px 8px, gap 4px
    
    const sizeConfig: Record<TagSize, {
        height: string;
        padding: string;
        gap: string;
        fontSize: string;
        lineHeight: string;
        fontWeight: string;
        // Dot sizes
        dotOuter: number;
        dotInner: number;
        // Avatar size
        avatarSize: number;
        // Count badge
        countWidth: string;
        countHeight: string;
        countPadding: string;
        countFontSize: string;
        // Close button
        closeSize: number;
        closePadding: string;
        closeIconSize: number;
    }> = {
        sm: {
            height: '24px',
            padding: '4px',
            gap: '4px',
            fontSize: '12px',
            lineHeight: '18px',
            fontWeight: '500',
            dotOuter: 8,
            dotInner: 6,
            avatarSize: 16,
            countWidth: '16px',
            countHeight: '16px',
            countPadding: '0px 4px',
            countFontSize: '12px',
            closeSize: 14,
            closePadding: '2px',
            closeIconSize: 10
        },
        md: {
            height: '28px',
            padding: '4px 6px',
            gap: '6px',
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: '400',
            dotOuter: 10,
            dotInner: 8,
            avatarSize: 18,
            countWidth: '19px',
            countHeight: '18px',
            countPadding: '0px 5px',
            countFontSize: '12px',
            closeSize: 16,
            closePadding: '2px',
            closeIconSize: 12
        },
        lg: {
            height: '32px',
            padding: '6px 8px',
            gap: '4px',
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: '400',
            dotOuter: 12,
            dotInner: 10,
            avatarSize: 18,
            countWidth: '21px',
            countHeight: '20px',
            countPadding: '0px 6px',
            countFontSize: '14px',
            closeSize: 20,
            closePadding: '3px',
            closeIconSize: 14
        }
    };

    $: spec = sizeConfig[size];
</script>

<button
    type="button"
    class="tag"
    class:tag-disabled={disabled}
    style="
        height: {spec.height};
        padding: {spec.padding};
        gap: {spec.gap};
        font-size: {spec.fontSize};
        line-height: {spec.lineHeight};
        font-weight: {spec.fontWeight};
    "
    on:click={handleClick}
    {disabled}
    {...$$restProps}
>
    <!-- Status Dot -->
    {#if showDot}
        <span 
            class="tag-dot-wrapper"
            style="width: {spec.dotOuter}px; height: {spec.dotOuter}px;"
        >
            <span 
                class="tag-dot"
                style="
                    background-color: {dotColor}; 
                    width: {spec.dotInner}px; 
                    height: {spec.dotInner}px;
                "
            />
        </span>
    {/if}

    <!-- Avatar -->
    {#if showAvatar}
        {#if avatar}
            <img 
                src={avatar} 
                alt={avatarAlt || label}
                class="tag-avatar"
                style="width: {spec.avatarSize}px; height: {spec.avatarSize}px;"
            />
        {:else if avatarInitials}
            <span 
                class="tag-avatar-initials"
                style="
                    width: {spec.avatarSize}px; 
                    height: {spec.avatarSize}px;
                    font-size: {size === 'sm' ? '8px' : '10px'};
                "
            >
                {avatarInitials}
            </span>
        {/if}
    {/if}

    <!-- Label -->
    <span class="tag-label">{label}</span>

    <!-- Count Badge -->
    {#if showCount}
        <span 
            class="tag-count"
            style="
                min-width: {spec.countWidth};
                height: {spec.countHeight};
                padding: {spec.countPadding};
                font-size: {spec.countFontSize};
            "
        >
            {count}
        </span>
    {/if}

    <!-- Close Button -->
    {#if showClose && !disabled}
        <button
            type="button"
            class="tag-close"
            style="
                width: {spec.closeSize}px;
                height: {spec.closeSize}px;
                padding: {spec.closePadding};
            "
            on:click={handleRemove}
            aria-label="Remove {label}"
        >
            <X 
                size={spec.closeIconSize} 
                strokeWidth={1.5}
            />
        </button>
    {/if}
</button>

<style>
    .tag {
        display: inline-flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        
        /* Using design system tokens */
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-strong);
        border-radius: var(--ds-radius-md);
        
        font-family: var(--ds-font-family-primary);
        color: var(--ds-color-gray-700);
        
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .tag:hover:not(.tag-disabled) {
        border-color: #A3A3A3; /* Neutral - True/400 */
        background: #FAFAFA;
    }

    .tag:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px #F2F4F7;
    }

    .tag-disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .tag-dot-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        flex-shrink: 0;
    }

    .tag-dot {
        border-radius: 50%;
        flex-shrink: 0;
    }

    .tag-avatar {
        flex-shrink: 0;
        border-radius: 50%;
        object-fit: cover;
    }

    .tag-avatar-initials {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 50%;
        background: #E5E5E5;
        font-weight: 600;
        color: #424242;
        text-transform: uppercase;
    }

    .tag-label {
        text-align: center;
        white-space: nowrap;
    }

    .tag-count {
        display: flex;
        align-items: center;
        justify-content: center;
        
        /* Using design system tokens */
        background: var(--ds-bg-tertiary);
        border-radius: 3px;
        
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        line-height: 16px;
        letter-spacing: 0.01em;
        color: var(--ds-color-gray-700);
    }

    .tag-close {
        display: flex;
        align-items: center;
        justify-content: center;
        
        background: transparent;
        border: none;
        border-radius: 3px;
        
        color: #A3A3A3; /* Neutral - True/400 */
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .tag-close:hover {
        color: #737373; /* Neutral - True/500 */
        background: #F5F5F5;
    }

    .tag-close:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px #F2F4F7;
    }
</style>
