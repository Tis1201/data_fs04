<script context="module" lang="ts">
    export type TabType = 'button' | 'underline' | 'underline-filled';
    export type TabSize = 'sm' | 'md';
    export type TabState = 'default' | 'hover' | 'focus';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Props
    export let label: string = 'My details';
    export let type: TabType = 'button';
    export let size: TabSize = 'sm';
    export let current: boolean = false;
    export let badge: number | null = null;
    export let disabled: boolean = false;
    export let visualState: TabState | null = null; // For showcase

    const dispatch = createEventDispatcher<{ click: void }>();

    // Track internal state
    let isHovered = false;
    let isFocused = false;

    // Determine active state
    $: activeState = visualState || (isFocused ? 'focus' : isHovered ? 'hover' : 'default');

    // Size configurations
    const sizeConfig = {
        sm: {
            button: {
                padding: badge !== null ? '7px 12px' : '8px 12px',
                height: '36px',
                fontSize: '14px',
                lineHeight: '20px',
                badgePadding: '2px 8px',
                badgeHeight: '22px',
                badgeFontSize: '12px',
                badgeLineHeight: '18px'
            },
            underline: {
                padding: '0px 4px 10px',
                height: '32px',
                fontSize: '14px',
                lineHeight: '20px',
                badgePadding: '2px 8px',
                badgeHeight: '22px',
                badgeFontSize: '12px',
                badgeLineHeight: '18px'
            },
            'underline-filled': {
                padding: badge !== null ? '11px 12px' : '12px',
                height: '44px',
                fontSize: '14px',
                lineHeight: '20px',
                badgePadding: '2px 8px',
                badgeHeight: '22px',
                badgeFontSize: '12px',
                badgeLineHeight: '18px'
            }
        },
        md: {
            button: {
                padding: '10px 14px',
                height: '44px',
                fontSize: '16px',
                lineHeight: '24px',
                badgePadding: '2px 10px',
                badgeHeight: '24px',
                badgeFontSize: '14px',
                badgeLineHeight: '20px'
            },
            underline: {
                padding: '0px 4px 10px',
                height: '34px',
                fontSize: '16px',
                lineHeight: '24px',
                badgePadding: '2px 10px',
                badgeHeight: '24px',
                badgeFontSize: '14px',
                badgeLineHeight: '20px'
            },
            'underline-filled': {
                padding: '12px',
                height: '48px',
                fontSize: '16px',
                lineHeight: '24px',
                badgePadding: '2px 10px',
                badgeHeight: '24px',
                badgeFontSize: '14px',
                badgeLineHeight: '20px'
            }
        }
    };

    $: config = sizeConfig[size][type];

    // Reactive container styles - recalculates when current, activeState, type, or config changes
    $: containerStyles = (() => {
        const styles: string[] = [
            'display: flex',
            'flex-direction: row',
            'justify-content: center',
            'align-items: center',
            'gap: 8px',
            `padding: ${config.padding}`,
            `height: ${config.height}`,
            'cursor: pointer',
            'transition: all 0.15s ease',
            'box-sizing: border-box',
            "font-family: var(--ds-font-family-primary)"
        ];

        // Border radius: only for button type; underline types must have no radius
        if (type === 'button') {
            styles.push('border-radius: 6px');
        } else {
            styles.push('border-radius: 0');
        }

        if (type === 'button') {
            // Button type styles
            if (current) {
                styles.push('background: #FFFFFF');
                if (activeState === 'focus') {
                    styles.push('box-shadow: 0px 1px 3px rgba(16, 24, 40, 0.1), 0px 1px 2px rgba(16, 24, 40, 0.06), 0px 0px 0px 4px #F2F4F7');
                } else {
                    styles.push('box-shadow: 0px 1px 3px rgba(16, 24, 40, 0.1), 0px 1px 2px rgba(16, 24, 40, 0.06)');
                }
            } else {
                // Non-current button
                if (activeState === 'hover') {
                    styles.push('background: #FFFFFF');
                    styles.push('box-shadow: 0px 1px 3px rgba(16, 24, 40, 0.1), 0px 1px 2px rgba(16, 24, 40, 0.06)');
                } else if (activeState === 'focus') {
                    styles.push('box-shadow: 0px 0px 0px 4px #F2F4F7');
                } else {
                    styles.push('background: transparent');
                }
            }
        } else if (type === 'underline') {
            // Underline type styles
            styles.push('position: relative');
            styles.push('padding-bottom: 12px');
        } else if (type === 'underline-filled') {
            // Underline filled (Figma: 48px height, 2px underline full width)
            if (current) {
                styles.push('background: var(--ds-color-neutral-true-50)');
                styles.push('border-bottom: 2px solid var(--ds-color-neutral-true-700)');
            } else if (activeState === 'hover') {
                styles.push('background: var(--ds-color-neutral-true-50)');
                styles.push('border-bottom: 2px solid var(--ds-color-neutral-true-700)');
            } else {
                styles.push('background: transparent');
                styles.push('border-bottom: 2px solid transparent');
            }
        }

        return styles.join('; ');
    })();

    // Reactive text color
    $: textColor = (() => {
        if (type === 'button') {
            if (current) {
                return '#344054'; // Gray/700
            } else {
                return activeState === 'hover' ? '#344054' : '#667085'; // Gray/500
            }
        } else {
            // Underline types
            if (current) {
                return '#292929'; // Neutral-True/800 - darker for active
            } else if (activeState === 'hover') {
                return '#424242'; // Neutral-True/700
            } else {
                return '#667085'; // Gray/500
            }
        }
    })();

    // Reactive badge styles
    $: badgeStyles = (() => {
        const bgColor = (type === 'underline' || type === 'underline-filled') && (current || activeState === 'hover')
            ? '#FAFAFA' // Neutral-True/50
            : '#F2F4F7'; // Gray/100

        return [
            'display: flex',
            'flex-direction: row',
            'align-items: center',
            `padding: ${config.badgePadding}`,
            `height: ${config.badgeHeight}`,
            `background: ${bgColor}`,
            'mix-blend-mode: multiply',
            'border-radius: 16px'
        ].join('; ');
    })();

    // Reactive badge text color
    $: badgeTextColor = (() => {
        if ((type === 'underline' || type === 'underline-filled') && (current || activeState === 'hover')) {
            return '#424242'; // Neutral-True/700
        }
        return '#344054'; // Gray/700
    })();

    function handleClick() {
        if (!disabled) {
            dispatch('click');
        }
    }
