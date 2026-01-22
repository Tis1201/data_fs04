<script context="module" lang="ts">
    export type VerificationCodeSize = 'sm' | 'md' | 'lg';
    export type VerificationCodeDigits = 4 | 6;
</script>

<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';

    // Props
    export let label: string = 'Secure code';
    export let hintText: string = 'This is a hint text to help user.';
    export let size: VerificationCodeSize = 'md';
    export let digits: VerificationCodeDigits = 4;
    export let disabled: boolean = false;
    export let value: string = '';
    export let error: boolean = false;
    export let errorMessage: string = '';

    const dispatch = createEventDispatcher<{
        change: string;
        complete: string;
    }>();

    // Size configurations from Figma
    const sizeConfig = {
        sm: {
            boxWidth: 64,
            boxHeight: 60,
            padding: '2px 8px',
            fontSize: 30,
            lineHeight: 38,
            gap: 8,
            letterSpacing: '-0.0075em'
        },
        md: {
            boxWidth: 80,
            boxHeight: 76,
            padding: '10px 8px',
            fontSize: 40,
            lineHeight: 56,
            gap: 12,
            letterSpacing: '-0.0075em'
        },
        lg: {
            boxWidth: 96,
            boxHeight: 88,
            padding: '12px 8px',
            fontSize: 60,
            lineHeight: 64,
            gap: 12,
            letterSpacing: '-0.01em'
        }
    };

    $: config = sizeConfig[size];

    // Track individual digit values
    let digitValues: string[] = Array(digits).fill('');
    let inputRefs: HTMLInputElement[] = [];
    let focusedIndex: number | null = null;

    // Sync value prop with digitValues
    $: {
        if (value) {
            const chars = value.split('').slice(0, digits);
            digitValues = [...chars, ...Array(digits - chars.length).fill('')];
        } else {
            digitValues = Array(digits).fill('');
        }
    }

    // Get the full code value
    function getFullValue(): string {
        return digitValues.join('');
    }

    // Handle input change
    function handleInput(index: number, event: Event) {
        const input = event.target as HTMLInputElement;
        const inputValue = input.value;

        // Only allow single digit
        if (inputValue.length > 1) {
            // If pasting multiple characters, distribute them
            const chars = inputValue.split('');
            for (let i = 0; i < chars.length && index + i < digits; i++) {
                if (/^\d$/.test(chars[i])) {
                    digitValues[index + i] = chars[i];
                }
            }
            // Move focus to appropriate position
            const nextIndex = Math.min(index + chars.length, digits - 1);
            if (inputRefs[nextIndex]) {
                inputRefs[nextIndex].focus();
            }
        } else if (/^\d$/.test(inputValue)) {
            digitValues[index] = inputValue;
            // Auto-focus next input
            if (index < digits - 1 && inputRefs[index + 1]) {
                inputRefs[index + 1].focus();
            }
        } else if (inputValue === '') {
            digitValues[index] = '';
        } else {
            // Invalid character, reset
            input.value = digitValues[index];
            return;
        }

        digitValues = [...digitValues];
        const fullValue = getFullValue();
        value = fullValue;
        dispatch('change', fullValue);

        // Check if complete
        if (fullValue.length === digits && !fullValue.includes('')) {
            dispatch('complete', fullValue);
        }
    }

    // Handle keydown for navigation
    function handleKeydown(index: number, event: KeyboardEvent) {
        if (event.key === 'Backspace') {
            if (digitValues[index] === '' && index > 0) {
                // Move to previous input
                inputRefs[index - 1].focus();
            } else {
                digitValues[index] = '';
                digitValues = [...digitValues];
            }
            event.preventDefault();
        } else if (event.key === 'ArrowLeft' && index > 0) {
            inputRefs[index - 1].focus();
            event.preventDefault();
        } else if (event.key === 'ArrowRight' && index < digits - 1) {
            inputRefs[index + 1].focus();
            event.preventDefault();
        } else if (event.key === 'Delete') {
            digitValues[index] = '';
            digitValues = [...digitValues];
        }
    }

    // Handle focus
    function handleFocus(index: number) {
        focusedIndex = index;
        // Select the input content
        inputRefs[index]?.select();
    }

    // Handle blur
    function handleBlur() {
        focusedIndex = null;
    }

    // Handle paste
    function handlePaste(event: ClipboardEvent) {
        event.preventDefault();
        const pasteData = event.clipboardData?.getData('text') || '';
        const cleanedData = pasteData.replace(/\D/g, '').slice(0, digits);
        
        if (cleanedData) {
            for (let i = 0; i < cleanedData.length; i++) {
                digitValues[i] = cleanedData[i];
            }
            digitValues = [...digitValues];
            const fullValue = getFullValue();
            value = fullValue;
            dispatch('change', fullValue);

            // Focus the next empty input or last input
            const nextEmptyIndex = digitValues.findIndex(v => v === '');
            const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : digits - 1;
            inputRefs[focusIndex]?.focus();

            if (fullValue.length === digits) {
                dispatch('complete', fullValue);
            }
        }
    }

    // Get state for a single input
    function getInputState(index: number): 'placeholder' | 'filled' | 'focused' | 'disabled' {
        if (disabled) return 'disabled';
        if (focusedIndex === index) return 'focused';
        if (digitValues[index]) return 'filled';
        return 'placeholder';
    }

    // Get styles for input box
    function getInputStyles(index: number): string {
        const state = getInputState(index);
        
        const baseStyles = [
            'box-sizing: border-box',
            'display: flex',
            'flex-direction: column',
            'align-items: center',
            'justify-content: center',
            `padding: ${config.padding}`,
            `width: ${config.boxWidth}px`,
            `height: ${config.boxHeight}px`,
            'border-radius: 8px',
            "font-family: var(--ds-font-family-primary)",
            'font-weight: 500',
            `font-size: ${config.fontSize}px`,
            `line-height: ${config.lineHeight}px`,
            'text-align: center',
            `letter-spacing: ${config.letterSpacing}`,
            'outline: none',
            'transition: all 0.15s ease'
        ];

        switch (state) {
            case 'placeholder':
                baseStyles.push(
                    'background: #FFFFFF',
                    'border: 1px solid #D6D6D6',
                    'box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05)',
                    'color: #D6D6D6'
                );
                break;
            case 'filled':
                baseStyles.push(
                    'background: #FFFFFF',
                    'border: 2px solid #D6D6D6',
                    'box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05)',
                    'color: #292929'
                );
                break;
            case 'focused':
                baseStyles.push(
                    'background: #FFFFFF',
                    'border: 2px solid #D6D6D6',
                    'box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7',
                    'color: #292929'
                );
                break;
            case 'disabled':
                baseStyles.push(
                    'background: #FAFAFA',
                    'border: 1px solid #D6D6D6',
                    'box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05)',
                    'color: #E5E5E5',
                    'cursor: not-allowed'
                );
                break;
        }

        return baseStyles.join('; ');
    }

    // Check if separator should be shown (for 6 digits, after 3rd input)
    function shouldShowSeparator(index: number): boolean {
        return digits === 6 && index === 2;
    }

    onMount(() => {
        // Focus first input on mount if not disabled
        if (!disabled && inputRefs[0]) {
            // Don't auto-focus, let user click
        }
    });
