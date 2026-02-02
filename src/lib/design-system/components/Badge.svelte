<script context="module" lang="ts">
    // Badge color variants - all 12 colors from Figma
    export type BadgeColor = 
        | 'gray' 
        | 'error' 
        | 'warning' 
        | 'yellow'
        | 'success' 
        | 'teal'
        | 'blue-light' 
        | 'blue'
        | 'indigo'
        | 'purple'
        | 'pink'
        | 'rose';
    
    export type BadgeSize = 'sm' | 'md' | 'lg';
    export type BadgeVariant = 'filled' | 'outline';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { X, ArrowRight, Plus } from 'lucide-svelte';

    // Props
    export let label: string = 'Label';
    export let color: BadgeColor = 'gray';
    export let size: BadgeSize = 'md';
    export let variant: BadgeVariant = 'filled';
    
    // Element visibility
    export let showDot: boolean = false;
    export let showCircle: boolean = false;
    export let showAvatar: boolean = false;
    export let showArrow: boolean = false;
    export let showClose: boolean = false;
    export let iconOnly: boolean = false; // Full=No mode (icon only with +)
    
    // Avatar
    export let avatar: string | undefined = undefined;
    export let avatarAlt: string = '';
    export let avatarInitials: string = '';
    
    // State
    export let disabled: boolean = false;
    /** When false, render as span (display-only, no button semantics or click). */
    export let interactive: boolean = true;

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
    // FIGMA COLOR SPECS - All 12 colors
    // ==========================================================================
    
    const colorConfig: Record<BadgeColor, {
        filled: { bg: string; text: string; dot: string };
        outline: { bg: string; border: string; text: string; dot: string };
    }> = {
        gray: {
            filled: { bg: '#F2F4F7', text: '#344054', dot: '#667085' },
            outline: { bg: '#FFFFFF', border: '#D0D5DD', text: '#344054', dot: '#667085' }
        },
        error: {
            filled: { bg: '#FEF3F2', text: '#B42318', dot: '#F04438' },
            outline: { bg: '#FFFFFF', border: '#FDA29B', text: '#B42318', dot: '#F04438' }
        },
        warning: {
            filled: { bg: '#FEF0C7', text: '#B54708', dot: '#F79009' },
            outline: { bg: '#FFFFFF', border: '#FEC84B', text: '#B54708', dot: '#F79009' }
        },
        yellow: {
            filled: { bg: '#FEF7C3', text: '#A15C07', dot: '#EAAA08' },
            outline: { bg: '#FFFFFF', border: '#FEDF89', text: '#A15C07', dot: '#EAAA08' }
        },
        success: {
            filled: { bg: '#ECFDF3', text: '#027A48', dot: '#12B76A' },
            outline: { bg: '#FFFFFF', border: '#6CE9A6', text: '#027A48', dot: '#12B76A' }
        },
        teal: {
            filled: { bg: '#F0FDF9', text: '#107569', dot: '#15B79E' },
            outline: { bg: '#FFFFFF', border: '#5FE9D0', text: '#107569', dot: '#15B79E' }
        },
        'blue-light': {
            filled: { bg: '#F0F9FF', text: '#026AA2', dot: '#0BA5EC' },
            outline: { bg: '#FFFFFF', border: '#7CD4FD', text: '#026AA2', dot: '#0BA5EC' }
        },
        blue: {
            filled: { bg: '#EFF8FF', text: '#175CD3', dot: '#2E90FA' },
            outline: { bg: '#FFFFFF', border: '#84CAFF', text: '#175CD3', dot: '#2E90FA' }
        },
        indigo: {
            filled: { bg: '#EEF4FF', text: '#3538CD', dot: '#6172F3' },
            outline: { bg: '#FFFFFF', border: '#A4BCFD', text: '#3538CD', dot: '#6172F3' }
        },
        purple: {
            filled: { bg: '#F4F3FF', text: '#5925DC', dot: '#7A5AF8' },
            outline: { bg: '#FFFFFF', border: '#BDB4FE', text: '#5925DC', dot: '#7A5AF8' }
        },
        pink: {
            filled: { bg: '#FDF2FA', text: '#C11574', dot: '#EE46BC' },
            outline: { bg: '#FFFFFF', border: '#FCCEEE', text: '#C11574', dot: '#EE46BC' }
        },
        rose: {
            filled: { bg: '#FFF1F3', text: '#C01048', dot: '#F63D68' },
            outline: { bg: '#FFFFFF', border: '#FECDD6', text: '#C01048', dot: '#F63D68' }
        }
    };

    // ==========================================================================
    // FIGMA SIZE SPECS
    // ==========================================================================
    
    // Badge heights: sm=24px, md=28px, lg=32px
    const sizeConfig: Record<BadgeSize, {
        height: string;
        padding: string;
        gap: string;
        fontSize: string;
        lineHeight: string;
        dotSize: number;
        dotInner: number;
        circleSize: number;
        avatarSize: number;
        iconSize: number;
        closeSize: number;
    }> = {
        sm: {
            height: '24px',
            padding: '2px 8px',
            gap: '4px',
            fontSize: '12px',
            lineHeight: '18px',
            dotSize: 8,
            dotInner: 6,
            circleSize: 14,
            avatarSize: 16,
            iconSize: 12,
            closeSize: 14
        },
        md: {
            height: '28px',
            padding: '2px 10px',
            gap: '6px',
            fontSize: '14px',
            lineHeight: '20px',
            dotSize: 10,
            dotInner: 8,
            circleSize: 16,
            avatarSize: 18,
            iconSize: 14,
            closeSize: 16
        },
        lg: {
            height: '32px',
            padding: '4px 12px',
            gap: '6px',
            fontSize: '14px',
            lineHeight: '20px',
            dotSize: 12,
            dotInner: 10,
            circleSize: 18,
            avatarSize: 18,
            iconSize: 16,
            closeSize: 18
        }
    };

    // Icon-only sizes (plus button)
    const iconOnlySizeConfig: Record<BadgeSize, {
        size: string;
        iconSize: number;
    }> = {
        sm: { size: '24px', iconSize: 12 },
        md: { size: '28px', iconSize: 14 },
        lg: { size: '32px', iconSize: 16 }
    };

    // Safe access with fallback to gray
    $: config = (colorConfig[color] || colorConfig.gray)[variant] || colorConfig.gray.filled;
    $: sizeSpec = sizeConfig[size] || sizeConfig.md;
    $: iconOnlySpec = iconOnlySizeConfig[size] || iconOnlySizeConfig.md;

    // Computed styles
    $: bgStyle = variant === 'filled' 
        ? `background-color: ${config.bg};` 
        : `background-color: ${config.bg}; border: 1px solid ${(config as any).border};`;
    
    $: textStyle = `color: ${config.text};`;
