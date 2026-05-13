<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { ChevronDown } from 'lucide-svelte';

    /** Portal: render dropdown in body so it is outside modal (avoids double-click issue from modal/focus) */
    function appendToBody(node: HTMLElement) {
        if (typeof document !== 'undefined') document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        };
    }

    export let value: string = '';
    export let label: string = '';
    export let placeholder: string = '### ###-####';
    export let disabled: boolean = false;
    export let required: boolean = false;
    export let error: string = '';
    export let hint: string = '';

    // Country data
    interface Country {
        code: string;
        name: string;
        dialCode: string;
    }

    const countries: Country[] = [
        { code: 'US', name: 'United States', dialCode: '+1' },
        { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
        { code: 'CA', name: 'Canada', dialCode: '+1' },
        { code: 'AU', name: 'Australia', dialCode: '+61' },
        { code: 'DE', name: 'Germany', dialCode: '+49' },
        { code: 'FR', name: 'France', dialCode: '+33' },
        { code: 'JP', name: 'Japan', dialCode: '+81' },
        { code: 'KR', name: 'South Korea', dialCode: '+82' },
        { code: 'CN', name: 'China', dialCode: '+86' },
        { code: 'IN', name: 'India', dialCode: '+91' },
        { code: 'VN', name: 'Vietnam', dialCode: '+84' },
        { code: 'SG', name: 'Singapore', dialCode: '+65' },
        { code: 'MY', name: 'Malaysia', dialCode: '+60' },
        { code: 'TH', name: 'Thailand', dialCode: '+66' },
        { code: 'PH', name: 'Philippines', dialCode: '+63' }
    ];

    // Get flag image URL from flagcdn.com
    function getFlagUrl(countryCode: string): string {
        return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
    }

    export let selectedCountry: string = 'US';
    
    $: currentCountry = countries.find(c => c.code === selectedCountry) || countries[0];

    let showDropdown = false;
    let phoneNumber = '';
    let dropdownRef: HTMLDivElement;
    let buttonRef: HTMLButtonElement;
    let dropdownStyle = '';
    let ignoreNextClickOutside = false;
    /** Last value we emitted - avoid reactive block overwriting selectedCountry when value is our own output */
    let lastEmittedValue = '';

    const dispatch = createEventDispatcher<{
        change: { fullValue: string; phoneNumber: string; countryCode: string; dialCode: string };
        input: string;
    }>();

    // Parse value only when it changes from external (parent); never overwrite selectedCountry when value is our own
    $: {
        if (value && value !== lastEmittedValue) {
            const match = value.match(/^\(?\+?(\d{1,3})\)?\s*(.*)$/);
            if (match) {
                const dialCode = '+' + match[1];
                const countriesWithDial = countries.filter((c) => c.dialCode === dialCode);
                if (countriesWithDial.length > 0) {
                    selectedCountry = countriesWithDial[0].code;
                    phoneNumber = match[2].trim();
                } else {
                    phoneNumber = value;
                }
            } else {
                phoneNumber = value;
            }
        }
    }

    // Allow only digits, spaces, hyphens, parentheses for phone formatting
    const VALID_PHONE_CHARS = /[0-9\s\-\(\)]/g;
    function handlePhoneInput(e: Event) {
        const target = e.target as HTMLInputElement;
        const raw = target.value;
        const filtered = raw.match(VALID_PHONE_CHARS)?.join('') ?? '';
        if (filtered !== raw) {
            phoneNumber = filtered;
            target.value = filtered;
        } else {
            phoneNumber = raw;
        }
        updateValue();
    }

    function updateValue() {
        const fullValue = `(${currentCountry.dialCode}) ${phoneNumber}`;
        lastEmittedValue = fullValue;
        value = fullValue;
        dispatch('change', {
            fullValue,
            phoneNumber,
            countryCode: currentCountry.code,
            dialCode: currentCountry.dialCode
        });
        dispatch('input', fullValue);
    }

    function selectCountry(country: Country) {
        selectedCountry = country.code;
        ignoreNextClickOutside = true;
        updateValue();
        // Close dropdown in next tick so the same gesture's click-outside does not interfere
        setTimeout(() => {
            showDropdown = false;
        }, 0);
    }

    function toggleDropdown() {
        if (!disabled) {
            showDropdown = !showDropdown;
            if (showDropdown && buttonRef) {
                const rect = buttonRef.getBoundingClientRect();
                dropdownStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px;`;
            }
        }
    }

    // Open on mousedown (capture) so dropdown shows on first tap; stopPropagation so modal doesn't intercept
    function handleTriggerMouseDown(e: MouseEvent) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        }
        toggleDropdown();
    }

    function handleClickOutside(event: MouseEvent) {
        if (ignoreNextClickOutside) {
            ignoreNextClickOutside = false;
            return;
        }
        const target = event.target as Node;
        const inTrigger = dropdownRef && dropdownRef.contains(target);
        const inPortal = (target as HTMLElement).closest?.('.phone-input-country-dropdown-portal');
        if (!inTrigger && !inPortal) {
            showDropdown = false;
        }
    }

    // Add/remove listener only when dropdown open; always remove first to avoid duplicates
    $: if (browser) {
        document.removeEventListener('mousedown', handleClickOutside);
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
    }

    onDestroy(() => {
        if (browser) {
            document.removeEventListener('mousedown', handleClickOutside);
        }
    });

    function handleCountryMouseDown(country: Country, e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        }
        selectCountry(country);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            showDropdown = false;
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="phone-input-wrapper">
    {#if label}
        <span class="phone-label">
            {label}
            {#if required}
                <span class="required">*</span>
            {/if}
        </span>
    {/if}

    <div class="phone-input-container" class:disabled class:error={!!error}>
        <!-- Country Selector -->
        <div class="country-selector" bind:this={dropdownRef}>
            <button
                type="button"
                class="country-button"
                bind:this={buttonRef}
                on:mousedown|capture={handleTriggerMouseDown}
                {disabled}
            >
                <span class="country-flag">
                    <img 
                        src={getFlagUrl(currentCountry.code)} 
                        alt={currentCountry.name}
                        class="flag-img"
                    />
                </span>
                <ChevronDown size={16} class="chevron" />
            </button>

            {#if showDropdown}
                <!-- Portal: rendered in body so dropdown is outside modal; fixes double-click inside modal -->
                <div
                    use:appendToBody
                    class="country-dropdown phone-input-country-dropdown-portal"
                    style={dropdownStyle}
                    role="listbox"
                    tabindex="-1"
                >
                    {#each countries as country}
                        <button
                            type="button"
                            class="country-option"
                            class:selected={country.code === selectedCountry}
                            on:mousedown|preventDefault={(e) => handleCountryMouseDown(country, e)}
                        >
                            <span class="country-flag">
                                <img 
                                    src={getFlagUrl(country.code)} 
                                    alt={country.name}
                                    class="flag-img"
                                />
                            </span>
                            <span class="country-name">{country.name}</span>
                            <span class="country-dial">{country.dialCode}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Divider -->
        <div class="divider"></div>

        <!-- Phone Input -->
        <div class="phone-number-wrapper">
            <span class="dial-code">{currentCountry.dialCode}</span>
            <input
                type="tel"
                class="phone-number-input"
                {placeholder}
                {disabled}
                bind:value={phoneNumber}
                on:input={handlePhoneInput}
            />
        </div>
    </div>

    {#if error}
        <span class="error-text">{error}</span>
    {:else if hint}
        <span class="hint-text">{hint}</span>
    {/if}
</div>

<style>
    .phone-input-wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1-5);
        width: 100%;
    }

    .phone-label {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-secondary);
    }

    .required {
        color: var(--ds-color-error-500);
    }

    .phone-input-container {
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 48px;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .phone-input-container:focus-within {
        border-color: var(--ds-color-primary-500);
        box-shadow: 0 0 0 3px rgba(0, 134, 201, 0.1);
    }

    .phone-input-container.disabled {
        background: var(--ds-bg-disabled);
        cursor: not-allowed;
    }

    .phone-input-container.error {
        border-color: var(--ds-color-error-500);
    }

    /* Country Selector */
    .country-selector {
        position: relative;
    }

    .country-button {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
        padding: 0 var(--ds-space-3);
        height: 100%;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--ds-text-secondary);
    }

    .country-button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .country-flag {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
    }

    .flag-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .country-button :global(.chevron) {
        color: var(--ds-text-tertiary);
    }

    /* Dropdown */
    .country-dropdown {
        position: fixed;
        z-index: 9999;
        min-width: 280px;
        max-height: 300px;
        overflow-y: auto;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        box-shadow: var(--ds-shadow-lg);
    }

    .country-option {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        width: 100%;
        padding: var(--ds-space-2-5) var(--ds-space-3);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease;
    }

    .country-option:hover {
        background: var(--ds-bg-secondary);
    }

    .country-option.selected {
        background: var(--ds-color-primary-50);
    }

    .country-name {
        flex: 1;
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-primary);
    }

    .country-dial {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    /* Divider */
    .divider {
        width: 1px;
        height: 24px;
        background: var(--ds-border-default);
    }

    /* Phone Number */
    .phone-number-wrapper {
        display: flex;
        align-items: center;
        flex: 1;
        padding: 0 var(--ds-space-3);
        gap: var(--ds-space-1);
    }

    .dial-code {
        font: var(--ds-text-md-regular);
        color: var(--ds-text-primary);
        white-space: nowrap;
    }

    .phone-number-input {
        flex: 1;
        height: 100%;
        padding: 0;
        background: transparent;
        border: none;
        outline: none;
        font: var(--ds-text-md-regular);
        color: var(--ds-text-primary);
    }

    .phone-number-input::placeholder {
        color: var(--ds-text-placeholder);
    }

    .phone-number-input:disabled {
        cursor: not-allowed;
    }

    /* Helper text */
    .error-text {
        font: var(--ds-text-sm-regular);
        color: var(--ds-color-error-500);
    }

    .hint-text {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }
</style>
