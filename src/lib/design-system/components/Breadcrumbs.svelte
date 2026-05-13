<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Types
    export type BreadcrumbDivider = 'slash' | 'chevron';

    export interface BreadcrumbItem {
        label: string;
        href?: string;
        icon?: any; // Svelte component
    }

    // Props
    export let items: BreadcrumbItem[] = [];
    export let divider: BreadcrumbDivider = 'slash';
    export let maxItems: number = 0; // 0 = show all, otherwise collapse middle items
    
    const dispatch = createEventDispatcher<{
        click: { item: BreadcrumbItem; index: number };
    }>();

    // Hover state tracking
    let hoveredIndex: number | null = null;

    function handleClick(item: BreadcrumbItem, index: number, e: MouseEvent) {
        if (!item.href) {
            e.preventDefault();
        }
        dispatch('click', { item, index });
    }

    // Compute visible items with ellipsis
    $: visibleItems = (() => {
        if (maxItems <= 0 || items.length <= maxItems) {
            return items.map((item, i) => ({ ...item, originalIndex: i, isEllipsis: false }));
        }
        
        // Show first, ellipsis, and last (maxItems - 1) items
        const firstItem = { ...items[0], originalIndex: 0, isEllipsis: false };
        const ellipsisItem = { label: '...', originalIndex: -1, isEllipsis: true };
        const lastItems = items.slice(-(maxItems - 1)).map((item, i) => ({
            ...item,
            originalIndex: items.length - (maxItems - 1) + i,
            isEllipsis: false
        }));
        
        return [firstItem, ellipsisItem, ...lastItems];
    })();

    $: lastIndex = visibleItems.length - 1;
</script>

<nav aria-label="Breadcrumb" class="breadcrumbs">
    <ol class="breadcrumbs-list">
        {#each visibleItems as item, index (item.originalIndex === -1 ? `ellipsis-${index}` : item.originalIndex)}
            {@const isCurrent = index === lastIndex && !item.isEllipsis}
            {@const isHovered = hoveredIndex === index}
            
            <li class="breadcrumbs-item">
                {#if item.isEllipsis}
                    <!-- Ellipsis -->
                    <span class="breadcrumbs-ellipsis">...</span>
                {:else if isCurrent}
                    <!-- Current/Active item -->
                    <span 
                        class="breadcrumbs-current"
                        class:breadcrumbs-current-hover={isHovered}
                        aria-current="page"
                        on:mouseenter={() => hoveredIndex = index}
                        on:mouseleave={() => hoveredIndex = null}
                    >
                        {#if item.icon}
                            <svelte:component this={item.icon} size={14} strokeWidth={2} />
                        {/if}
                        {item.label}
                    </span>
                {:else}
                    <!-- Link item -->
                    <a 
                        href={item.href || '#'}
                        class="breadcrumbs-link"
                        class:breadcrumbs-link-hover={isHovered}
                        on:click={(e) => handleClick(item, item.originalIndex, e)}
                        on:mouseenter={() => hoveredIndex = index}
                        on:mouseleave={() => hoveredIndex = null}
                    >
                        {#if item.icon}
                            <svelte:component this={item.icon} size={12} strokeWidth={2} />
                        {/if}
                        {item.label}
                    </a>
                {/if}
            </li>

            <!-- Divider (not after last item) -->
            {#if index < lastIndex}
                <li class="breadcrumbs-divider" aria-hidden="true">
                    {#if divider === 'slash'}
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.5 15L12.5 5" stroke="#D0D5DD" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    {:else}
                        <!-- Chevron -->
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.5 5L12.5 10L7.5 15" stroke="#D0D5DD" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    {/if}
                </li>
            {/if}
        {/each}
    </ol>
</nav>

<style>
    .breadcrumbs {
        font-family: var(--ds-font-family-primary);
    }

    .breadcrumbs-list {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        margin: 0;
        gap: 12px;
        list-style: none;
    }

    .breadcrumbs-item {
        display: flex;
        align-items: center;
    }

    .breadcrumbs-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
    }

    /* Non-current link styles */
    .breadcrumbs-link {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 4px;
        padding: 0;
        
        /* Body/12px/12-Medium */
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        
        /* Neutral - True/600 */
        color: var(--ds-color-gray-600);
        
        text-decoration: none;
        transition: color 0.15s ease;
        cursor: pointer;
    }

    .breadcrumbs-link:hover,
    .breadcrumbs-link-hover {
        /* Neutral - True/800 */
        color: #292929;
    }

    .breadcrumbs-link:focus {
        outline: none;
        /* Keep same color as default per Figma */
        color: #525252;
    }

    .breadcrumbs-link:focus-visible {
        outline: 2px solid #6941C6;
        outline-offset: 2px;
        border-radius: 2px;
    }

    /* Current/Active item styles */
    .breadcrumbs-current {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 4px;
        padding: 0;
        
        /* Text sm/Semibold */
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-semibold);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        
        /* Purple 3/700 */
        color: #6941C6;
        
        transition: color 0.15s ease;
    }

    .breadcrumbs-current:hover,
    .breadcrumbs-current-hover {
        /* Purple 3/800 */
        color: #53389E;
    }

    /* Ellipsis styles */
    .breadcrumbs-ellipsis {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 0;
        
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        
        /* Neutral - True/600 */
        color: var(--ds-color-gray-600);
    }
</style>
