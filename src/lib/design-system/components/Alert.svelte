<script context="module" lang="ts">
    export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';
    export type AlertVariant = 'outline' | 'filled';
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Info, CheckCheck, AlertTriangle, AlertCircle, X } from 'lucide-svelte';
    
    // Props
    export let severity: AlertSeverity = 'info';
    export let variant: AlertVariant = 'outline';
    export let title: string = '';
    export let message: string = 'Alert content';
    export let dismissible: boolean = true;
    export let visible: boolean = true;
    
    const dispatch = createEventDispatcher<{
        dismiss: void;
    }>();
    
    // Severity configuration
    const severityConfig = {
        info: {
            outline: {
                background: '#FAFAFA', // Neutral - True/50 (from Figma Frame 34)
                iconColor: '#525252', // Neutral - True/600 (from Figma Vector border)
                textColor: '#292929', // Neutral - True/800
                closeColor: '#737373'
            },
            filled: {
                background: '#155EEF',
                iconColor: '#FFFFFF',
                textColor: '#FFFFFF',
                closeColor: '#FFFFFF'
            },
            icon: Info
        },
        success: {
            outline: {
                background: '#D1FADF',
                iconColor: '#039855',
                textColor: '#292929',
                closeColor: '#737373'
            },
            filled: {
                background: '#039855',
                iconColor: '#FFFFFF',
                textColor: '#FFFFFF',
                closeColor: '#FFFFFF'
            },
            icon: CheckCheck
        },
        warning: {
            outline: {
                background: '#FEF0C7',
                iconColor: '#DC6803',
                textColor: '#292929',
                closeColor: '#737373'
            },
            filled: {
                background: '#DC6803',
                iconColor: '#FFFFFF',
                textColor: '#FFFFFF',
                closeColor: '#FFFFFF'
            },
            icon: AlertTriangle
        },
        error: {
            outline: {
                background: '#FEE4E2',
                iconColor: '#D92D20',
                textColor: '#292929',
                closeColor: '#737373'
            },
            filled: {
                background: '#D92D20',
                iconColor: '#FFFFFF',
                textColor: '#FFFFFF',
                closeColor: '#FFFFFF'
            },
            icon: AlertCircle
        }
    };
    
    $: config = severityConfig[severity][variant];
    $: IconComponent = severityConfig[severity].icon;
    $: hasTitle = !!title;
    
    function handleDismiss() {
        visible = false;
        dispatch('dismiss');
    }
</script>

{#if visible}
    <div 
        class="alert"
        role="alert"
        style="
            --alert-bg: {config.background};
            --alert-icon-color: {config.iconColor};
            --alert-text-color: {config.textColor};
            --alert-close-color: {config.closeColor};
        "
    >
        <div class="alert-content">
            <!-- Icon -->
            <span class="alert-icon">
                <svelte:component this={IconComponent} size={20} strokeWidth={2} />
            </span>
            
            <!-- Text -->
            <div class="alert-text" class:has-title={hasTitle}>
                {#if hasTitle}
                    <span class="alert-title">{title}</span>
                {/if}
                {#if message}
                    <span class="alert-message">{message}</span>
                {/if}
                <!-- Slot for custom content (e.g., bullet points) -->
                <slot />
            </div>
            
            <!-- Close button -->
            {#if dismissible}
                <button 
                    type="button" 
                    class="alert-close"
                    on:click={handleDismiss}
                    aria-label="Dismiss alert"
                >
                    <X size={20} strokeWidth={2} />
                </button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .alert {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        max-width: 100%; /* Remove max-width constraint for full width in modal */
        background: var(--alert-bg);
        box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
        border-radius: var(--ds-radius-lg); /* 8px from Figma Frame 34 */
    }
    
    .alert-content {
        display: flex;
        flex-direction: row;
        align-items: flex-start; /* Changed from center to flex-start so slot content displays correctly */
        padding: var(--ds-space-3); /* 12px from Figma Frame 34 */
        gap: var(--ds-space-2); /* 8px from Figma Frame 34 */
        width: 100%;
        box-sizing: border-box;
    }
    
    .alert-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: var(--alert-icon-color);
    }
    
    .alert-text {
        display: flex;
        flex-direction: column;
        justify-content: flex-start; /* Changed from center to flex-start so slot content displays correctly */
        align-items: flex-start;
        padding: 0;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }
    
    .alert-title {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-semibold); /* 600 from Figma "Need help finding your device PIN?" */
        font-size: var(--ds-text-sm); /* 14px from Figma */
        line-height: var(--ds-leading-sm); /* 20px from Figma */
        color: var(--alert-text-color);
    }
    
    .alert-message {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--alert-text-color);
        word-break: break-word;
    }
    
    /* Slot content styling - from Figma Frame 34 content */
    .alert-text :global(ul),
    .alert-text :global(ol) {
        margin: var(--ds-space-2) 0 0 0;
        padding-left: var(--ds-space-5);
        list-style: disc;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm); /* 14px from Figma */
        line-height: var(--ds-leading-sm); /* 20px from Figma */
        color: var(--ds-color-neutral-true-500); /* #737373 from Figma content text */
    }
    
    .alert-text :global(li) {
        margin-bottom: var(--ds-space-1);
    }
    
    .alert-text :global(li:last-child) {
        margin-bottom: 0;
    }
    
    .alert-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--alert-close-color);
        cursor: pointer;
        transition: opacity 0.15s ease;
    }
    
    .alert-close:hover {
        opacity: 0.8;
    }
    
    .alert-close:focus {
        outline: none;
        opacity: 0.8;
    }
</style>