</script>

{#if iconOnly}
    <!-- Icon-only badge (Full=No) -->
    {#if interactive}
        <button
            type="button"
            class="badge-icon-only"
            class:badge-disabled={disabled}
            style="
                width: {iconOnlySpec.size};
                height: {iconOnlySpec.size};
                {bgStyle}
                {textStyle}
            "
            on:click={handleClick}
            {disabled}
            {...$$restProps}
        >
            <Plus 
                size={iconOnlySpec.iconSize} 
                strokeWidth={2.5}
            />
        </button>
    {:else}
        <span
            class="badge-icon-only badge-static"
            class:badge-disabled={disabled}
            style="
                width: {iconOnlySpec.size};
                height: {iconOnlySpec.size};
                {bgStyle}
                {textStyle}
            "
            {...$$restProps}
        >
            <Plus 
                size={iconOnlySpec.iconSize} 
                strokeWidth={2.5}
            />
        </span>
    {/if}
{:else}
    <!-- Full badge (Full=Yes) -->
    {#if interactive}
        <button
            type="button"
            class="badge"
            class:badge-disabled={disabled}
            style="
                height: {sizeSpec.height};
                padding: {sizeSpec.padding};
                gap: {sizeSpec.gap};
                font-size: {sizeSpec.fontSize};
                line-height: {sizeSpec.lineHeight};
                {bgStyle}
                {textStyle}
            "
            on:click={handleClick}
            {disabled}
            {...$$restProps}
        >
        <!-- Status Dot -->
        {#if showDot}
            <span 
                class="badge-dot-wrapper"
                style="width: {sizeSpec.dotSize}px; height: {sizeSpec.dotSize}px;"
            >
                <span 
                    class="badge-dot"
                    style="
                        background-color: {config.dot}; 
                        width: {sizeSpec.dotInner}px; 
                        height: {sizeSpec.dotInner}px;
                    "
                />
            </span>
        {/if}

        <!-- Circle indicator -->
        {#if showCircle}
            <span 
                class="badge-circle"
                style="
                    width: {sizeSpec.circleSize}px; 
                    height: {sizeSpec.circleSize}px;
                    border-color: {config.text};
                "
            />
        {/if}

        <!-- Avatar -->
        {#if showAvatar}
            {#if avatar}
                <img 
                    src={avatar} 
                    alt={avatarAlt || label}
                    class="badge-avatar"
                    style="width: {sizeSpec.avatarSize}px; height: {sizeSpec.avatarSize}px;"
                />
            {:else if avatarInitials}
                <span 
                    class="badge-avatar-initials"
                    style="
                        width: {sizeSpec.avatarSize}px; 
                        height: {sizeSpec.avatarSize}px;
                        font-size: {size === 'sm' ? '8px' : '10px'};
                    "
                >
                    {avatarInitials}
                </span>
            {/if}
        {/if}

        <!-- Label -->
        <span class="badge-label">{label}</span>

        <!-- Arrow Right -->
        {#if showArrow}
            <ArrowRight 
                size={sizeSpec.iconSize} 
                strokeWidth={2}
            />
        {/if}

        <!-- Close Button -->
        {#if showClose}
            <button
                type="button"
                class="badge-close"
                style="
                    width: {sizeSpec.closeSize}px;
                    height: {sizeSpec.closeSize}px;
                "
                on:click={handleRemove}
                aria-label="Remove {label}"
            >
                <X 
                    size={sizeSpec.closeSize - 4} 
                    strokeWidth={2}
                />
            </button>
        {/if}
    </button>
    {:else}
        <span
            class="badge badge-static"
            class:badge-disabled={disabled}
            style="
                height: {sizeSpec.height};
                padding: {sizeSpec.padding};
                gap: {sizeSpec.gap};
                font-size: {sizeSpec.fontSize};
                line-height: {sizeSpec.lineHeight};
                {bgStyle}
                {textStyle}
            "
            {...$$restProps}
        >
        <!-- Status Dot -->
        {#if showDot}
            <span 
                class="badge-dot-wrapper"
                style="width: {sizeSpec.dotSize}px; height: {sizeSpec.dotSize}px;"
            >
                <span 
                    class="badge-dot"
                    style="
                        background-color: {config.dot}; 
                        width: {sizeSpec.dotInner}px; 
                        height: {sizeSpec.dotInner}px;
                    "
                />
            </span>
        {/if}

        <!-- Circle indicator -->
        {#if showCircle}
            <span 
                class="badge-circle"
                style="
                    width: {sizeSpec.circleSize}px; 
                    height: {sizeSpec.circleSize}px;
                    border-color: {config.text};
                "
            />
        {/if}

        <!-- Avatar -->
        {#if showAvatar}
            {#if avatar}
                <img 
                    src={avatar} 
                    alt={avatarAlt || label}
                    class="badge-avatar"
                    style="width: {sizeSpec.avatarSize}px; height: {sizeSpec.avatarSize}px;"
                />
            {:else if avatarInitials}
                <span 
                    class="badge-avatar-initials"
                    style="
                        width: {sizeSpec.avatarSize}px; 
                        height: {sizeSpec.avatarSize}px;
                        font-size: {size === 'sm' ? '8px' : '10px'};
                    "
                >
                    {avatarInitials}
                </span>
            {/if}
        {/if}

        <!-- Label -->
        <span class="badge-label">{label}</span>

        <!-- Arrow Right -->
        {#if showArrow}
            <ArrowRight 
                size={sizeSpec.iconSize} 
                strokeWidth={2}
            />
        {/if}
        </span>
    {/if}
{/if}

<style>
    .badge {
        display: inline-flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        
        border: none;
        border-radius: var(--ds-radius-full);
        
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        text-align: center;
        white-space: nowrap;
        
        cursor: pointer;
        transition: all 0.15s ease;
        mix-blend-mode: multiply;
    }

    .badge:hover:not(.badge-disabled) {
        filter: brightness(0.95);
    }

    .badge:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
    }

    .badge-disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .badge-icon-only {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        
        border: none;
        border-radius: 9999px;
        
        cursor: pointer;
        transition: all 0.15s ease;
        mix-blend-mode: multiply;
    }

    .badge-icon-only:hover:not(.badge-disabled) {
        filter: brightness(0.95);
    }

    .badge-icon-only:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
    }

    .badge-dot-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        flex-shrink: 0;
    }

    .badge-dot {
        border-radius: 50%;
        flex-shrink: 0;
    }

    .badge-circle {
        flex-shrink: 0;
        border-radius: 50%;
        border: 1.5px solid;
        background: transparent;
    }

    .badge-avatar {
        flex-shrink: 0;
        border-radius: 50%;
        object-fit: cover;
    }

    .badge-avatar-initials {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.1);
        font-weight: 600;
        text-transform: uppercase;
    }

    .badge-label {
        white-space: nowrap;
    }

    .badge-close {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        
        background: transparent;
        border: none;
        border-radius: 50%;
        
        cursor: pointer;
        transition: all 0.15s ease;
        opacity: 0.7;
    }

    .badge-close:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.05);
    }

    .badge-close:focus-visible {
        outline: none;
        opacity: 1;
    }
</style>
