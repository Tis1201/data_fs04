<script context="module" lang="ts">
    // Exported Types
    export type InputState = 'default' | 'disabled' | 'focused' | 'success' | 'error';
    export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'time';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Props
    export let id: string = '';
    export let name: string = '';
    export let type: InputType = 'text';
    export let value: string = '';
    export let placeholder: string = 'Placeholder';
    export let label: string = '';
    export let helperText: string = '';
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let state: InputState = 'default';
    export let showClearButton: boolean = false;
    export let prefixIcon: boolean = false;
    export let suffixIcon: boolean = false;
    export let maxlength: number | undefined = undefined;
    export let align: 'left' | 'center' | 'right' = 'left'; // Text alignment for label and input content

    // For controlled focus state in showcase
    export let visualState: InputState | undefined = undefined;

    const dispatch = createEventDispatcher<{
        input: string;
        change: string;
        focus: FocusEvent;
        blur: FocusEvent;
        clear: void;
    }>();

    let inputElement: HTMLInputElement;
    let isFocused = false;

    // Computed state (visual state takes precedence for showcase)
    $: computedState = visualState || (disabled ? 'disabled' : (isFocused ? 'focused' : state));

    // State configurations from Figma
    const stateConfig: Record<InputState, {
        bg: string;
        border: string;
        shadow: string;
        iconColor: string;
        textColor: string;
        placeholderColor: string;
        helperColor: string;
    }> = {
        default: {
            bg: '#FEFEFE',
            border: '#D6D6D6',
            shadow: 'none',
            iconColor: '#292929',
            textColor: '#141414',
            placeholderColor: '#A3A3A3',
            helperColor: '#737373'
        },
        disabled: {
            bg: '#F5F5F5',
            border: '#D6D6D6',
            shadow: 'none',
            iconColor: '#A3A3A3',
            textColor: '#A3A3A3',
            placeholderColor: '#A3A3A3',
            helperColor: '#737373'
        },
        focused: {
            bg: '#FEFEFE',
            border: '#525252',
            shadow: '0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7',
            iconColor: '#292929',
            textColor: '#141414',
            placeholderColor: '#A3A3A3',
            helperColor: '#737373'
        },
        success: {
            bg: '#FEFEFE',
            border: '#039855',
            shadow: 'none',
            iconColor: '#292929',
            textColor: '#141414',
            placeholderColor: '#A3A3A3',
            helperColor: '#039855'
        },
        error: {
            bg: '#FEFEFE',
            border: '#D92D20',
            shadow: '0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #FEE4E2',
            iconColor: '#D92D20',
            textColor: '#141414',
            placeholderColor: '#A3A3A3',
            helperColor: '#D92D20'
        }
    };

    $: config = stateConfig[computedState];

    function handleInput(e: Event) {
        const target = e.target as HTMLInputElement;
        value = target.value;
        dispatch('input', value);
    }

    function handleChange(e: Event) {
        const target = e.target as HTMLInputElement;
        dispatch('change', target.value);
    }

    function handleFocus(e: FocusEvent) {
        isFocused = true;
        dispatch('focus', e);
    }

    function handleBlur(e: FocusEvent) {
        isFocused = false;
        dispatch('blur', e);
    }

    function handleClear() {
        value = '';
        dispatch('clear');
        dispatch('input', '');
        inputElement?.focus();
    }

    // Generate unique ID if not provided
    $: inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="input-field-wrapper" class:input-field-center={align === 'center'} class:input-field-right={align === 'right'}>
    <!-- Label -->
    {#if label}
        <label for={inputId} class="input-label" class:input-label-center={align === 'center'} class:input-label-right={align === 'right'}>
            <span class="input-label-text">{label}</span>
            {#if required}
                <span class="input-required">*</span>
            {/if}
        </label>
    {/if}

    <!-- Input Container -->
    <div 
        class="input-container"
        class:input-disabled={disabled}
        style="
            background-color: {config.bg};
            border-color: {config.border};
            box-shadow: {config.shadow};
        "
    >
        <!-- Prefix Icon Slot -->
        {#if prefixIcon || $$slots['prefix-icon']}
            <span class="input-icon input-icon-prefix" style="color: {config.iconColor};">
                <slot name="prefix-icon">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </slot>
            </span>
        {/if}

        <!-- Input Element -->
        <input
            bind:this={inputElement}
            {type}
            id={inputId}
            {name}
            {value}
            {placeholder}
            {disabled}
            {readonly}
            {maxlength}
            class="input-element"
            class:input-element-center={align === 'center'}
            class:input-element-right={align === 'right'}
            style="color: {config.textColor}; --placeholder-color: {config.placeholderColor};"
            on:input={handleInput}
            on:change={handleChange}
            on:focus={handleFocus}
            on:blur={handleBlur}
            {...$$restProps}
        />

        <!-- Clear Button -->
        {#if showClearButton && value && !disabled && !readonly}
            <button
                type="button"
                class="input-clear-btn"
                on:click={handleClear}
                aria-label="Clear input"
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path 
                        d="M15 5L5 15M5 5L15 15" 
                        stroke="#A3A3A3" 
                        stroke-width="2" 
                        stroke-linecap="round" 
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
        {/if}

        <!-- Suffix Icon Slot -->
        {#if suffixIcon || $$slots['suffix-icon']}
            <span class="input-icon input-icon-suffix" style="color: {config.iconColor};">
                <slot name="suffix-icon">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path 
                            d="M6 9L11 14L16 9" 
                            stroke="currentColor" 
                            stroke-width="2" 
                            stroke-linecap="round" 
                            stroke-linejoin="round"
                        />
                    </svg>
                </slot>
            </span>
        {/if}
    </div>

    <!-- Helper Text -->
    {#if helperText}
        <p class="input-helper" style="color: {config.helperColor};">
            {helperText}
        </p>
    {/if}
</div>

<style>
    .input-field-wrapper {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        width: 100%;
    }

    /* Center alignment */
    .input-field-center {
        align-items: center;
    }

    /* Right alignment */
    .input-field-right {
        align-items: flex-end;
    }

    /* Label */
    .input-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px;
        gap: 2px;
    }

    /* Center label alignment */
    .input-label-center {
        justify-content: center;
    }

    /* Right label alignment */
    .input-label-right {
        justify-content: flex-end;
    }

    .input-label-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm); /* 14px from Figma */
        line-height: var(--ds-leading-sm); /* 20px from Figma */
        color: var(--ds-color-neutral-true-600); /* #525252 from Figma */
    }

    .input-required {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-error-600);
        align-self: stretch;
    }

    /* Input Container */
    .input-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 12px 14px;
        gap: 12px;
        width: 100%;
        height: 48px;
        
        border: 1px solid;
        border-radius: 8px;
        
        transition: all 0.15s ease;
        box-sizing: border-box;
    }

    .input-disabled {
        cursor: not-allowed;
    }

    /* Input Element */
    .input-element {
        flex: 1;
        min-width: 0;
        height: 24px;
        
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        text-align: left; /* Default left alignment */
        
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
    }

    /* Center input text alignment */
    .input-element-center {
        text-align: center;
    }

    /* Right input text alignment */
    .input-element-right {
        text-align: right;
    }

    .input-element::placeholder {
        color: var(--placeholder-color, #A3A3A3);
    }

    .input-element:disabled {
        cursor: not-allowed;
    }

    /* Icons */
    .input-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 22px;
        height: 22px;
    }

    .input-icon :global(svg) {
        width: 22px;
        height: 22px;
    }

    /* Clear Button */
    .input-clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        padding: 0;
        
        background: transparent;
        border: none;
        cursor: pointer;
        
        transition: opacity 0.15s ease;
    }

    .input-clear-btn:hover {
        opacity: 0.7;
    }

    /* Helper Text */
    .input-helper {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        margin: 0;
        padding: 2px;
    }
</style>