</script>

<div class="verification-code-input">
    <!-- Label -->
    {#if label}
        <label class="label">{label}</label>
    {/if}

    <!-- Inputs container -->
    <div class="inputs-container" style="gap: {config.gap}px;">
        {#each Array(digits) as _, index}
            <input
                bind:this={inputRefs[index]}
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="1"
                class="digit-input"
                style={getInputStyles(index)}
                value={digitValues[index]}
                placeholder="0"
                {disabled}
                on:input={(e) => handleInput(index, e)}
                on:keydown={(e) => handleKeydown(index, e)}
                on:focus={() => handleFocus(index)}
                on:blur={handleBlur}
                on:paste={handlePaste}
                aria-label={`Digit ${index + 1} of ${digits}`}
            />
            
            {#if shouldShowSeparator(index)}
                <span class="separator" style="
                    font-family: var(--ds-font-family-primary);
                    font-weight: var(--ds-font-medium);
                    font-size: 60px;
                    line-height: 72px;
                    color: var(--ds-border-default);
                    display: flex;
                    align-items: center;
                    letter-spacing: -0.02em;
                ">-</span>
            {/if}
        {/each}
    </div>

    <!-- Hint text or error message -->
    {#if error && errorMessage}
        <span class="hint-text error">{errorMessage}</span>
    {:else if hintText}
        <span class="hint-text">{hintText}</span>
    {/if}
</div>

<style>
    .verification-code-input {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 6px;
    }

    .label {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-700);
    }

    .inputs-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
    }

    .digit-input {
        flex: none;
        caret-color: #292929;
    }

    .digit-input::placeholder {
        color: #D6D6D6;
    }

    .digit-input::-webkit-outer-spin-button,
    .digit-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .digit-input[type=number] {
        -moz-appearance: textfield;
    }

    .separator {
        flex: none;
        user-select: none;
    }

    .hint-text {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .hint-text.error {
        color: #DC2626;
    }
</style>
