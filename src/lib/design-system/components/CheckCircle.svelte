<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Types
    export type CheckCircleSize = 'sm' | 'md';
    export type CheckCircleState = 'default' | 'hover' | 'disabled';

    // Props
    export let id: string = '';
    export let name: string = '';
    export let value: string = '';
    export let checked: boolean = false;
    export let disabled: boolean = false;
    export let label: string = '';
    export let supportingText: string = '';
    export let size: CheckCircleSize = 'sm';
    
    // For showcase - force visual state
    export let visualState: CheckCircleState | null = null;

    const dispatch = createEventDispatcher<{
        change: boolean;
    }>();

    let isHovered = false;

    function handleChange(e: Event) {
        const target = e.target as HTMLInputElement;
        checked = target.checked;
        dispatch('change', checked);
    }

    // Generate unique ID if not provided
    $: inputId = id || `check-circle-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine effective state
    $: effectiveState = visualState || (disabled ? 'disabled' : isHovered ? 'hover' : 'default');
    
    // Size configurations from Figma
    const sizeConfig = {
        sm: {
            circle: 16,
            radius: 8, // Full circle
            gap: 8,
            icon: 10,
            strokeWidth: 1.67,
            labelSize: 14,
            labelLineHeight: 20
        },
        md: {
            circle: 20,
            radius: 10, // Full circle
            gap: 12,
            icon: 14,
            strokeWidth: 2,
            labelSize: 16,
            labelLineHeight: 24
        }
    };
    
    $: config = sizeConfig[size];
    
    // State-based colors from Figma
    function getCircleStyles(): string {
        if (effectiveState === 'disabled') {
            if (checked) {
                return 'background: #D6D6D6; border-color: #D6D6D6;';
            }
            return 'background: #F5F5F5; border-color: #D6D6D6;';
        }
        
        if (effectiveState === 'hover') {
            if (checked) {
                return 'background: #141414; border-color: #525252;';
            }
            return 'background: #FAFAFA; border-color: #525252;';
        }
        
        // Default state
        if (checked) {
            return 'background: #141414; border-color: #D6D6D6;';
        }
        return 'background: #FFFFFF; border-color: #D6D6D6;';
    }
    
    function getIconColor(): string {
        // Checkmark is always white
        return '#FFFFFF';
    }
    
    $: circleStyles = getCircleStyles();
    $: iconColor = getIconColor();
</script>

<label 
    class="check-circle-wrapper"
    class:check-circle-disabled={disabled || visualState === 'disabled'}
    for={inputId}
    style="gap: {config.gap}px;"
    on:mouseenter={() => !visualState && (isHovered = true)}
    on:mouseleave={() => !visualState && (isHovered = false)}
>
    <!-- Custom Check Circle -->
    <div class="check-circle-container">
        <input
            type="checkbox"
            id={inputId}
            {name}
            {value}
            {checked}
            disabled={disabled || visualState === 'disabled'}
            class="check-circle-input"
            on:change={handleChange}
            {...$$restProps}
        />
        <div 
            class="check-circle-box"
            style="
                width: {config.circle}px;
                height: {config.circle}px;
                border-radius: {config.radius}px;
                {circleStyles}
            "
        >
            {#if checked}
                <svg 
                    class="check-circle-icon" 
                    width={config.icon} 
                    height={config.icon} 
                    viewBox="0 0 12 12" 
                    fill="none"
                >
                    <path 
                        d="M10 3L4.5 8.5L2 6" 
                        stroke={iconColor}
                        stroke-width={config.strokeWidth} 
                        stroke-linecap="round" 
                        stroke-linejoin="round"
                    />
                </svg>
            {/if}
        </div>
    </div>

    <!-- Text Content -->
    {#if label || supportingText}
        <div class="check-circle-text">
            {#if label}
                <span 
                    class="check-circle-label"
                    style="
                        font-size: {config.labelSize}px;
                        line-height: {config.labelLineHeight}px;
                    "
                >{label}</span>
            {/if}
            {#if supportingText}
                <span 
                    class="check-circle-supporting"
                    style="
                        font-size: {config.labelSize}px;
                        line-height: {config.labelLineHeight}px;
                    "
                >{supportingText}</span>
            {/if}
        </div>
    {/if}
</label>

<style>
    .check-circle-wrapper {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        cursor: pointer;
        font-family: var(--ds-font-family-primary);
    }

    .check-circle-disabled {
        cursor: not-allowed;
    }

    .check-circle-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .check-circle-input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .check-circle-box {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid;
        transition: all 0.15s ease;
    }

    .check-circle-icon {
        flex-shrink: 0;
    }

    /* Text */
    .check-circle-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
    }

    .check-circle-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-gray-800);
    }

    .check-circle-disabled .check-circle-label {
        color: #A3A3A3; /* Neutral - True/400 */
    }

    .check-circle-supporting {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        color: var(--ds-color-gray-500);
    }

    .check-circle-disabled .check-circle-supporting {
        color: #A3A3A3; /* Neutral - True/400 */
    }
</style>