</script>

<button
    type="button"
    class="tab"
    class:disabled
    class:current
    class:underline-type={type === 'underline' || type === 'underline-filled'}
    style={containerStyles}
    on:click={handleClick}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    on:focus={() => isFocused = true}
    on:blur={() => isFocused = false}
    {disabled}
>
    <span 
        class="tab-label"
        style="
            font-size: {config.fontSize};
            line-height: {config.lineHeight};
            font-weight: {current ? 600 : 500};
            color: {textColor};
        "
    >
        {label}
    </span>

    {#if badge !== null}
        <span 
            class="tab-badge"
            style={badgeStyles}
        >
            <span 
                class="badge-text"
                style="
                    font-size: {config.badgeFontSize};
                    line-height: {config.badgeLineHeight};
                    font-weight: 500;
                    color: {badgeTextColor};
                    text-align: center;
                "
            >
                {badge}
            </span>
        </span>
    {/if}

    <!-- Underline indicator for underline type tabs -->
    {#if type === 'underline' || type === 'underline-filled'}
        <span 
            class="tab-underline"
            style="
                position: absolute;
                left: 0;
                right: 0;
                bottom: -1px;
                height: 2px;
                background: {current ? '#292929' : (isHovered ? '#D6D6D6' : 'transparent')};
                transition: background 0.15s ease;
            "
        ></span>
    {/if}
</button>

<style>
    .tab {
        border: none;
        outline: none;
        user-select: none;
        white-space: nowrap;
        background: transparent;
    }

    .tab:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .tab-label {
        flex: none;
    }

    .tab-badge {
        flex: none;
    }

    .badge-text {
        flex: none;
    }

    .tab-underline {
        pointer-events: none;
    }
</style>
