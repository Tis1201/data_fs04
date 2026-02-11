<script context="module" lang="ts">
    // ==========================================================================
    // TYPES (exported from module context)
    // ==========================================================================

    export type CellType = 
        | 'text' 
        | 'textWithSupporting'
        | 'number' 
        | 'rowNumber'
        | 'date' 
        | 'datetime'
        | 'relativeTime'
        | 'status' 
        | 'badge'
        | 'badgeOutline'
        | 'multiBadge'
        | 'multiTag'
        | 'chip'
        | 'usageIndicators'
        | 'avatar' 
        | 'avatarWithName'
        | 'file'
        | 'payment'
        | 'progress'
        | 'toggle'
        | 'pin'
        | 'actions'
        | 'moreMenu'
        | 'link'
        | 'custom';

    export type SortDirection = 'asc' | 'desc' | null;

    export interface ColumnDef<T = any> {
        id: string;
        header: string;
        accessor?: keyof T | ((row: T) => any);
        type?: CellType;
        sortable?: boolean;
        disabled?: boolean; // Disabled header state
        helpTooltip?: string; // Help icon tooltip
        /** When true, shows column filter icon (chevrons-up-down) in header. Only show when filter UI is configured. */
        filterable?: boolean;
        width?: string;
        minWidth?: string;
        maxWidth?: string;
        align?: 'left' | 'center' | 'right';
        
        // For text with supporting
        supportingField?: string;
        
        // For badge/status cells (using BadgeColor from design system)
        statusColor?: (value: any, row: T) => 'gray' | 'error' | 'warning' | 'yellow' | 'success' | 'teal' | 'blue-light' | 'blue' | 'indigo' | 'purple' | 'pink' | 'rose';
        /** When set, controls dot on badge. Active/Inactive = dot, Online/Offline = no dot. Default: false for badge, true for status (legacy). */
        showDot?: (value: any, row: T) => boolean;
        
        // For avatar cells
        avatarField?: string;
        nameField?: string;
        emailField?: string;
        
        // For multiBadge / multiTag cells
        badgesField?: string; // Field containing array of badge labels
        tagsField?: string;   // Field containing array of tag labels
        maxItems?: number;    // Max items to show before "+N" (default: 3)
        
        // For chip cell (single chip with dot + count)
        dotColor?: string;    // Dot color (default: #12B76A green)
        countField?: string;  // Field for count badge
        
        // For file cell
        fileIconColor?: string; // Icon color (default: #7F56D9)
        
        // For progress cell
        progressField?: string; // Field containing progress value (0-100)
        showProgressValue?: boolean; // Show percentage value
        
        // For toggle cell
        toggleField?: string; // Field containing boolean toggle state
        onToggle?: (row: T, newValue: boolean) => void;
        
        // For usageIndicators cell (CPU/MEM/DSK with colored dots)
        usageFields?: { label: string; field: string; thresholds?: { warning: number; danger: number } }[];
        
        // For pin cell
        pinField?: string; // Field containing boolean pin state
        onPin?: (row: T, newValue: boolean) => void;
        
        // For moreMenu cell
        menuActions?: ActionDef<T>[];
        /** When set, builds menu actions per row (e.g. from row status). Overrides menuActions when present. */
        getMenuActions?: (row: T) => ActionDef<T>[];
        
        // For action cells
        actions?: ActionDef<T>[];
        
        // For custom render
        render?: (value: any, row: T, rowIndex: number) => any;
    }

    export interface ActionDef<T = any> {
        id: string;
        label?: string;
        icon?: any;
        variant?: 'filled' | 'outline' | 'text' | 'ghost';
        color?: 'primary' | 'gray' | 'danger';
        destructive?: boolean;
        onClick?: (row: T) => void;
        href?: string | ((row: T) => string);
        disabled?: (row: T) => boolean;
        hidden?: (row: T) => boolean;
        tooltip?: string;
    }

    export interface PaginationState {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    }

    export interface SortState {
        field: string | null;
        direction: SortDirection;
    }

    // ==========================================================================
    // FIGMA TABLE SPECS (match IoT devices table: DeviceTable thead #F5F5F5)
    // ==========================================================================
    // Header Cell: bg --ds-color-neutral-true-100 (#F5F5F5), h 44px, p 12px 24px, gap 12px, border-b --ds-border-default
    // All colors use design tokens (--ds-*). Header/row/empty/pagination match design system.
    // Header Text: --ds-text-secondary; Data Cell: --ds-bg-primary, border --ds-border-default
    // Primary/Supporting text: --ds-text-primary, --ds-text-secondary; Row hover: --ds-bg-secondary; Row selected: --ds-color-primary-25
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, CreditCard, HelpCircle, ArrowUp, ArrowDown, Pin } from 'lucide-svelte';
    import { formatTableDateTime } from '$lib/utils/format';
    import Checkbox from './Checkbox.svelte';
    import Badge from './Badge.svelte';
    import Tag from './Tag.svelte';
    import Avatar from './Avatar.svelte';
    import Button from './Button.svelte';
    import ActionMenu from './ActionMenu.svelte';
    import Tooltip from './Tooltip.svelte';

    // ==========================================================================
    // PROPS
    // ==========================================================================

    export let columns: ColumnDef[] = [];
    export let data: any[] = [];
    export let keyField: string = 'id';
    
    // Selection
    export let selectable: boolean = false;
    export let selectedRows: any[] = [];
    export let selectAllEnabled: boolean = true;
    /** Checkbox column width: CSS value. Match DeviceTable (w-12 = 48px) for consistent look. */
    export let checkboxColumnWidth: string = '48px';

    // Sorting
    export let sortable: boolean = true;
    export let sort: SortState = { field: null, direction: null };

    // Pagination
    export let paginated: boolean = false;
    export let pagination: PaginationState = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0
    };
    export let pageSizeOptions: number[] = [10, 25, 50, 100];

    // Loading
    export let loading: boolean = false;

    // Appearance
    export let striped: boolean = false;
    export let hoverable: boolean = true;
    export let bordered: boolean = true;
    /** When false, th/td have no border-bottom (for borderless table design). */
    export let cellBorders: boolean = true;
    export let compact: boolean = false;
    export let stickyHeader: boolean = false;
    export let emptyMessage: string = 'No data available';

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    const dispatch = createEventDispatcher<{
        sort: SortState;
        pageChange: number;
        pageSizeChange: number;
        rowClick: { row: any; index: number };
        selectionChange: any[];
        action: { actionId: string; row: any };
    }>();

    // ==========================================================================
    // COMPUTED VALUES
    // ==========================================================================

    $: allSelected = data.length > 0 && selectedRows.length === data.length;
    $: someSelected = selectedRows.length > 0 && selectedRows.length < data.length;
    
    // Reactive Set for faster lookup and proper Svelte reactivity
    $: selectedKeySet = new Set(selectedRows.map(r => r[keyField]));

    /** Only one Actions (moreMenu) dropdown open at a time; key = row[keyField] ?? rowIndex */
    let openMoreMenuKey: string | number | null = null;

    // ==========================================================================
    // FUNCTIONS
    // ==========================================================================

    function getCellValue(row: any, column: ColumnDef): any {
        if (column.accessor) {
            if (typeof column.accessor === 'function') {
                return column.accessor(row);
            }
            return row[column.accessor];
        }
        return row[column.id];
    }

    function handleSort(column: ColumnDef) {
        if (!sortable || !column.sortable) return;
        
        const field = column.id;
        let direction: SortDirection = 'asc';
        
        if (sort.field === field) {
            if (sort.direction === 'asc') {
                direction = 'desc';
            } else if (sort.direction === 'desc') {
                direction = null;
            }
        }
        
        sort = { field: direction ? field : null, direction };
        dispatch('sort', sort);
    }

    function handleSelectAll() {
        if (allSelected) {
            selectedRows = [];
        } else {
            selectedRows = [...data];
        }
        dispatch('selectionChange', selectedRows);
    }

    function handleSelectRow(row: any) {
        const key = row[keyField];
        const index = selectedRows.findIndex(r => r[keyField] === key);
        
        if (index >= 0) {
            selectedRows = selectedRows.filter(r => r[keyField] !== key);
        } else {
            selectedRows = [...selectedRows, row];
        }
        dispatch('selectionChange', selectedRows);
    }

    function isRowSelected(row: any): boolean {
        // Use the reactive Set for proper dependency tracking
        return selectedKeySet.has(row[keyField]);
    }

    function handleRowClick(row: any, index: number) {
        dispatch('rowClick', { row, index });
    }

    function handlePageChange(newPage: number) {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        dispatch('pageChange', newPage);
    }

    function handlePageSizeChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const newSize = parseInt(target.value, 10);
        dispatch('pageSizeChange', newSize);
    }

    /** Build pagination page slots: [1, 2, 3, '...', 8, 9, 10] per Figma */
    function getPaginationPages(): (number | 'ellipsis')[] {
        const total = pagination.totalPages;
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        return [1, 2, 3, 'ellipsis', total - 2, total - 1, total];
    }

    $: paginationPages = paginated && pagination.totalPages > 0 ? getPaginationPages() : [];

    function formatDate(value: any): string {
        return formatTableDateTime(value);
    }

    function formatDateTime(value: any): string {
        return formatTableDateTime(value);
    }

    function formatNumber(value: any): string {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat().format(value);
    }

    function formatRelativeTime(dateValue: any): string {
        if (!dateValue) return '-';
        const date = new Date(dateValue);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ==========================================================================
    // FIGMA-ACCURATE STYLES
    // ==========================================================================

    $: tableClasses = [
        'w-full',
        'border-collapse',
        'table-fixed'
    ].filter(Boolean).join(' ');

    // Header cell: match DeviceTable (Devices) — h=44px, padding 12px 16px, bg #F5F5F5, border-b, hover on sortable
    $: headerCellClasses = [
        'h-[44px] px-4 py-3',
        'text-left',
        'bg-[var(--ds-color-neutral-true-100)]',
        cellBorders ? 'border-b border-[var(--ds-border-default)]' : '',
        stickyHeader ? 'sticky top-0 z-10' : ''
    ].filter(Boolean).join(' ');

    // Header text: 12px medium, --ds-text-secondary
    const headerTextClasses = 'text-[12px] font-medium leading-[18px] text-[var(--ds-text-secondary)]';

    // Data cell: match DeviceTable — h=72px, padding 16px, bg=--ds-bg-primary, border-b=--ds-border-default
    $: bodyCellClasses = [
        compact ? 'h-[52px] px-4 py-2' : 'h-[72px] px-4 py-4',
        'bg-[var(--ds-bg-primary)]',
        cellBorders ? 'border-b border-[var(--ds-border-default)]' : '',
        'align-middle'
    ].filter(Boolean).join(' ');

    // Primary text: 14px medium, --ds-text-primary
    const primaryTextClasses = 'text-[14px] font-medium leading-[20px] text-[var(--ds-text-primary)]';
    // Supporting text: 14px regular, --ds-text-secondary
    const supportingTextClasses = 'text-[14px] font-normal leading-[20px] text-[var(--ds-text-secondary)]';

    function getRowClasses(index: number, row: any, isSelected: boolean): string {
        return [
            isSelected ? 'bg-[var(--ds-color-primary-25)]' : 'bg-[var(--ds-bg-primary)]',
            hoverable && !isSelected ? 'hover:bg-[var(--ds-bg-secondary)] cursor-pointer' : '',
            striped && index % 2 === 1 && !isSelected ? 'bg-[var(--ds-bg-secondary)]' : '',
            'transition-colors'
        ].filter(Boolean).join(' ');
    }

</script>

<div class="ds-datatable overflow-hidden rounded-lg {bordered ? 'border border-[var(--ds-border-default)] shadow-sm' : ''} {!cellBorders ? 'dt-no-cell-borders' : ''}" style="--ds-datatable-checkbox-width: {checkboxColumnWidth};">
    <!-- Table Container -->
    <div class="overflow-x-auto">
        <table class="{tableClasses}">
            <!-- Colgroup: fix checkbox column width so table-layout:fixed respects it -->
            <colgroup>
                {#if selectable}
                    <col style="width: {checkboxColumnWidth}; min-width: {checkboxColumnWidth}; max-width: {checkboxColumnWidth};" />
                {/if}
                {#each columns as column}
                    <col style="{column.width ? `width: ${column.width};` : ''}{column.minWidth ? `min-width: ${column.minWidth};` : ''}{column.maxWidth ? `max-width: ${column.maxWidth};` : ''}" />
                {/each}
            </colgroup>
            <!-- Header -->
            <thead>
                <tr>
                    {#if selectable}
                        <th class="{headerCellClasses} ds-datatable-checkbox-col" data-ds-checkbox-col style="width: {checkboxColumnWidth}; min-width: {checkboxColumnWidth}; max-width: {checkboxColumnWidth};">
                            {#if selectAllEnabled}
                                <div class="flex items-center justify-center">
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={someSelected}
                                        size="md"
                                        on:change={handleSelectAll}
                                    />
                                </div>
                            {/if}
                        </th>
                    {/if}
                    {#each columns as column}
                        {@const isDisabled = column.disabled}
                        {@const isSorted = sort.field === column.id && sort.direction !== null}
                        {@const textColor = isDisabled ? 'text-[var(--ds-text-disabled)]' : 'text-[var(--ds-text-secondary)] group-hover:text-[var(--ds-color-gray-700)]'}
                        {@const iconColor = isDisabled ? 'text-[var(--ds-text-disabled)]' : 'text-[var(--ds-text-secondary)] group-hover:text-[var(--ds-color-gray-700)]'}
                        {@const helpIconColor = isDisabled ? 'text-[var(--ds-text-disabled)]' : 'text-[var(--ds-text-placeholder)]'}
                        <th 
                            class="{headerCellClasses} group {sortable && column.sortable && !isDisabled ? 'hover:bg-[var(--ds-color-neutral-true-50)] transition-colors' : ''}"
                            style="{column.width ? `width: ${column.width};` : ''}{column.minWidth ? `min-width: ${column.minWidth};` : ''}{column.maxWidth ? `max-width: ${column.maxWidth};` : ''}"
                            class:cursor-pointer={sortable && column.sortable && !isDisabled}
                            class:select-none={sortable && column.sortable}
                            class:cursor-not-allowed={isDisabled}
                            on:click={() => !isDisabled && handleSort(column)}
                        >
                            <!-- Figma Header: flex, gap 4px, items-center -->
                            <div 
                                class="flex items-center gap-1" 
                                class:justify-center={column.align === 'center'} 
                                class:justify-end={column.align === 'right'}
                            >
                                <!-- Header Text: Poppins 14px/500, lh 20px -->
                                <span class="text-[14px] font-medium leading-[20px] {textColor}">
                                    {column.header}
                                </span>
                                
                                <!-- Help Icon (optional): 16x16, gray/400 -->
                                {#if column.helpTooltip}
                                    <button 
                                        type="button"
                                        class="flex-shrink-0"
                                        title={column.helpTooltip}
                                        on:click|stopPropagation
                                    >
                                        <HelpCircle class="w-4 h-4 {helpIconColor}" stroke-width={1.4} />
                                    </button>
                                {/if}
                                
                                <!-- Sort direction arrows: only when column is sortable and sorted -->
                                {#if sortable && column.sortable && isSorted}
                                    {#if sort.direction === 'desc'}
                                        <ArrowDown class="w-4 h-4 flex-shrink-0 {iconColor}" stroke-width={1.33} />
                                    {:else}
                                        <ArrowUp class="w-4 h-4 flex-shrink-0 {iconColor}" stroke-width={1.33} />
                                    {/if}
                                {/if}
                                <!-- Column filter icon: only when column has filter config (filterable) -->
                                {#if column.filterable}
                                    <ChevronsUpDown class="w-4 h-4 flex-shrink-0 {iconColor}" stroke-width={1.33} />
                                {/if}
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            
            <!-- Body -->
            <tbody>
                {#if loading}
                    <!-- Loading State -->
                    {#each Array(5) as _, i}
                        <tr class="bg-[var(--ds-bg-primary)]">
                            {#if selectable}
                                <td class="{bodyCellClasses} ds-datatable-checkbox-col" data-ds-checkbox-col style="width: {checkboxColumnWidth}; min-width: {checkboxColumnWidth}; max-width: {checkboxColumnWidth};">
                                    <div class="flex items-center justify-center">
                                        <div class="h-5 w-5 bg-[var(--ds-bg-tertiary)] rounded-md animate-pulse" />
                                    </div>
                                </td>
                            {/if}
                            {#each columns as column}
                                <td class="{bodyCellClasses}">
                                    <div class="h-5 bg-[var(--ds-bg-tertiary)] rounded animate-pulse" style="width: {Math.random() * 40 + 40}%" />
                                </td>
                            {/each}
                        </tr>
                    {/each}
                {:else if data.length === 0}
                    <!-- Empty State -->
                    <tr>
                        <td 
                            colspan={columns.length + (selectable ? 1 : 0)}
                            class="px-6 py-16 text-center bg-white"
                        >
                            <div class="flex flex-col items-center gap-3">
                                <svg class="h-12 w-12 text-[var(--ds-text-placeholder)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <span class="text-[14px] font-medium text-[var(--ds-text-secondary)]">{emptyMessage}</span>
                            </div>
                        </td>
                    </tr>
                {:else}
                    <!-- Data Rows -->
                    {#each data as row, rowIndex (row[keyField] ?? rowIndex)}
                        {@const rowSelected = selectedKeySet.has(row[keyField])}
                        <tr 
                            class="{getRowClasses(rowIndex, row, rowSelected)}"
                            on:click={() => handleRowClick(row, rowIndex)}
                        >
                            {#if selectable}
                                <td class="{bodyCellClasses} ds-datatable-checkbox-col" data-ds-checkbox-col style="width: {checkboxColumnWidth}; min-width: {checkboxColumnWidth}; max-width: {checkboxColumnWidth};" on:click|stopPropagation>
                                    <div class="flex items-center justify-center">
                                        <Checkbox
                                            checked={rowSelected}
                                            size="md"
                                            on:change={() => handleSelectRow(row)}
                                        />
                                    </div>
                                </td>
                            {/if}
                            {#each columns as column}
                                {@const value = getCellValue(row, column)}
                                <td 
                                    class="{bodyCellClasses}"
                                    class:text-center={column.align === 'center'}
                                    class:text-right={column.align === 'right'}
                                >
                                    {#if column.type === 'custom' && column.render}
                                        {@html column.render(value, row, rowIndex)}
                                    {:else if column.type === 'textWithSupporting'}
                                        <!-- Text with supporting text -->
                                        <div class="flex flex-col">
                                            <span class="{primaryTextClasses}">{value ?? '-'}</span>
                                            {#if column.supportingField && row[column.supportingField]}
                                                <span class="{supportingTextClasses}">{row[column.supportingField]}</span>
                                            {/if}
                                        </div>
                                    {:else if column.type === 'status' || column.type === 'badge'}
                                        {@const isEmpty = value == null || value === '' || String(value).trim() === '' || value === '—'}
                                        {#if isEmpty}
                                            <span class="{primaryTextClasses}">—</span>
                                        {:else}
                                            <Badge 
                                                label={String(value)}
                                                color={column.statusColor ? column.statusColor(value, row) : 'gray'}
                                                showDot={column.showDot != null ? column.showDot(value, row) : (column.type === 'status')}
                                                size="sm"
                                                interactive={false}
                                            />
                                        {/if}
                                    {:else if column.type === 'multiBadge'}
                                        <!-- Multiple badges with overflow -->
                                        {@const badges = column.badgesField ? row[column.badgesField] : (Array.isArray(value) ? value : [])}
                                        {@const maxItems = column.maxItems ?? 3}
                                        {@const visibleBadges = badges.slice(0, maxItems)}
                                        {@const remainingCount = badges.length - maxItems}
                                        <div class="flex flex-col gap-1">
                                            {#if column.nameField || column.supportingField}
                                                <span class="{primaryTextClasses}">{column.nameField ? row[column.nameField] : value}</span>
                                            {/if}
                                            <div class="flex flex-wrap gap-1">
                                                {#each visibleBadges as badge}
                                                    <Badge 
                                                        label={String(badge)}
                                                        color="gray"
                                                        size="sm"
                                                        interactive={false}
                                                    />
                                                {/each}
                                                {#if remainingCount > 0}
                                                    <Badge 
                                                        label="+{remainingCount}"
                                                        color="gray"
                                                        size="sm"
                                                        interactive={false}
                                                    />
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'multiTag'}
                                        <!-- Multiple tags/chips with overflow -->
                                        {@const tags = column.tagsField ? row[column.tagsField] : (Array.isArray(value) ? value : [])}
                                        {@const maxItems = column.maxItems ?? 3}
                                        {@const visibleTags = tags.slice(0, maxItems)}
                                        {@const remainingCount = tags.length - maxItems}
                                        <div class="flex flex-col gap-1">
                                            {#if column.nameField || column.supportingField}
                                                <span class="{primaryTextClasses}">{column.nameField ? row[column.nameField] : value}</span>
                                            {/if}
                                            <div class="flex flex-wrap gap-1">
                                                {#each visibleTags as tag}
                                                    <Tag 
                                                        label={String(tag)}
                                                        size="sm"
                                                    />
                                                {/each}
                                                {#if remainingCount > 0}
                                                    <Tag 
                                                        label="+{remainingCount}"
                                                        size="sm"
                                                    />
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'chip'}
                                        <!-- Single chip with dot and count (Figma spec) -->
                                        {@const dotColor = column.dotColor || '#12B76A'}
                                        {@const count = column.countField ? row[column.countField] : undefined}
                                        <div class="flex flex-col gap-1">
                                            {#if column.nameField}
                                                <span class="{primaryTextClasses}">{row[column.nameField]}</span>
                                            {/if}
                                            <div class="inline-flex items-center gap-1.5 px-1.5 py-1 bg-[var(--ds-bg-primary)] border border-[var(--ds-color-neutral-true-300)] rounded-md h-7 w-fit">
                                                <!-- Dot -->
                                                <div class="w-2 h-2 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <div class="w-1.5 h-1.5 rounded-full" style="background-color: {dotColor}" />
                                                </div>
                                                <!-- Text -->
                                                <span class="text-[14px] font-normal leading-[20px] text-[var(--ds-text-primary)]">{value ?? '-'}</span>
                                                <!-- Count Badge -->
                                                {#if count !== undefined}
                                                    <div class="px-1.5 h-[18px] flex items-center justify-center bg-[var(--ds-color-neutral-true-100)] rounded-[3px]">
                                                        <span class="text-[12px] font-normal leading-[16px] text-[var(--ds-text-primary)]">{count}</span>
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'file'}
                                        <!-- File cell with icon -->
                                        {@const iconColor = column.fileIconColor || '#7F56D9'}
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 flex items-center justify-center bg-[var(--ds-color-primary-50)] rounded-full flex-shrink-0">
                                                <FileText class="w-5 h-5" style="color: {iconColor}" stroke-width={1.67} />
                                            </div>
                                            <div class="flex flex-col">
                                                <span class="{primaryTextClasses}">{value ?? '-'}</span>
                                                {#if column.supportingField && row[column.supportingField]}
                                                    <span class="{supportingTextClasses}">{row[column.supportingField]}</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'payment'}
                                        <!-- Payment cell with card icon -->
                                        {@const paymentType = value?.toUpperCase?.() || 'VISA'}
                                        <div class="flex items-center gap-4">
                                            <div class="w-[34px] h-6 flex items-center justify-center bg-[var(--ds-bg-primary)] border border-[var(--ds-border-subtle)] rounded flex-shrink-0">
                                                <span class="text-[10px] font-bold text-[var(--ds-text-brand)]">{paymentType}</span>
                                            </div>
                                            <div class="flex flex-col">
                                                {#if column.nameField && row[column.nameField]}
                                                    <span class="{primaryTextClasses}">{row[column.nameField]}</span>
                                                {/if}
                                                {#if column.supportingField && row[column.supportingField]}
                                                    <span class="{supportingTextClasses}">{row[column.supportingField]}</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'progress'}
                                        <!-- Progress bar cell -->
                                        {@const progressValue = column.progressField ? row[column.progressField] : (typeof value === 'number' ? value : 0)}
                                        {@const clampedValue = Math.max(0, Math.min(100, progressValue))}
                                        <div class="flex items-center gap-3">
                                            <div class="relative flex-1 h-2 min-w-[100px]">
                                                <!-- Background -->
                                                <div class="absolute inset-0 bg-[var(--ds-color-neutral-true-200)] rounded" />
                                                <!-- Progress -->
                                                <div 
                                                    class="absolute h-2 bg-[var(--ds-color-neutral-true-600)] rounded"
                                                    style="width: {clampedValue}%"
                                                />
                                                <!-- Thumb -->
                                                <div 
                                                    class="absolute top-1/2 w-3 h-3 bg-white rounded-full"
                                                    style="left: {clampedValue}%; transform: translate(-50%, -50%); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px var(--ds-border-subtle);"
                                                />
                                            </div>
                                            {#if column.showProgressValue}
                                                <span class="{primaryTextClasses} w-12 text-right">{clampedValue}%</span>
                                            {/if}
                                        </div>
                                    {:else if column.type === 'toggle'}
                                        <!-- Toggle switch cell -->
                                        {@const isOn = column.toggleField ? row[column.toggleField] : Boolean(value)}
                                        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                                        <div class="flex items-center gap-4" on:click|stopPropagation>
                                            <button
                                                type="button"
                                                class="relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer
                                                    {isOn ? 'bg-[var(--ds-color-primary-500)]' : 'bg-[var(--ds-color-neutral-true-200)]'}"
                                                on:click={() => column.onToggle?.(row, !isOn)}
                                            >
                                                <div 
                                                    class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform
                                                        {isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}"
                                                />
                                            </button>
                                            {#if column.nameField && row[column.nameField]}
                                                <div class="flex flex-col">
                                                    <span class="{primaryTextClasses}">{row[column.nameField]}</span>
                                                    {#if column.supportingField && row[column.supportingField]}
                                                        <span class="{supportingTextClasses}">{row[column.supportingField]}</span>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    {:else if column.type === 'rowNumber'}
                                        <!-- Row number (01, 02, etc.) -->
                                        <span class="{primaryTextClasses}">
                                            {String(rowIndex + 1).padStart(2, '0')}
                                        </span>
                                    {:else if column.type === 'relativeTime'}
                                        <!-- Relative time display (2 minutes ago, Yesterday) -->
                                        <span class="{primaryTextClasses}">{formatRelativeTime(value)}</span>
                                    {:else if column.type === 'badgeOutline'}
                                        <!-- Badge outline style (Online/Offline) -->
                                        {@const badgeColor = column.statusColor ? column.statusColor(value, row) : 'gray'}
                                        <Badge 
                                            label={String(value || '-')}
                                            color={badgeColor}
                                            outline={true}
                                            size="sm"
                                        />
                                    {:else if column.type === 'usageIndicators'}
                                        <!-- Usage indicators with colored dots (CPU/MEM/DSK) -->
                                        {@const defaultUsageFields = [
                                            { label: 'CPU', field: 'cpu', thresholds: { warning: 70, danger: 90 } },
                                            { label: 'MEM', field: 'mem', thresholds: { warning: 70, danger: 90 } },
                                            { label: 'DSK', field: 'dsk', thresholds: { warning: 70, danger: 90 } }
                                        ]}
                                        {@const fields = column.usageFields || defaultUsageFields}
                                        <div class="flex items-center gap-2">
                                            {#each fields as usageField}
                                                {@const usageValue = row[usageField.field] ?? 0}
                                                {@const threshold = usageField.thresholds || { warning: 70, danger: 90 }}
                                                {@const dotColor = usageValue >= threshold.danger ? 'var(--ds-color-error-500)' : usageValue >= threshold.warning ? 'var(--ds-color-warning-500)' : 'var(--ds-color-success-500)'}
                                                <div class="inline-flex items-center gap-1">
                                                    <div class="w-2 h-2 rounded-full" style="background-color: {dotColor}" />
                                                    <span class="text-[14px] font-normal text-[var(--ds-text-primary)]">{usageField.label}</span>
                                                </div>
                                            {/each}
                                        </div>
                                    {:else if column.type === 'pin'}
                                        <!-- Pin: filled when pinned, outline when not. Tooltip per design (dark, arrow down). -->
                                        {@const isPinned = column.pinField ? row[column.pinField] : Boolean(value)}
                                        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                                        <div on:click|stopPropagation>
                                            <Tooltip
                                                text={isPinned ? 'Remove pinned app' : 'Pinup app'}
                                                theme="dark"
                                                arrow="bottom"
                                                position="top"
                                                trigger="hover"
                                                portal={true}
                                            >
                                                <button
                                                    type="button"
                                                    class="p-1 rounded transition-colors hover:bg-[var(--ds-bg-secondary)]"
                                                    on:click={() => column.onPin?.(row, !isPinned)}
                                                >
                                                    <Pin
                                                        size={20}
                                                        strokeWidth={isPinned ? 2 : 1.67}
                                                        color={isPinned ? 'var(--ds-color-neutral-true-700)' : 'var(--ds-color-neutral-true-500)'}
                                                        fill={isPinned ? 'var(--ds-color-neutral-true-700)' : 'none'}
                                                    />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    {:else if column.type === 'moreMenu'}
                                        {@const actions = column.getMenuActions ? column.getMenuActions(row) : (column.menuActions ?? [])}
                                        {@const rowKey = row[keyField] ?? rowIndex}
                                        <!-- 3-dot more menu: only one open at a time -->
                                        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                                        <div on:click|stopPropagation>
                                            {#if actions.length > 0}
                                                <ActionMenu
                                                    open={openMoreMenuKey === rowKey}
                                                    items={actions
                                                        .filter(a => !a.hidden || !a.hidden(row))
                                                        .map(a => ({
                                                            id: a.id,
                                                            label: a.label ?? a.id,
                                                            icon: a.icon,
                                                            destructive: a.destructive || a.color === 'danger',
                                                            disabled: a.disabled ? a.disabled(row) : false,
                                                            href: typeof a.href === 'function' ? a.href(row) : a.href
                                                        }))}
                                                    triggerIcon="dots-vertical"
                                                    align="right"
                                                    size="sm"
                                                    triggerVariant="text"
                                                    width="auto"
                                                    on:open={() => { openMoreMenuKey = rowKey; }}
                                                    on:close={() => { openMoreMenuKey = null; }}
                                                    on:select={(e) => {
                                                        const act = actions.find(x => x.id === e.detail.id);
                                                        act?.onClick?.(row);
                                                        dispatch('action', { actionId: e.detail.id, row });
                                                    }}
                                                />
                                            {:else}
                                                <button
                                                    type="button"
                                                    class="p-2 rounded-lg hover:bg-[var(--ds-bg-secondary)] transition-colors"
                                                    on:click={() => dispatch('action', { actionId: 'moreMenu', row })}
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                        <path d="M10 10.5C10.2761 10.5 10.5 10.2761 10.5 10C10.5 9.72386 10.2761 9.5 10 9.5C9.72386 9.5 9.5 9.72386 9.5 10C9.5 10.2761 9.72386 10.5 10 10.5Z" stroke="var(--ds-text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        <path d="M10 5.5C10.2761 5.5 10.5 5.27614 10.5 5C10.5 4.72386 10.2761 4.5 10 4.5C9.72386 4.5 9.5 4.72386 9.5 5C9.5 5.27614 9.72386 5.5 10 5.5Z" stroke="var(--ds-text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        <path d="M10 15.5C10.2761 15.5 10.5 15.2761 10.5 15C10.5 14.7239 10.2761 14.5 10 14.5C9.72386 14.5 9.5 14.7239 9.5 15C9.5 15.2761 9.72386 15.5 10 15.5Z" stroke="var(--ds-text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                </button>
                                            {/if}
                                        </div>
                                    {:else if column.type === 'avatar'}
                                        <!-- Avatar 40x40 per Figma -->
                                        <Avatar 
                                            name={value || '?'}
                                            src={column.avatarField ? row[column.avatarField] : undefined}
                                            size="md"
                                        />
                                    {:else if column.type === 'avatarWithName'}
                                        <!-- Avatar with name and supporting text (40x40, gap 12px) -->
                                        <div class="flex items-center gap-3">
                                            <Avatar 
                                                name={column.nameField ? row[column.nameField] : value}
                                                src={column.avatarField ? row[column.avatarField] : undefined}
                                                size="md"
                                            />
                                            <div class="flex flex-col">
                                                <span class="{primaryTextClasses}">
                                                    {column.nameField ? row[column.nameField] : value}
                                                </span>
                                                {#if column.emailField && row[column.emailField]}
                                                    <span class="{supportingTextClasses}">
                                                        {row[column.emailField]}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    {:else if column.type === 'date'}
                                        <span class="{primaryTextClasses}">{formatDate(value)}</span>
                                    {:else if column.type === 'datetime'}
                                        <span class="{primaryTextClasses}">{formatDateTime(value)}</span>
                                    {:else if column.type === 'number'}
                                        <span class="{primaryTextClasses}">{formatNumber(value)}</span>
                                    {:else if column.type === 'link'}
                                        <a 
                                            href={value}
                                            class="text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            on:click|stopPropagation
                                        >
                                            {value}
                                        </a>
                                    {:else if column.type === 'actions' && column.actions}
                                        <!-- Actions: icons 20x20, gap 4px -->
                                        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                                        <div class="flex items-center gap-1" on:click|stopPropagation>
                                            {#each column.actions as action}
                                                {#if !action.hidden || !action.hidden(row)}
                                                    {#if action.icon && !action.label}
                                                        <!-- Icon-only action button -->
                                                        <button
                                                            type="button"
                                                            class="p-2 rounded-lg hover:bg-[var(--ds-bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            disabled={action.disabled ? action.disabled(row) : false}
                                                            title={action.tooltip || action.id}
                                                            on:click={() => {
                                                                action.onClick?.(row);
                                                                dispatch('action', { actionId: action.id, row });
                                                            }}
                                                        >
                                                            <svelte:component this={action.icon} class="w-5 h-5 text-[var(--ds-text-secondary)]" stroke-width={2} />
                                                        </button>
                                                    {:else}
                                                        <!-- Button with label -->
                                                        <Button
                                                            size="sm"
                                                            variant={action.variant || 'ghost'}
                                                            color={action.color || 'gray'}
                                                            disabled={action.disabled ? action.disabled(row) : false}
                                                            on:click={() => {
                                                                action.onClick?.(row);
                                                                dispatch('action', { actionId: action.id, row });
                                                            }}
                                                        >
                                                            {#if action.icon}
                                                                <svelte:component this={action.icon} slot="icon-left" class="h-4 w-4" />
                                                            {/if}
                                                            {action.label}
                                                        </Button>
                                                    {/if}
                                                {/if}
                                            {/each}
                                        </div>
                                    {:else}
                                        <span class="{primaryTextClasses}">{value ?? '-'}</span>
                                    {/if}
                                </td>
                            {/each}
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- Pagination: Type=Card button group right aligned, Shape=Square (Figma) -->
    {#if paginated && pagination.totalPages > 0}
        <div class="ds-datatable-pagination">
            <!-- Details: "X - Y of Z" – Body/14-Regular, Neutral-True/600 #525252 -->
            <span class="ds-pagination-details">
                {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems}
            </span>
            <!-- Pagination numbers group: << < [1][2][3][...][8][9][10] > >>, gap 2px -->
            <div class="ds-pagination-controls">
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronsLeft}
                    iconPosition="only"
                    disabled={pagination.page === 1}
                    on:click={() => handlePageChange(1)}
                />
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronLeft}
                    iconPosition="only"
                    disabled={pagination.page === 1}
                    on:click={() => handlePageChange(pagination.page - 1)}
                />
                <div class="ds-pagination-numbers">
                    {#each paginationPages as slot}
                        {#if slot === 'ellipsis'}
                            <span class="ds-pagination-ellipsis" aria-hidden="true">...</span>
                        {:else}
                            <button
                                type="button"
                                class="ds-pagination-page"
                                class:active={slot === pagination.page}
                                on:click={() => handlePageChange(slot)}
                            >
                                {slot}
                            </button>
                        {/if}
                    {/each}
                </div>
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="only"
                    disabled={pagination.page === pagination.totalPages}
                    on:click={() => handlePageChange(pagination.page + 1)}
                />
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronsRight}
                    iconPosition="only"
                    disabled={pagination.page === pagination.totalPages}
                    on:click={() => handlePageChange(pagination.totalPages)}
                />
            </div>
        </div>
    {/if}

    <!-- Selection Info Bar -->
    {#if selectable && selectedRows.length > 0}
        <div class="flex items-center justify-between px-6 py-3 bg-[var(--ds-color-primary-25)] border-t border-[var(--ds-color-primary-200)]">
            <span class="text-[14px] font-medium text-[var(--ds-text-brand)]">
                {selectedRows.length} row{selectedRows.length > 1 ? 's' : ''} selected
            </span>
            <button
                type="button"
                class="text-[14px] font-semibold text-[var(--ds-text-brand)] hover:text-[var(--ds-text-link-hover)] hover:underline transition-colors"
                on:click={() => { selectedRows = []; dispatch('selectionChange', []); }}
            >
                Clear selection
            </button>
        </div>
    {/if}
</div>

<style>
    .ds-datatable {
        font-family: var(--ds-font-family-primary);
    }

    /* Fixed table layout so checkbox column width is respected */
    .ds-datatable table {
        table-layout: fixed;
    }

    /* Checkbox column: strict fixed width; padding overridden so 48px is total width (border-box) */
    .ds-datatable th.ds-datatable-checkbox-col,
    .ds-datatable td.ds-datatable-checkbox-col {
        width: var(--ds-datatable-checkbox-width, 48px) !important;
        min-width: var(--ds-datatable-checkbox-width, 48px) !important;
        max-width: var(--ds-datatable-checkbox-width, 48px) !important;
        box-sizing: border-box !important;
        padding-left: 8px !important;
        padding-right: 8px !important;
    }
    .ds-datatable thead th.ds-datatable-checkbox-col {
        height: 44px !important;
        min-height: 44px !important;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
    }
    .ds-datatable tbody td.ds-datatable-checkbox-col {
        padding-top: 16px !important;
        padding-bottom: 16px !important;
    }
    
    /* Ensure proper vertical alignment */
    .ds-datatable td {
        vertical-align: middle;
    }
    
    .ds-datatable th {
        vertical-align: middle;
    }

    /* Pagination: Type=Card button group right aligned, Shape=Square, Breakpoint=Desktop */
    .ds-datatable-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 24px;
        gap: 8px;
        min-height: 56px;
        box-sizing: border-box;
        border-top: 1px solid var(--ds-border-default);
        background: var(--ds-bg-primary);
    }
    .ds-pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-secondary);
        flex: none;
    }
    .ds-pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px; /* gap between << < [numbers] > >> */
    }
    .ds-pagination-numbers {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        gap: 2px;
    }
    .ds-pagination-page {
        /* _Pagination number base: 40×40, radius 8px, Inter 500 14px/20px */
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: none;
        background: transparent;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: var(--ds-text-secondary);
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
    }
    .ds-pagination-page:hover {
        background: var(--ds-color-neutral-true-100);
    }
    .ds-pagination-page.active {
        background: var(--ds-bg-secondary);
        color: var(--ds-text-primary);
    }
    .ds-pagination-ellipsis {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-text-secondary);
    }

    /* When cellBorders=false: remove border-bottom on th/td (override all Tailwind classes) */
    .ds-datatable.dt-no-cell-borders table th,
    .ds-datatable.dt-no-cell-borders table td {
        border-bottom: none !important;
    }
</style>
