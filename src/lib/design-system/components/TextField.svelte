<script context="module" lang="ts">
    // Display types from Figma
    export type TextFieldDisplay = 
        | 'text' 
        | 'text-card' 
        | 'status' 
        | 'multi-badge' 
        | 'multi-chip' 
        | 'avatar' 
        | 'checkbox' 
        | 'radio' 
        | 'file';
</script>

<script lang="ts">
    import Badge from './Badge.svelte';
    import Tag from './Tag.svelte';
    import Avatar from './Avatar.svelte';

    // Props
    export let label: string = 'Label';
    export let value: string | string[] = '';
    export let display: TextFieldDisplay = 'text';
    export let horizontal: boolean = false;
    
    // For status display
    export let statusColor: 'gray' | 'success' | 'warning' | 'error' | 'info' | 'primary' = 'success';
    
    // For badge/chip display
    export let items: Array<{
        label: string;
        count?: number;
        avatar?: string;
        color?: 'gray' | 'success' | 'warning' | 'error' | 'info' | 'primary';
        removable?: boolean;
    }> = [];
    
    // For avatar display
    export let avatars: Array<{
        src?: string;
        name: string;
    }> = [];
    
    // For file display
    export let files: Array<{
        name: string;
        url?: string;
    }> = [];
    
    // For checkbox/radio display
    export let options: Array<{
        label: string;
        checked: boolean;
    }> = [];

    // Value as string for simple displays
    $: displayValue = Array.isArray(value) ? value.join(', ') : value;
    
    // Text weight based on display type
    $: textWeight = display === 'text-card' ? 500 : 400;
</script>

<div 
    class="text-field"
    class:text-field-horizontal={horizontal}
>
    <!-- Label -->
    <div class="text-field-label">
        <span class="label-text">{label}</span>
    </div>

    <!-- Value Content -->
    <div 
        class="text-field-value"
        class:text-field-value-horizontal={horizontal}
    >
        {#if display === 'text' || display === 'text-card'}
            <!-- Simple Text -->
            <span 
                class="value-text"
                style="font-weight: {textWeight};"
            >
                {displayValue}
            </span>

        {:else if display === 'status'}
            <!-- Status Badge -->
            <Badge 
                label={displayValue}
                color={statusColor}
                showDot={true}
            />

        {:else if display === 'multi-badge'}
            <!-- Multiple Badges -->
            <div class="value-badges">
                {#each items as item}
                    <Badge 
                        label={item.label}
                        color={item.color || 'gray'}
                        removable={item.removable}
                        avatar={item.avatar}
                    />
                {/each}
            </div>

        {:else if display === 'multi-chip'}
            <!-- Multiple Chips/Tags -->
            <div class="value-chips">
                {#each items as item}
                    <Tag 
                        label={item.label}
                        count={item.count}
                        avatar={item.avatar}
                        removable={item.removable ?? true}
                    />
                {/each}
            </div>

        {:else if display === 'avatar'}
            <!-- Avatar(s) -->
            <div class="value-avatars">
                {#each avatars as avatar}
                    <Avatar 
                        src={avatar.src}
                        name={avatar.name}
                        showName={true}
                        size="md"
                    />
                {/each}
            </div>

        {:else if display === 'checkbox'}
            <!-- Checkbox Display -->
            <div class="value-checkboxes">
                {#each options as option}
                    <div class="checkbox-item">
                        <div 
                            class="checkbox-display"
                            class:checkbox-checked={option.checked}
                        >
                            {#if option.checked}
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            {/if}
                        </div>
                        <span class="checkbox-label-text">{option.label}</span>
                    </div>
                {/each}
            </div>

        {:else if display === 'radio'}
            <!-- Radio Display -->
            <div class="value-radios">
                {#each options as option}
                    <div class="radio-item">
                        <div 
                            class="radio-display"
                            class:radio-checked={option.checked}
                        >
                            {#if option.checked}
                                <div class="radio-dot" />
                            {/if}
                        </div>
                        <span class="radio-label-text">{option.label}</span>
                    </div>
                {/each}
            </div>

        {:else if display === 'file'}
            <!-- File Links -->
            <div class="value-files">
                {#each files as file}
                    <div class="file-item">
                        <a 
                            href={file.url || '#'} 
                            class="file-link"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {file.name}
                        </a>
                        {#if file.url}
                            <button class="file-download" aria-label="Download {file.name}">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path 
                                        d="M10 3V13M10 13L6 9M10 13L14 9M3 17H17" 
                                        stroke="currentColor" 
                                        stroke-width="2" 
                                        stroke-linecap="round" 
                                        stroke-linejoin="round"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .text-field {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 4px;
    }

    .text-field-horizontal {
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
    }

    /* Label */
    .text-field-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px;
        gap: 2px;
    }

    .label-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    /* Value Container */
    .text-field-value {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .text-field-value-horizontal {
        flex: 1;
        justify-content: flex-end;
    }

    /* Text Value */
    .value-text {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-900);
    }

    .text-field-horizontal .value-text {
        text-align: right;
    }

    /* Multi-value containers */
    .value-badges,
    .value-chips {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        align-content: flex-start;
        gap: 4px 8px;
    }

    .text-field-horizontal .value-badges,
    .text-field-horizontal .value-chips {
        justify-content: flex-end;
    }

    /* Avatars */
    .value-avatars {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
    }

    /* Checkboxes */
    .value-checkboxes {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
    }

    .checkbox-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }

    .checkbox-display {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        background: #FFFFFF;
        border: 1px solid #D6D6D6;
        border-radius: 4px;
        color: #FFFFFF;
    }

    .checkbox-checked {
        background: #0086C9;
        border-color: #0086C9;
    }

    .checkbox-label-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    /* Radios */
    .value-radios {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
    }

    .radio-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }

    .radio-display {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        background: #FFFFFF;
        border: 1px solid #D6D6D6;
        border-radius: 50%;
    }

    .radio-checked {
        border-color: #0086C9;
    }

    .radio-dot {
        width: 8px;
        height: 8px;
        background: #0086C9;
        border-radius: 50%;
    }

    .radio-label-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    /* Files */
    .value-files {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0;
    }

    .file-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        height: 28px;
    }

    .file-link {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-primary-600);
        text-decoration: none;
    }

    .file-link:hover {
        text-decoration: underline;
    }

    .file-download {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 4px;
        
        background: transparent;
        border: none;
        border-radius: 8px;
        
        color: #026AA2;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .file-download:hover {
        background: #F0F9FF;
    }
</style>
