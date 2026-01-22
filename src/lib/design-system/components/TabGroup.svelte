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

    // Container styles based on type
    $: containerStyles = (() => {
        const styles: string[] = [
            'display: flex',
            'flex-direction: row',
            'align-items: flex-end'
        ];

        if (type === 'button') {
            // Button tabs have gap and can have background
            styles.push('gap: 4px');
            styles.push('padding: 4px');
            styles.push('background: #F9FAFB');
            styles.push('border-radius: 8px');
            if (fullWidth) {
                styles.push('width: 100%');
            }
        } else {
            // Underline tabs always full width with border at bottom
            styles.push('gap: 24px');
            styles.push('border-bottom: 1px solid #EAECF0');
            styles.push('position: relative');
            styles.push('width: 100%'); // Always full width for underline type
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
            class:full-width={fullWidth}
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

    .tab-wrapper {
        flex: none;
    }

    .tab-wrapper.full-width {
        flex: 1;
    }

    .tab-wrapper.full-width :global(button) {
        width: 100%;
    }
</style>
