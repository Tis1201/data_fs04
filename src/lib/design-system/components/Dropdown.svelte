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
    export let errorMessage: string = '';
    export let helperText: string = '';
    export let maxHeight: number = 300;
    export let width: string = '100%';

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

    $: displayValue = multiple
        ? (selectedOptions as DropdownOption[])?.map(o => o.label).join(', ') || ''
        : (selectedOptions as DropdownOption)?.label || '';

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

        if (option.type === 'toggle') {
            const newChecked = !option.checked;
            dispatch('toggle', { option, checked: newChecked });
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
        class:dropdown-trigger-disabled={disabled}
        class:dropdown-trigger-chips={multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0}
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
        {:else}
            <span class="dropdown-trigger-text" class:placeholder={!displayValue}>
                {displayValue || placeholder}
            </span>
        {/if}

        <div class="dropdown-trigger-actions">
            {#if displayValue && !disabled && !multiple}
                <!-- Clear Button - dùng Button component từ design-system -->
                <Button
                    variant="ghost"
                    size="sm"
                    iconOnly={true}
                    icon={X}
                    iconSize={16}
                    on:click={() => clearSelection()}
                    aria-label="Clear selection"
                    class="dropdown-clear"
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
            style="max-height: {maxHeight}px;"
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
                                    checked={selectedSet.has(option.id)} 
                                    disabled={option.disabled}
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
                            <Toggle 
                                size="sm" 
                                checked={option.checked || false}
                                disabled={option.disabled}
                            />
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

    <!-- Helper/Error Text -->
    {#if error && errorMessage}
        <div class="dropdown-helper dropdown-error-text">
            {errorMessage}
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
        gap: 6px;
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
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #344054;
    }

    .label-required {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #D92D20;
    }

    /* Trigger */
    .dropdown-trigger {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        background: #FFFFFF;
        border: 1px solid #D0D5DD;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
        text-align: left;
    }

    .dropdown-trigger:hover:not(.dropdown-trigger-disabled) {
        border-color: #98A2B3;
    }

    .dropdown-trigger:focus {
        outline: none;
        border-color: #7F56D9;
        box-shadow: 0 0 0 4px rgba(127, 86, 217, 0.24);
    }

    .dropdown-trigger-open {
        border-color: #7F56D9;
        box-shadow: 0 0 0 4px rgba(127, 86, 217, 0.24);
    }

    .dropdown-trigger-error {
        border-color: #FDA29B;
    }

    .dropdown-trigger-error:focus {
        border-color: #F04438;
        box-shadow: 0 0 0 4px rgba(240, 68, 56, 0.24);
    }

    .dropdown-trigger-disabled {
        background: #F9FAFB;
        border-color: #D0D5DD;
        cursor: not-allowed;
    }

    .dropdown-trigger-text {
        flex: 1;
        font-weight: 400;
        font-size: 16px;
        line-height: 24px;
        color: #101828;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown-trigger-text.placeholder {
        color: #667085;
    }

    .dropdown-trigger-disabled .dropdown-trigger-text {
        color: #667085;
    }

    /* Tags for multiple selection */
    .dropdown-trigger-chips {
        flex-wrap: wrap;
        min-height: 48px;
        padding: 8px 14px;
        align-items: center;
    }

    .dropdown-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        flex: 1;
        align-items: center;
    }

    .dropdown-trigger-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .dropdown-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: none;
        border: none;
        cursor: pointer;
        color: #667085;
        border-radius: 4px;
    }

    .dropdown-clear:hover {
        color: #344054;
        background: #F2F4F7;
    }

    .dropdown-chevron {
        display: flex;
        align-items: center;
        color: #667085;
    }

    /* Menu */
    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 100; /* Higher than modal (50) */
        margin-top: 4px;
        background: #FFFFFF;
        border: 1px solid #EAECF0;
        border-radius: 8px;
        box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
        overflow: hidden;
    }

    /* Search */
    .dropdown-search {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid #EAECF0;
        color: #667085;
    }

    .dropdown-search-input {
        flex: 1;
        border: none;
        outline: none;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
        background: transparent;
    }

    .dropdown-search-input::placeholder {
        color: #667085;
    }

    /* Options */
    .dropdown-options {
        overflow-y: auto;
        padding: 4px;
    }

    .dropdown-options::-webkit-scrollbar {
        width: 16px;
    }

    .dropdown-options::-webkit-scrollbar-track {
        background: #FAFAFA;
    }

    .dropdown-options::-webkit-scrollbar-thumb {
        background: #E5E5E5;
        border-radius: 8px;
        border: 4px solid #FAFAFA;
    }

    /* Option Item */
    .dropdown-option {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 16px;
        gap: 12px;
        min-height: 54px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .dropdown-option:hover:not(.dropdown-option-disabled),
    .dropdown-option-hover:not(.dropdown-option-disabled) {
        background: #FAFAFA;
    }

    .dropdown-option-selected:not(.dropdown-option-disabled) {
        background: #F9F5FF;
    }

    .dropdown-option-disabled {
        cursor: not-allowed;
    }

    /* Option Icon */
    .dropdown-option-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        color: #292929;
    }

    .dropdown-option-icon.icon-disabled {
        color: #D6D6D6;
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
        background: #12B76A;
        border: 1.5px solid #FFFFFF;
        border-radius: 4px;
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
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #292929;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown-option:hover:not(.dropdown-option-disabled) .dropdown-option-text,
    .dropdown-option-hover:not(.dropdown-option-disabled) .dropdown-option-text {
        color: #141414;
    }

    .dropdown-option-text.text-disabled {
        color: #D6D6D6;
    }

    .dropdown-option-supporting {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #667085;
    }

    .dropdown-option-supporting.supporting-disabled {
        color: #D0D5DD;
    }

    /* Option Check */
    .dropdown-option-check {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        color: #7F56D9;
    }

    /* Empty State */
    .dropdown-empty {
        padding: 16px;
        text-align: center;
        font-size: 14px;
        line-height: 20px;
        color: #667085;
    }

    /* Helper Text */
    .dropdown-helper {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #667085;
    }

    .dropdown-error-text {
        color: #D92D20;
    }
</style>
