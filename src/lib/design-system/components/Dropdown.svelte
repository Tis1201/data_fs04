<script context="module" lang="ts">
    export type DropdownOptionType = 'none' | 'icon' | 'checkbox' | 'radio' | 'toggle';

    export interface DropdownOption {
        id: string;
        label: string;
        supportingText?: string;
        type?: DropdownOptionType;
        icon?: any; // Lucide icon component
        avatar?: string; // Avatar image URL
        avatarName?: string; // For initials if no image
        showOnlineIndicator?: boolean;
        checked?: boolean;
        disabled?: boolean;
        shortcut?: string;
    }
</script>

<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { ChevronDown, ChevronUp, Check, Circle, Search, X } from 'lucide-svelte';
    import { Checkbox } from './index';
    import { Radio } from './index';
    import { Toggle } from './index';
    import { Avatar } from './index';
    import { Tag } from './index';
    import { Button } from './index';

    // Props
    export let label: string = '';
    export let placeholder: string = 'Select option';
    export let options: DropdownOption[] = [];
    export let value: string | string[] = '';
    export let multiple: boolean = false;
    export let searchable: boolean = false;
    export let disabled: boolean = false;
    export let required: boolean = false;
    export let error: boolean = false;
    export let success: boolean = false;
    export let errorMessage: string = '';
    export let helperText: string = '';
    export let maxHeight: number = 300;
    export let width: string = '100%';
    export let clearable: boolean = true; // Show clear button when value is selected
    export let displayText: string | undefined = undefined; // Custom display text (overrides displayValue, useful for toggle type)

    const dispatch = createEventDispatcher<{
        change: string | string[];
        select: DropdownOption;
        toggle: { option: DropdownOption; checked: boolean };
    }>();

    let isOpen = false;
    let searchQuery = '';
    let containerRef: HTMLDivElement;
    let searchInputRef: HTMLInputElement;
    let hoveredIndex = -1;

    $: selectedOptions = Array.isArray(value)
        ? options.filter(opt => value.includes(opt.id))
        : options.find(opt => opt.id === value);
    
    // For toggle type: get enabled toggles to display as tags
    $: enabledToggleOptions = options.filter(opt => 
        opt.type === 'toggle' && opt.checked && !opt.disabled
    );

    $: computedDisplayValue = multiple
        ? (selectedOptions as DropdownOption[])?.map(o => o.label).join(', ') || ''
        : (selectedOptions as DropdownOption)?.label || '';
    
    // Use custom displayText if provided, otherwise use computed displayValue
    $: displayValue = displayText !== undefined ? displayText : computedDisplayValue;
    
    // Debug: log when displayValue changes
    $: if (typeof window !== 'undefined' && displayText !== undefined) {
        console.log('[Dropdown] displayText:', displayText, 'displayValue:', displayValue);
    }

    $: filteredOptions = searchQuery
        ? options.filter(opt => 
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.supportingText?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : options;

    function handleToggle() {
        if (disabled) return;
        isOpen = !isOpen;
        if (isOpen && searchable) {
            setTimeout(() => searchInputRef?.focus(), 0);
        }
    }

    function handleSelect(option: DropdownOption) {
        if (option.disabled) return;

        // Toggle is handled by Toggle component's on:change event
        // Don't handle click on row for toggle type
        if (option.type === 'toggle') {
            return;
        }

        if (multiple) {
            const currentValue = Array.isArray(value) ? value : [];
            const newValue = currentValue.includes(option.id)
                ? currentValue.filter(id => id !== option.id)
                : [...currentValue, option.id];
            value = newValue;
            dispatch('change', newValue);
        } else {
            value = option.id;
            dispatch('change', option.id);
            dispatch('select', option);
            isOpen = false;
        }
        searchQuery = '';
    }

    function handleClickOutside(event: MouseEvent) {
        if (containerRef && !containerRef.contains(event.target as Node)) {
            isOpen = false;
            searchQuery = '';
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!isOpen) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                event.preventDefault();
                isOpen = true;
            }
            return;
        }

        switch (event.key) {
            case 'Escape':
                isOpen = false;
                searchQuery = '';
                break;
            case 'ArrowDown':
                event.preventDefault();
                hoveredIndex = Math.min(hoveredIndex + 1, filteredOptions.length - 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                hoveredIndex = Math.max(hoveredIndex - 1, 0);
                break;
            case 'Enter':
                event.preventDefault();
                if (hoveredIndex >= 0 && filteredOptions[hoveredIndex]) {
                    handleSelect(filteredOptions[hoveredIndex]);
                }
                break;
        }
    }

    // Reactive selected set for proper UI updates
    $: selectedSet = new Set(Array.isArray(value) ? value : (value ? [value] : []));
    
    // For radio group - ensure single string value
    $: radioGroupValue = typeof value === 'string' ? value : '';

    function isSelected(optionId: string): boolean {
        return selectedSet.has(optionId);
    }

    function clearSelection() {
        value = multiple ? [] : '';
        dispatch('change', value);
    }

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
    });

    onDestroy(() => {
        if (typeof document !== 'undefined') {
            document.removeEventListener('click', handleClickOutside);
        }
    });
