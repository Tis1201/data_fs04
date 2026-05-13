<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Types
    export type RadioSize = 'sm' | 'md';
    export type RadioState = 'default' | 'hover' | 'disabled';

    // Props
    export let id: string = '';
    export let name: string = '';
    export let value: string = '';
    export let group: string = '';
    export let disabled: boolean = false;
    export let label: string = '';
    export let supportingText: string = '';
    export let size: RadioSize = 'sm';
    
    // For showcase - force visual state
    export let visualState: RadioState | null = null;

    const dispatch = createEventDispatcher<{
        change: string;
    }>();

    let isHovered = false;

    function handleChange(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
            group = value;
            dispatch('change', value);
        }
    }

    $: checked = group === value;

    // Generate unique ID if not provided
    $: inputId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine effective state
    $: effectiveState = visualState || (disabled ? 'disabled' : isHovered ? 'hover' : 'default');
    
    // Size configurations from Figma
    const sizeConfig = {
        sm: {
            circle: 16,
            radius: 8, // Full circle
            gap: 8,
            dot: 10,
            labelSize: 14,
            labelLineHeight: 20
        },
        md: {
            circle: 20,
            radius: 10, // Full circle
            gap: 12,
            dot: 14,
            labelSize: 16,
            labelLineHeight: 24
        }
    };
    
    $: config = sizeConfig[size];
    
    // State-based colors from Figma
    function getCircleStyles(): string {
        if (effectiveState === 'disabled') {
            return 'background: #F5F5F5; border-color: #D6D6D6;';
        }
        
        if (effectiveState === 'hover') {
            if (checked) {
                return 'background: #FAFAFA; border-color: #525252;';
            }
            return 'background: #FAFAFA; border-color: #525252;';
        }
        
        // Default state
        if (checked) {
            return 'background: #FCFCFC; border-color: #D6D6D6;';
        }
        return 'background: #FFFFFF; border-color: #D6D6D6;';
    }
    
    function getDotColor(): string {
        if (effectiveState === 'disabled') {
            return '#D6D6D6';
        }
        return '#141414'; // Neutral - True/900
    }
    
    $: circleStyles = getCircleStyles();
    $: dotColor = getDotColor();
</script>

<label 
    class="radio-wrapper"
    class:radio-disabled={disabled || visualState === 'disabled'}
    for={inputId}
    style="gap: {config.gap}px;"
    on:mouseenter={() => !visualState && (isHovered = true)}
    on:mouseleave={() => !visualState && (isHovered = false)}
>
    <!-- Custom Radio -->
    <div class="radio-container">
        <input
            type="radio"
            id={inputId}
            {name}
            {value}
            disabled={disabled || visualState === 'disabled'}
            checked={checked}
            class="radio-input"
            on:change={handleChange}
            {...$$restProps}
        />
        <div 
            class="radio-circle"
            style="
                width: {config.circle}px;
                height: {config.circle}px;
                border-radius: {config.radius}px;
                {circleStyles}
            "
        >
            {#if checked}
                <div 
                    class="radio-dot"
                    style="
                        width: {config.dot}px;
                        height: {config.dot}px;
                        background: {dotColor};
                    "
                />
            {/if}
        </div>
    </div>

    <!-- Text Content -->
    {#if label || supportingText}
        <div class="radio-text">
            {#if label}
                <span 
                    class="radio-label"
                    style="
                        font-size: {config.labelSize}px;
                        line-height: {config.labelLineHeight}px;
                    "
                >{label}</span>
            {/if}
            {#if supportingText}
                <span 
                    class="radio-supporting"
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
    .radio-wrapper {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        cursor: pointer;
        font-family: var(--ds-font-family-primary);
    }

    .radio-disabled {
        cursor: not-allowed;
    }

    .radio-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .radio-input {
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

    .radio-circle {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid;
        transition: all 0.15s ease;
    }

    .radio-dot {
        border-radius: 50%;
        transition: all 0.15s ease;
    }

    /* Text */
    .radio-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
    }

    .radio-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
    }

    .radio-disabled .radio-label {
        color: #A3A3A3; /* Neutral - True/400 */
    }

    .radio-supporting {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        color: var(--ds-text-tertiary);
    }

    .radio-disabled .radio-supporting {
        color: #A3A3A3; /* Neutral - True/400 */
    }
</style>
