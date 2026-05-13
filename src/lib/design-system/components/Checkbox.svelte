<script context="module" lang="ts">
    export type CheckboxSize = 'sm' | 'md';
    export type CheckboxState = 'default' | 'hover' | 'disabled';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Props
    export let id: string = '';
    export let name: string = '';
    export let value: string = '';
    export let checked: boolean = false;
    export let indeterminate: boolean = false;
    export let disabled: boolean = false;
    export let label: string = '';
    export let supportingText: string = '';
    export let size: CheckboxSize = 'sm';
    
    // For showcase - force visual state
    export let visualState: CheckboxState | null = null;

    const dispatch = createEventDispatcher<{
        change: { checked: boolean };
    }>();

    let inputElement: HTMLInputElement;
    let isHovered = false;

    function handleChange(e: Event) {
        const target = e.target as HTMLInputElement;
        // Update local state immediately so visuals always match user interaction.
        // Parent remains source of truth via dispatched event + passed props.
        checked = target.checked;
        if (indeterminate) indeterminate = false;
        // Dispatch the new checked value - let parent control the state
        dispatch('change', { checked: target.checked });
    }

    // Handle indeterminate state and sync checked prop to DOM
    $: if (inputElement) {
        inputElement.indeterminate = indeterminate;
        // Force sync checked state from prop to DOM element
        if (inputElement.checked !== checked) {
            inputElement.checked = checked;
        }
    }

    // Generate unique ID if not provided
    $: inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine effective state
    $: effectiveState = visualState || (disabled ? 'disabled' : isHovered ? 'hover' : 'default');
    
    // Size configurations from Figma
    const sizeConfig = {
        sm: {
            box: 16,
            radius: 4,
            gap: 8,
            icon: 12,
            strokeWidth: 1.67,
            labelSize: 14,
            labelLineHeight: 20
        },
        md: {
            box: 20,
            radius: 6,
            gap: 12,
            icon: 14,
            strokeWidth: 2,
            labelSize: 16,
            labelLineHeight: 24
        }
    };
    
    $: config = sizeConfig[size];
    
    // Reactive: compute if checked or indeterminate
    $: isCheckedOrIndeterminate = checked || indeterminate;
    
    // Reactive: compute box styles based on state
    $: boxStyles = (() => {
        if (effectiveState === 'disabled') {
            if (isCheckedOrIndeterminate) {
                return 'background: #F5F5F5; border-color: #D6D6D6;';
            }
            return 'background: #F5F5F5; border-color: #D6D6D6;';
        }
        
        if (effectiveState === 'hover') {
            if (isCheckedOrIndeterminate) {
                return 'background: #141414; border-color: #525252;';
            }
            return 'background: #FAFAFA; border-color: #525252;';
        }
        
        // Default state
        if (isCheckedOrIndeterminate) {
            return 'background: #141414; border-color: #D6D6D6;';
        }
        return 'background: #FFFFFF; border-color: #D6D6D6;';
    })();
    
    // Reactive: compute icon color
    $: iconColor = effectiveState === 'disabled' ? '#D6D6D6' : '#FFFFFF';
</script>

<label 
    class="checkbox-wrapper"
    class:checkbox-disabled={disabled || visualState === 'disabled'}
    for={inputId}
    style="gap: {config.gap}px;"
    on:mouseenter={() => !visualState && (isHovered = true)}
    on:mouseleave={() => !visualState && (isHovered = false)}
>
    <!-- Custom Checkbox -->
    <div class="checkbox-container">
        <input
            bind:this={inputElement}
            type="checkbox"
            id={inputId}
            {name}
            {value}
            checked={checked}
            aria-checked={checked}
            disabled={disabled || visualState === 'disabled'}
            class="checkbox-input"
            on:change={handleChange}
            {...$$restProps}
        />
        <div 
            class="checkbox-box"
            style="
                width: {config.box}px;
                height: {config.box}px;
                border-radius: {config.radius}px;
                {boxStyles}
            "
        >
            {#if checked && !indeterminate}
                <svg 
                    class="checkbox-icon" 
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
            {:else if indeterminate}
                <svg 
                    class="checkbox-icon" 
                    width={config.icon} 
                    height={config.icon} 
                    viewBox="0 0 12 12" 
                    fill="none"
                >
                    <path 
                        d="M2.5 6H9.5" 
                        stroke={iconColor}
                        stroke-width={config.strokeWidth} 
                        stroke-linecap="round"
                    />
                </svg>
            {/if}
        </div>
    </div>

    <!-- Text Content -->
    {#if label || supportingText}
        <div class="checkbox-text">
            {#if label}
                <span 
                    class="checkbox-label"
                    style="
                        font-size: {config.labelSize}px;
                        line-height: {config.labelLineHeight}px;
                    "
                >{label}</span>
            {/if}
            {#if supportingText}
                <span 
                    class="checkbox-supporting"
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
    .checkbox-wrapper {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        cursor: pointer;
        font-family: var(--ds-font-family-primary);
    }

    .checkbox-disabled {
        cursor: not-allowed;
    }

    .checkbox-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .checkbox-input {
        /* Keep the native input accessible/clickable while visually hidden */
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        opacity: 0;
        cursor: pointer;
        border: 0;
    }

    .checkbox-box {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid;
        transition: all 0.15s ease;
    }

    .checkbox-icon {
        flex-shrink: 0;
    }

    /* Text */
    .checkbox-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
    }

    .checkbox-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
    }

    .checkbox-disabled .checkbox-label {
        color: #A3A3A3; /* Neutral - True/400 */
    }

    .checkbox-supporting {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        color: var(--ds-text-tertiary);
    }

    .checkbox-disabled .checkbox-supporting {
        color: #A3A3A3; /* Neutral - True/400 */
    }
</style>