</script>

<div 
    class="dropdown-container" 
    style="width: {width};"
    bind:this={containerRef}
>
    <!-- Label -->
    {#if label}
        <div class="dropdown-label">
            <span class="label-text">{label}</span>
            {#if required}
                <span class="label-required">*</span>
            {/if}
        </div>
    {/if}

    <!-- Trigger -->
    <button
        type="button"
        class="dropdown-trigger"
        class:dropdown-trigger-open={isOpen}
        class:dropdown-trigger-error={error}
        class:dropdown-trigger-success={success}
        class:dropdown-trigger-disabled={disabled}
        class:dropdown-trigger-chips={(multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0) || enabledToggleOptions.length > 0}
        on:click={handleToggle}
        on:keydown={handleKeydown}
        {disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
    >
        {#if multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0}
            <!-- Tags display for multiple selection using Tag component -->
            <div class="dropdown-tags">
                {#each selectedOptions as opt (opt.id)}
                    <Tag 
                        label={opt.label}
                        size="sm"
                        showClose={true}
                        on:remove={() => handleSelect(opt)}
                    />
                {/each}
            </div>
        {:else if enabledToggleOptions.length > 0}
            <!-- Tags display for enabled toggles using Tag component -->
            <div class="dropdown-tags">
                {#each enabledToggleOptions as opt (opt.id)}
                    <Tag 
                        label={opt.label}
                        size="sm"
                        showClose={true}
                        on:remove={(e) => {
                            e.stopPropagation();
                            // Disable toggle when tag is removed
                            const toggleOption = options.find(o => o.id === opt.id);
                            if (toggleOption && toggleOption.type === 'toggle') {
                                // Dispatch toggle event to parent component
                                dispatch('toggle', { option: toggleOption, checked: false });
                            }
                        }}
                    />
                {/each}
            </div>
        {:else}
            <span class="dropdown-trigger-text" class:placeholder={!displayValue && displayText === undefined}>
                {displayValue || placeholder}
            </span>
        {/if}

        <div class="dropdown-trigger-actions">
            {#if displayValue && !disabled && !multiple && clearable}
                <!-- Clear Button - dùng Button component từ design-system -->
                <Button
                    variant="text"
                    color="gray"
                    size="sm"
                    icon={X}
                    iconPosition="only"
                    iconSize={16}
                    on:click={() => clearSelection()}
                    aria-label="Clear selection"
                />
            {/if}
            <span class="dropdown-chevron">
                {#if isOpen}
                    <ChevronUp size={20} strokeWidth={2} />
                {:else}
                    <ChevronDown size={20} strokeWidth={2} />
                {/if}
            </span>
        </div>
    </button>

    <!-- Dropdown Menu -->
    {#if isOpen}
        <div 
            class="dropdown-menu"
            style="max-height: {maxHeight}px; --dropdown-max-height: {maxHeight}px;"
            role="listbox"
            aria-multiselectable={multiple}
        >
            <!-- Search -->
            {#if searchable}
                <div class="dropdown-search">
                    <Search size={20} strokeWidth={2} />
                    <input
                        bind:this={searchInputRef}
                        bind:value={searchQuery}
                        type="text"
                        class="dropdown-search-input"
                        placeholder="Search..."
                        on:keydown={handleKeydown}
                    />
                </div>
            {/if}

            <!-- Options -->
            <div class="dropdown-options">
                {#each filteredOptions as option, index (option.id)}
                    <div
                        class="dropdown-option"
                        class:dropdown-option-hover={hoveredIndex === index}
                        class:dropdown-option-selected={selectedSet.has(option.id)}
                        class:dropdown-option-disabled={option.disabled}
                        on:click={() => handleSelect(option)}
                        on:mouseenter={() => hoveredIndex = index}
                        on:keydown={(e) => e.key === 'Enter' && handleSelect(option)}
                        role="option"
                        aria-selected={selectedSet.has(option.id)}
                        aria-disabled={option.disabled}
                        tabindex={option.disabled ? -1 : 0}
                    >
                        <!-- Left side: Checkbox/Radio/Icon -->
                        {#if option.type === 'checkbox'}
                            {#key selectedSet.has(option.id)}
                                <Checkbox 
                                    size="sm" 
                                    checked={selectedSet.has(option.id)} 
                                    disabled={option.disabled}
                                />
                            {/key}
                        {:else if option.type === 'radio'}
                            {#key selectedSet.has(option.id)}
                                <Radio 
                                    size="sm" 
                                    value={option.id}
                                    group={radioGroupValue}
                                    disabled={option.disabled}
                                    on:change={(e) => {
                                        if (e.detail === option.id) {
                                            handleSelect(option);
                                        }
                                    }}
                                />
                            {/key}
                        {:else if option.type === 'icon' && option.icon}
                            <span class="dropdown-option-icon" class:icon-disabled={option.disabled}>
                                <Circle size={20} strokeWidth={2} />
                            </span>
                        {/if}

                        <!-- Avatar (for checkbox/radio types) -->
                        {#if (option.type === 'checkbox' || option.type === 'radio') && (option.avatar || option.avatarName)}
                            <div class="dropdown-option-avatar">
                                <Avatar 
                                    src={option.avatar} 
                                    name={option.avatarName || option.label}
                                    size="sm"
                                />
                                {#if option.showOnlineIndicator}
                                    <span class="online-indicator"></span>
                                {/if}
                            </div>
                        {/if}

                        <!-- Content -->
                        <div class="dropdown-option-content">
                            <span class="dropdown-option-text" class:text-disabled={option.disabled}>
                                {option.label}
                            </span>
                            {#if option.supportingText || option.shortcut}
                                <span class="dropdown-option-supporting" class:supporting-disabled={option.disabled}>
                                    {option.supportingText || option.shortcut}
                                </span>
                            {/if}
                        </div>

                        <!-- Right side: Toggle/Icon/Check -->
                        {#if option.type === 'toggle'}
                            <div 
                                role="none"
                                on:click|stopPropagation
                                on:keydown|stopPropagation
                            >
                                <Toggle 
                                    size="sm" 
                                    checked={option.checked || false}
                                    disabled={option.disabled}
                                    on:change={(e) => {
                                        // Update option.checked state
                                        option.checked = e.detail;
                                        // Dispatch toggle event for parent component
                                        dispatch('toggle', { option, checked: e.detail });
                                    }}
                                />
                            </div>
                        {:else if option.type === 'icon'}
                            <span class="dropdown-option-icon" class:icon-disabled={option.disabled}>
                                <Circle size={20} strokeWidth={2} />
                            </span>
                        {:else if !option.type || option.type === 'none'}
                            {#if selectedSet.has(option.id)}
                                <span class="dropdown-option-check">
                                    <Check size={20} strokeWidth={2} />
                                </span>
                            {/if}
                        {/if}
                    </div>
                {/each}

                {#if filteredOptions.length === 0}
                    <div class="dropdown-empty">
                        No options found
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Helper/Error/Success Text -->
    {#if error && errorMessage}
        <div class="dropdown-helper dropdown-error-text">
            {errorMessage}
        </div>
    {:else if success && helperText}
        <div class="dropdown-helper dropdown-success-text">
            {helperText}
        </div>
    {:else if helperText}
        <div class="dropdown-helper">
            {helperText}
        </div>
    {/if}
</div>

<style>
    .dropdown-container {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        font-family: var(--ds-font-family-primary);
        position: relative;
    }

    /* Label */
    .dropdown-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
    }

    .label-text {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }

    .label-required {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-error-600);
    }

    /* Trigger */
    .dropdown-trigger {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-3) var(--ds-space-3-5);
        gap: var(--ds-space-3);
        width: 100%;
        height: 48px;
        min-height: 48px;
        max-height: 48px;
        background: var(--ds-input-bg-default);
        border: 1px solid var(--ds-color-neutral-true-300);
        border-radius: var(--ds-radius-lg);
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
        text-align: left;
    }

    .dropdown-trigger:hover:not(.dropdown-trigger-disabled) {
        border-color: var(--ds-color-gray-400);
    }

    .dropdown-trigger:focus {
        outline: none;
        /* Figma: Focus state uses darker gray border (#525252) with gray shadow */
        border-color: var(--ds-color-neutral-true-600);
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px var(--ds-color-gray-100);
    }

    .dropdown-trigger-open {
        /* Figma: Open state uses darker gray border (#525252) with gray shadow */
        border-color: var(--ds-color-neutral-true-600);
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px var(--ds-color-gray-100);
    }

    .dropdown-trigger-success {
        border-color: var(--ds-color-success-600);
    }

    .dropdown-trigger-success:focus {
        border-color: var(--ds-color-success-600);
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px var(--ds-color-success-50);
    }

    .dropdown-trigger-error {
        border-color: var(--ds-color-error-600);
    }

    .dropdown-trigger-error:focus {
        border-color: var(--ds-color-error-600);
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px var(--ds-color-error-100);
    }

    .dropdown-trigger-disabled {
        background: var(--ds-input-bg-disabled);
        border-color: var(--ds-color-neutral-true-300);
        cursor: not-allowed;
    }

    .dropdown-trigger-text {
        flex: 1;
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-base);
        line-height: var(--ds-leading-base);
        color: var(--ds-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown-trigger-text.placeholder {
        color: var(--ds-color-neutral-true-400);
    }

    .dropdown-trigger-disabled .dropdown-trigger-text {
        color: var(--ds-color-neutral-true-400);
    }

    /* Tags for multiple selection - height cố định 48px */
    .dropdown-trigger-chips {
        flex-wrap: nowrap;
        height: 48px;
        min-height: 48px;
        max-height: 48px;
        padding: var(--ds-space-2) var(--ds-space-3-5);
        align-items: center;
        overflow: hidden;
    }

    .dropdown-tags {
        display: flex;
        flex-wrap: nowrap;
        gap: var(--ds-space-2);
        flex: 1;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE/Edge */
    }
    
    .dropdown-tags::-webkit-scrollbar {
        display: none; /* Chrome/Safari */
    }

    .dropdown-trigger-actions {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
    }

    .dropdown-chevron {
        display: flex;
        align-items: center;
        color: var(--ds-color-neutral-true-800);
    }
    
    .dropdown-trigger-disabled .dropdown-chevron {
        color: var(--ds-color-neutral-true-400);
    }
    
    .dropdown-trigger-error .dropdown-chevron {
        color: var(--ds-color-error-600);
    }
    
    .dropdown-trigger-success .dropdown-chevron {
        color: var(--ds-color-neutral-true-800);
    }

    /* Menu */
    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 100; /* Higher than modal (50) */
        margin-top: var(--ds-space-1);
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        box-shadow: var(--ds-shadow-lg);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: var(--dropdown-max-height, 300px);
    }

    /* Search */
    .dropdown-search {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2-5) var(--ds-space-3-5);
        border-bottom: 1px solid var(--ds-border-default);
        color: var(--ds-text-tertiary);
    }

    .dropdown-search-input {
        flex: 1;
        border: none;
        outline: none;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
        background: transparent;
    }

    .dropdown-search-input::placeholder {
        color: var(--ds-text-tertiary);
    }

    /* Options */
    .dropdown-options {
        overflow-y: auto;
        overflow-x: hidden;
        padding: var(--ds-space-1);
        flex: 1;
        min-height: 0;
        max-height: 100%;
    }

    .dropdown-options::-webkit-scrollbar {
        width: 16px;
    }

    .dropdown-options::-webkit-scrollbar-track {
        background: var(--ds-bg-secondary);
    }

    .dropdown-options::-webkit-scrollbar-thumb {
        background: var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-lg);
        border: 4px solid var(--ds-bg-secondary);
    }

    /* Options Container */
    .dropdown-options {
        overflow-y: auto;
        overflow-x: hidden;
        flex: 1;
        min-height: 0;
    }
    
    /* Option Item */
    .dropdown-option {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-space-2) var(--ds-space-4);
        gap: var(--ds-space-3);
        min-height: 54px;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    /* Default State - transparent background */
    .dropdown-option:not(.dropdown-option-disabled) {
        background: transparent;
    }

    /* Hover State - Figma: #FAFAFA (Neutral - True/50) */
    .dropdown-option:hover:not(.dropdown-option-disabled),
    .dropdown-option-hover:not(.dropdown-option-disabled) {
        background: var(--ds-color-neutral-true-50);
    }

    .dropdown-option-selected:not(.dropdown-option-disabled) {
        background: var(--ds-color-primary-50);
    }

    /* Disabled State - transparent background */
    .dropdown-option-disabled {
        background: transparent;
        cursor: not-allowed;
    }

    /* Option Icon */
    .dropdown-option-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        /* Default/Hover: #292929 (Neutral - True/800) */
        color: var(--ds-color-neutral-true-800);
    }

    /* Disabled Icon: #D6D6D6 (Neutral - True/300) */
    .dropdown-option-icon.icon-disabled {
        color: var(--ds-color-neutral-true-300);
    }

    /* Option Avatar */
    .dropdown-option-avatar {
        position: relative;
        width: 32px;
        height: 32px;
        flex-shrink: 0;
    }

    .online-indicator {
        position: absolute;
        width: 8px;
        height: 8px;
        right: 0;
        bottom: 0;
        background: var(--ds-color-success-500);
        border: 1.5px solid var(--ds-color-white);
        border-radius: var(--ds-radius-sm);
    }

    /* Option Content */
    .dropdown-option-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .dropdown-option-text {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        /* Default: #292929 (Neutral - True/800) */
        color: var(--ds-color-neutral-true-800);
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Hover: #141414 (Neutral - True/900) */
    .dropdown-option:hover:not(.dropdown-option-disabled) .dropdown-option-text,
    .dropdown-option-hover:not(.dropdown-option-disabled) .dropdown-option-text {
        color: var(--ds-color-neutral-true-900);
    }

    /* Disabled: #D6D6D6 (Neutral - True/300) */
    .dropdown-option-text.text-disabled {
        color: var(--ds-color-neutral-true-300);
    }

    .dropdown-option-supporting {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        /* Default/Hover: #667085 (Gray/500) */
        color: var(--ds-color-gray-500);
    }

    /* Disabled: #D0D5DD (Gray/300) */
    .dropdown-option-supporting.supporting-disabled {
        color: var(--ds-color-gray-300);
    }

    /* Option Check */
    .dropdown-option-check {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        /* Figma design uses purple (#7F56D9) for checkmark - design-specific color */
        color: #7F56D9;
    }

    /* Empty State */
    .dropdown-empty {
        padding: var(--ds-space-4);
        text-align: center;
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
    }

    /* Helper Text */
    .dropdown-helper {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
    }

    .dropdown-error-text {
        color: var(--ds-color-error-600);
    }

    .dropdown-success-text {
        color: var(--ds-color-success-600);
    }
</style>
