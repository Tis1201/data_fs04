<script context="module" lang="ts">
    export interface TabItem {
        id: string;
        label: string;
        badge?: number | null;
        disabled?: boolean;
    }
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Tab from './Tab.svelte';
    import type { TabType, TabSize } from './Tab.svelte';

    // Props
    export let tabs: TabItem[] = [];
    export let activeTab: string = '';
    export let type: TabType = 'button';
    export let size: TabSize = 'sm';
    export let fullWidth: boolean = false;

    const dispatch = createEventDispatcher<{ change: string }>();

    function handleTabClick(tabId: string) {
        if (activeTab !== tabId) {
            activeTab = tabId;
            dispatch('change', tabId);
        }
    }

    // Container styles (Figma Frame 39: align-items flex-start, gap 24px, height 48px, border-bottom)
    $: containerStyles = (() => {
        const styles: string[] = [
            'display: flex',
            'flex-direction: row',
            'align-items: flex-start',
            'justify-content: flex-start'
        ];

        if (type === 'button') {
            styles.push('gap: 4px');
            styles.push('padding: 4px');
            styles.push('background: var(--ds-bg-secondary)');
            styles.push('border-radius: var(--ds-radius-lg)');
            if (fullWidth) {
                styles.push('width: 100%');
            }
        } else {
            styles.push('gap: var(--ds-space-6)');
            styles.push('border-bottom: 1px solid var(--ds-color-gray-200)');
            styles.push('height: 48px');
            styles.push('min-height: 48px');
            styles.push('position: relative');
            styles.push('width: 100%');
            styles.push('overflow-x: auto');
            styles.push('overflow-y: hidden');
            styles.push('-webkit-overflow-scrolling: touch');
        }

        return styles.join('; ');
    })();
</script>

<div 
    class="tab-group"
    style={containerStyles}
    role="tablist"
>
    {#each tabs as tab (tab.id)}
        <div 
            class="tab-wrapper"
            class:full-width={fullWidth && type === 'button'}
            class:underline-type={type === 'underline' || type === 'underline-filled'}
            role="presentation"
        >
            <Tab
                label={tab.label}
                {type}
                {size}
                current={activeTab === tab.id}
                badge={tab.badge ?? null}
                disabled={tab.disabled ?? false}
                on:click={() => handleTabClick(tab.id)}
            />
        </div>
    {/each}
</div>

<style>
    .tab-group {
        font-family: var(--ds-font-family-primary);
    }

    /* Hide scrollbar but keep functionality */
    .tab-group::-webkit-scrollbar {
        height: 4px;
    }

    .tab-group::-webkit-scrollbar-track {
        background: transparent;
    }

    .tab-group::-webkit-scrollbar-thumb {
        background: var(--ds-color-gray-300);
        border-radius: var(--ds-radius-sm);
    }

    .tab-group::-webkit-scrollbar-thumb:hover {
        background: var(--ds-color-gray-400);
    }

    /* Firefox scrollbar */
    .tab-group {
        scrollbar-width: thin;
        scrollbar-color: var(--ds-color-gray-300) transparent;
    }

    .tab-wrapper {
        flex: none;
        min-width: fit-content; /* Prevent tabs from shrinking too much */
    }

    /* Underline types: wrapper fills full height so tabs align on one row with tab group border */
    .tab-wrapper.underline-type {
        height: 100%;
        display: flex;
        align-items: stretch;
    }

    .tab-wrapper.underline-type :global(button) {
        flex: 1;
        min-height: 0;
        height: 100% !important; /* Override Tab inline height so tab aligns with tab group border */
    }

    .tab-wrapper.full-width {
        flex: 1;
        min-width: 0; /* Allow shrinking when full-width */
    }

    .tab-wrapper.full-width :global(button) {
        width: 100%;
    }
</style>
