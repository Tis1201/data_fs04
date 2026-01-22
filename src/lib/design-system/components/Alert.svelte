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
                background: '#F5F8FF',
                iconColor: '#004EEB',
                textColor: '#292929',
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
                <span class="alert-message">{message}</span>
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
        max-width: 360px;
        background: var(--alert-bg);
        box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
        border-radius: 4px;
    }
    
    .alert-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 12px 8px 16px;
        gap: 8px;
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
        justify-content: center;
        align-items: flex-start;
        padding: 0;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }
    
    .alert-title {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
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
