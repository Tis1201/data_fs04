<script context="module" lang="ts">
    export type ToggleSize = 'sm' | 'md';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // ==========================================================================
    // PROPS
    // ==========================================================================

    export let checked: boolean = false;
    export let size: ToggleSize = 'md';
    export let disabled: boolean = false;
    export let label: string = '';
    export let supportingText: string = '';
    export let labelPosition: 'left' | 'right' = 'right';
    export let id: string = '';

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    const dispatch = createEventDispatcher<{
        change: boolean;
    }>();

    // ==========================================================================
    // STATE
    // ==========================================================================

    let isHovered = false;

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    function handleToggle() {
        if (disabled) return;
        checked = !checked;
        dispatch('change', checked);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle();
        }
    }

    // ==========================================================================
    // FIGMA SPECS
    // ==========================================================================

    // Sizes from Figma
    const sizeConfig = {
        sm: {
            track: 'w-9 h-5',      // 36x20px
            knob: 'w-4 h-4',       // 16x16px
            translateOn: 'translate-x-4', // 36 - 16 - 4 = 16px
            gap: 'gap-2',          // 8px
            text: 'text-[14px] leading-[20px]',
            supporting: 'text-[14px] leading-[20px]'
        },
        md: {
            track: 'w-11 h-6',     // 44x24px
            knob: 'w-5 h-5',       // 20x20px
            translateOn: 'translate-x-5', // 44 - 20 - 4 = 20px
            gap: 'gap-3',          // 12px
            text: 'text-[16px] leading-[24px]',
            supporting: 'text-[16px] leading-[24px]'
        }
    };

    // Colors from Figma
    // OFF: Default #E5E5E5, Hover #A3A3A3, Disabled #E5E5E5
    // ON: Default #155EEF, Hover #0040C1, Disabled #D1E0FF
    // Knob: Normal #FFFFFF, Disabled #FAFAFA

    $: trackColor = (() => {
        if (disabled) {
            return checked ? 'bg-[#D1E0FF]' : 'bg-[#E5E5E5]';
        }
        if (isHovered) {
            return checked ? 'bg-[#0040C1]' : 'bg-[#A3A3A3]';
        }
        return checked ? 'bg-[#155EEF]' : 'bg-[#E5E5E5]';
    })();

    $: knobColor = disabled ? 'bg-[#FAFAFA]' : 'bg-white';

    $: config = sizeConfig[size];

    // Shadow from Figma: Shadow/sm
    const knobShadow = '0px 1px 3px rgba(16, 24, 40, 0.1), 0px 1px 2px rgba(16, 24, 40, 0.06)';
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div 
    class="inline-flex items-center {config.gap} {labelPosition === 'left' ? 'flex-row-reverse' : ''}"
    class:cursor-pointer={!disabled}
    class:cursor-not-allowed={disabled}
    on:click={handleToggle}
>
    <!-- Toggle Track -->
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        {id}
        class="
            relative inline-flex items-center p-0.5
            {config.track}
            {trackColor}
            rounded-xl
            transition-colors duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D6BBFB] focus-visible:ring-offset-2
        "
        class:justify-end={checked}
        disabled={disabled}
        on:mouseenter={() => isHovered = true}
        on:mouseleave={() => isHovered = false}
        on:keydown={handleKeydown}
    >
        <!-- Knob -->
        <span 
            class="
                {config.knob}
                {knobColor}
                rounded-full
                transition-transform duration-200
            "
            style="box-shadow: {knobShadow};"
        />
    </button>

    <!-- Label -->
    {#if label || supportingText}
        <div class="flex flex-col">
            {#if label}
                <span 
                    class="
                        {config.text}
                        font-medium
                        toggle-label
                    "
                    class:opacity-50={disabled}
                >
                    {label}
                </span>
            {/if}
            {#if supportingText}
                <span 
                    class="
                        {config.supporting}
                        font-normal
                        toggle-supporting
                    "
                    class:opacity-50={disabled}
                >
                    {supportingText}
                </span>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Toggle label and supporting text using design system tokens */
    .toggle-label {
        font-family: var(--ds-font-family-primary);
        color: var(--ds-text-primary);
    }
    
    .toggle-supporting {
        font-family: var(--ds-font-family-primary);
        color: var(--ds-text-tertiary);
    }
</style>
