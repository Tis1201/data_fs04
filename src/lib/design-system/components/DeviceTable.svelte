<!--
    @deprecated This component is deprecated and will be removed in a future version.
    Please use DataTable with appropriate column configuration instead.
    
    Migration guide:
    - Use DataTable component from '$lib/design-system/components'
    - Configure columns using ColumnDef interface
    - Use 'usageIndicators' cell type for CPU/MEM/DSK display
    - Use 'status' cell type for online/offline status
    - Use 'multiTag' cell type for device tags
-->
<script context="module" lang="ts">
    /**
     * @deprecated Use DataTable with ColumnDef configuration instead
     */
    export interface DeviceRow {
        id: string;
        name: string;
        macAddress: string;
        osVersion: string;
        deviceType?: string;  // Operating System (Android, Linux, Windows, macOS)
        status: 'ACTIVE' | 'INACTIVE';
        connected: boolean;
        connectedAt?: Date | string | null;
        disconnectedAt?: Date | string | null;
        lastSeenAt?: Date | string | null;  // Mapped from lastUsedAt in database
        tags?: { id: string; name: string }[];
        cpuUsage?: number | null;
        memUsage?: number | null;
        diskUsage?: number | null;
    }

    export interface DeviceTableColumn {
        id: string;
        label: string;
        sortable?: boolean;
        filterable?: boolean;
        filterOptions?: { value: string; label: string }[];
        width?: string;
    }

    export interface DeviceTablePagination {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    }

    export interface DeviceTableSort {
        field: string;
        order: 'asc' | 'desc';
    }
</script>

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import {
        ArrowDown,
        ArrowUp,
        ChevronsUpDown,
        MoreVertical,
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight
    } from "lucide-svelte";
    import { Checkbox, Tag, Badge } from "$lib/design-system/components";
    import UsageIndicators from "./UsageIndicators.svelte";
    import { parseAsUtc } from "$lib/utils/deviceDetailsUtils";
    import { ColumnFilter } from "$lib/design-system/components";

    const dispatch = createEventDispatcher();

    export let data: DeviceRow[] = [];
    export let pagination: DeviceTablePagination = {
        page: 1,
        perPage: 10,
        total: 0,
        totalPages: 0
    };
    export let sort: DeviceTableSort = { field: "name", order: "asc" };
    export let selectable = true;
    export let selectedRows: DeviceRow[] = [];
    export let loading = false;
    /** When provided, device name is rendered as an <a href> link (like other tables). Enables URL on hover, right-click "Open in new tab", etc. */
    export let detailHref: ((row: DeviceRow) => string) | undefined = undefined;
    // Allows routes to hide specific columns (by column id) without forking this table.
    // Example: hiddenColumns={['deviceType','usage']}
    export let hiddenColumns: string[] = [];

    // Column definitions - widths match Figma design
    // Per Figma: 
    // - Sort icons: arrow-up (asc), arrow-down (desc), hidden (default/unsorted)
    // - Filter icon: chevrons-up-down (always visible for filterable columns)
    const columns: DeviceTableColumn[] = [
        { id: "name", label: "Device Name", sortable: true, width: "220px" },
        { id: "macAddress", label: "MAC Address", sortable: true, width: "150px" },
        { 
            id: "deviceType",  // Changed from osVersion to deviceType
            label: "Operating System", 
            sortable: true, 
            filterable: true,  // Per Figma: has filter dropdown
            filterOptions: [
                { value: "Android", label: "Android" },
                { value: "Linux", label: "Linux" },
                { value: "Windows", label: "Windows" },
                { value: "macOS", label: "macOS" }
            ],
            width: "180px"
        },
        { 
            id: "usage", 
            label: "Usage", 
            sortable: false,
            filterable: true,  // Per Figma: has filter dropdown (client-side filter)
            filterOptions: [
                { value: "Healthy", label: "Healthy" },
                { value: "Warning", label: "Warning" },
                { value: "Critical", label: "Critical" }
            ],
            width: "180px"
        },
        { 
            id: "connected", 
            label: "Status", 
            sortable: true,
            filterable: true,  // Per Figma: has filter dropdown
            filterOptions: [
                { value: "Online", label: "Online" },
                { value: "Offline", label: "Offline" }
            ],
            width: "120px"
        },
        // Use disconnectedAt for "Last ping" - this is when device was last online
        // Note: connectedAt = when device connected, disconnectedAt = when device went offline (last ping)
        { id: "disconnectedAt", label: "Last ping", sortable: true, width: "150px" },
        { id: "actions", label: "Actions", sortable: false, width: "80px" }
    ];

    $: hiddenSet = new Set(hiddenColumns);
    $: visibleColumns = columns.filter((c) => !hiddenSet.has(c.id));

    // Calculate usage health status for client-side filtering
    // Aligned with dashboard: Critical >=80%, Warning 60-79%, Healthy <60%
    function getUsageHealthStatus(row: DeviceRow): 'Healthy' | 'Warning' | 'Critical' {
        const cpu = row.cpuUsage ?? 0;
        const mem = row.memUsage ?? 0;
        const disk = row.diskUsage ?? 0;
        
        // Critical if any metric >= 80%
        if (cpu >= 80 || mem >= 80 || disk >= 80) return 'Critical';
        // Warning if any metric >= 60%
        if (cpu >= 60 || mem >= 60 || disk >= 60) return 'Warning';
        // Healthy otherwise
        return 'Healthy';
    }

    /** OS column: agents/DB often send lowercase; filters use Android/Linux/Windows/macOS. */
    function formatDeviceOsDisplay(value: string | undefined | null): string {
        if (value == null || String(value).trim() === '') return 'N/A';
        const raw = String(value).trim();
        const key = raw.toLowerCase();
        const labels: Record<string, string> = {
            android: 'Android',
            linux: 'Linux',
            windows: 'Windows',
            macos: 'macOS',
            apple: 'Apple',
            unknown: 'Unknown',
            ios: 'iOS'
        };
        if (labels[key]) return labels[key];
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    // Client-side filter only for Usage health (ClickHouse data, not filterable server-side).
    // OS (deviceType) and connection status (connected) are filtered server-side via URL params.
    $: filteredData = data.filter(row => {
        const usageFilter = activeFilters['usage'];
        if (usageFilter && usageFilter.length > 0) {
            const healthStatus = getUsageHealthStatus(row);
            if (!usageFilter.includes(healthStatus)) return false;
        }
        return true;
    });

    // Filter states
    let activeFilters: Record<string, string[]> = {};
    let openFilterColumn: string | null = null;
    let filterDropdownPosition = { top: 0, left: 0 };

    // Action menu state
    let openActionMenuId: string | null = null;
    let actionMenuPosition: { top: number; left: number } | null = null;

    // Select all state (based on filtered data)
    $: allSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
    $: someSelected = selectedRows.length > 0 && selectedRows.length < filteredData.length;

    function toggleSelectAll() {
        if (allSelected) {
            selectedRows = [];
        } else {
            selectedRows = [...filteredData];
        }
        dispatch("selectionChange", selectedRows);
    }

    function toggleSelectRow(row: DeviceRow) {
        const idx = selectedRows.findIndex(r => r.id === row.id);
        if (idx >= 0) {
            selectedRows = selectedRows.filter(r => r.id !== row.id);
        } else {
            selectedRows = [...selectedRows, row];
        }
        dispatch("selectionChange", selectedRows);
    }

    // IMPORTANT (Svelte reactivity):
    // Avoid hiding selectedRows dependency inside a helper function; the template
    // won't reliably update when selectedRows changes. Use a reactive Set instead.
    $: selectedIds = new Set(selectedRows.map(r => r.id));

    // Sort cycle: Default → ASC → DESC → Default → ...
    // When clicking a different column, start with ASC
    // When clicking same column: ASC → DESC → Default (clear sort)
    function handleSort(columnId: string) {
        const column = columns.find(c => c.id === columnId);
        if (!column?.sortable) return;

        if (sort.field === columnId) {
            // Same column: cycle through states
            if (sort.order === "asc") {
                // ASC → DESC
                sort = { field: columnId, order: "desc" };
            } else if (sort.order === "desc") {
                // DESC → Default (clear sort, use server default)
                sort = { field: "", order: "asc" };
            }
        } else {
            // Different column: start with ASC
            sort = { field: columnId, order: "asc" };
        }
        dispatch("sort", sort);
    }

    function toggleFilter(columnId: string) {
        if (openFilterColumn === columnId) {
            openFilterColumn = null;
        } else {
            openFilterColumn = columnId;
        }
    }

    function handleFilterChange(columnId: string, values: string[], closeDropdown: boolean = false) {
        // If values is empty, remove the key from activeFilters
        if (!values || values.length === 0) {
            const { [columnId]: _, ...rest } = activeFilters;
            activeFilters = rest;
        } else {
            activeFilters = { ...activeFilters, [columnId]: values };
        }
        dispatch("filter", activeFilters);
        if (closeDropdown) {
            openFilterColumn = null;
        }
    }

    function handleFilterCheckboxChange(e: CustomEvent<{ checked: boolean }>, columnId: string, optionValue: string) {
        const isChecked = e.detail.checked;
        const current = activeFilters[columnId] || [];
        if (isChecked) {
            handleFilterChange(columnId, [...current, optionValue]);
        } else {
            handleFilterChange(columnId, current.filter(v => v !== optionValue));
        }
    }

    function toggleActionMenu(rowId: string, event: MouseEvent) {
        if (openActionMenuId === rowId) {
            openActionMenuId = null;
            actionMenuPosition = null;
        } else {
            const button = event.currentTarget as HTMLElement;
            const rect = button.getBoundingClientRect();
            // Position menu below button, aligned to right edge
            // Check if menu would go below viewport
            const menuHeight = 220; // Approximate menu height
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            
            if (spaceBelow < menuHeight) {
                // Show above button
                actionMenuPosition = { 
                    top: rect.top - menuHeight - 4, 
                    left: rect.right - 192 // 192px = w-48 = menu width
                };
            } else {
                // Show below button
                actionMenuPosition = { 
                    top: rect.bottom + 4, 
                    left: rect.right - 192 
                };
            }
            openActionMenuId = rowId;
        }
    }

    function handleAction(action: string, row: DeviceRow) {
        openActionMenuId = null;
        actionMenuPosition = null;
        dispatch(action, row);
    }

    // Pagination handlers
    function goToPage(targetPage: number) {
        const total = Math.max(0, Math.floor(Number(pagination.totalPages)) || 0);
        if (targetPage >= 1 && targetPage <= total) {
            dispatch("pageChange", targetPage);
        }
    }

    // Format last seen date
    // Priority: For online devices use connectedAt, for offline use disconnectedAt
    // Format: "MMM dd, yyyy hh:mm AM/PM" (e.g., "Dec 12, 2025 03:21 AM")
    // Rules:
    // - If device is offline > 48h: show full date in RED
    // - Otherwise show relative time: "x minutes ago", "x hours ago", "Yesterday"
    function formatLastSeen(row: DeviceRow): { text: string; isRed: boolean } {
        // Priority: lastSeenAt (from heartbeat) > connectedAt (for online) > disconnectedAt (for offline)
        const lastSeenDate = row.lastSeenAt 
            || (row.connected ? row.connectedAt : row.disconnectedAt) 
            || row.connectedAt 
            || row.disconnectedAt;
            
        if (!lastSeenDate) {
            return { text: "N/A", isRed: false };
        }

        const date = parseAsUtc(lastSeenDate) ?? new Date(lastSeenDate);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        // Helper function to format date as "MMM dd, yyyy hh:mm AM/PM"
        function formatDateString(d: Date): string {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[d.getMonth()];
            const day = String(d.getDate()).padStart(2, '0');
            const year = d.getFullYear();
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 should be 12
            const hoursStr = String(hours).padStart(2, '0');
            return `${month} ${day}, ${year} ${hoursStr}:${minutes} ${ampm}`;
        }

        // If device is OFFLINE for more than 48h, show date in RED
        if (!row.connected && diffHours > 48) {
            return { text: formatDateString(date), isRed: true };
        }

        // Relative time formatting
        // Less than 1 minute
        if (diffMins < 1) {
            return { text: "Just now", isRed: false };
        }
        // Less than 1 hour: "x minute(s) ago"
        if (diffHours < 1) {
            return { text: `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`, isRed: false };
        }
        // Less than 24 hours: "x hour(s) ago"
        if (diffHours < 24) {
            const hrs = Math.floor(diffHours);
            return { text: `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`, isRed: false };
        }
        // Less than 48 hours: "Yesterday"
        if (diffDays < 2) {
            return { text: "Yesterday", isRed: false };
        }

        // More than 48h but device is online - show date without red
        return { text: formatDateString(date), isRed: false };
    }

    // Close action menus when clicking outside (filter uses overlay approach)
    function handleClickOutside() {
        openActionMenuId = null;
        // Note: openFilterColumn is closed via backdrop overlay, not svelte:window
    }

    // Generate page numbers for pagination (URL/JSON may give string page — never use `page + 1` on strings)
    function getPageNumbers(): (number | string)[] {
        const totalPages = Math.max(0, Math.floor(Number(pagination.totalPages)) || 0);
        if (totalPages <= 0) return [];

        const page = Math.max(1, Math.min(Number(pagination.page) || 1, totalPages));
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const neighbors = new Set<number>();
        neighbors.add(1);
        neighbors.add(totalPages);
        for (let p = page - 1; p <= page + 1; p++) {
            if (p >= 1 && p <= totalPages) neighbors.add(p);
        }

        const sorted = [...neighbors].sort((a, b) => a - b);
        const out: (number | string)[] = [];
        let prev = 0;
        for (const p of sorted) {
            if (p - prev > 1) out.push('...');
            out.push(p);
            prev = p;
        }
        return out;
    }
</script>

<svelte:window on:click={handleClickOutside} />

<!-- Content: border-radius 9px, border #E5E5E5 -->
<div class="bg-white overflow-hidden" style="position: relative; border-radius: 9px; border: 1px solid #E5E5E5; width: 100%;">
    <!-- Table -->
    <div class="overflow-x-auto" style="position: relative;">
        <table class="w-full">
            <!-- Header: background #F5F5F5, border-bottom #EAECF0, padding 12px 16px, height 44px -->
            <thead style="background: #F5F5F5; border-bottom: 1px solid #EAECF0;">
                <tr>
                    {#if selectable}
                        <th class="w-12 h-[44px] text-left" style="padding: 12px 16px;">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                on:change={toggleSelectAll}
                                size="md"
                            />
                        </th>
                    {/if}
                    {#each visibleColumns as column}
                        <th
                            class="h-[44px] text-left {column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}"
                            style="width: {column.width || 'auto'}; padding: 12px 16px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-600); transition: background-color 0.15s;"
                            on:click={() => column.sortable && handleSort(column.id)}
                            on:keydown={(e) => e.key === 'Enter' && column.sortable && handleSort(column.id)}
                            role={column.sortable ? 'button' : undefined}
                            tabindex={column.sortable ? 0 : undefined}
                            aria-sort={sort.field === column.id ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                        >
                            <!-- Per Figma: _Table header with gap: 4px -->
                            <div class="flex items-center" style="gap: 4px;">
                                <!-- Column Label -->
                                <span style="font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-600);">
                                    {column.label}
                                </span>
                                
                                <!-- TC-DV-0020/0021: Show sort icon only when sorted - asc (ArrowUp), desc (ArrowDown). No icon when unsorted. -->
                                {#if column.sortable && sort.field === column.id}
                                    <span class="flex items-center justify-center" style="width: 16px; height: 16px;">
                                        {#if sort.order === "desc"}
                                            <ArrowDown size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {:else}
                                            <ArrowUp size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {/if}
                                    </span>
                                {/if}
                                
                                <!-- Filter Icon: chevrons-up-down to open dropdown -->
                                {#if column.filterable}
                                    <button
                                        type="button"
                                        class="flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
                                        style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer;"
                                        on:click|stopPropagation={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            filterDropdownPosition = { top: rect.bottom + 8, left: rect.left };
                                            toggleFilter(column.id);
                                        }}
                                        aria-label="Filter {column.label}"
                                        aria-haspopup="listbox"
                                        aria-expanded={openFilterColumn === column.id}
                                    >
                                        <!-- Per Figma: chevrons-up-down for filter -->
                                        <ChevronsUpDown 
                                            size={16} 
                                            strokeWidth={1.33} 
                                            style="color: {activeFilters[column.id]?.length ? '#0086C9' : '#475467'};" 
                                        />
                                    </button>
                                {/if}
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>

            <!-- Body -->
            <tbody>
                {#if loading}
                    {#each Array(5) as _}
                        <tr style="height: 72px; border-bottom: 1px solid #EAECF0;">
                            {#if selectable}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <div class="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                                </td>
                            {/if}
                            {#each visibleColumns as _}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
                                </td>
                            {/each}
                        </tr>
                    {/each}
                {:else if filteredData.length === 0}
                    <tr>
                        <td colspan={visibleColumns.length + (selectable ? 1 : 0)} class="px-4 py-12 text-center text-gray-500">
                            {data.length === 0 ? 'No devices found' : 'No devices match the current filters'}
                        </td>
                    </tr>
                {:else}
                    {#each filteredData as row (row.id)}
                        {@const lastSeen = formatLastSeen(row)}
                        <tr class="hover:bg-gray-50 transition-colors {selectedIds.has(row.id) ? 'bg-[#F9FAFB]' : ''}" style="height: 72px; border-bottom: 1px solid #EAECF0; background: #FFFFFF;">
                            {#if selectable}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;" on:click|stopPropagation>
                                    <Checkbox
                                        checked={selectedIds.has(row.id)}
                                        on:change={() => toggleSelectRow(row)}
                                        size="md"
                                    />
                                </td>
                            {/if}

                            <!-- Device Name: padding 12px 16px, gap 6px -->
                            {#if !hiddenSet.has('name')}
                                <td class="h-[72px]" style="padding: 12px 16px; border-bottom: 1px solid #EAECF0;">
                                    <div class="flex flex-col gap-[6px]">
                                        {#if detailHref}
                                            <a
                                                href={detailHref(row)}
                                                class="device-name-link text-left"
                                                style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-primary-700); cursor: pointer; text-decoration: none;"
                                            >
                                                {row.name}
                                            </a>
                                        {:else}
                                            <button
                                                type="button"
                                                class="device-name-link text-left"
                                                style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-primary-700); cursor: pointer; background: none; border: none; padding: 0;"
                                                on:click={() => handleAction("view", row)}
                                            >
                                                {row.name}
                                            </button>
                                        {/if}
                                        {#if row.id}
                                            <div class="device-id-cell" title={row.id} style="font-family: var(--ds-font-family-primary); font-size: 12px; color: var(--ds-color-gray-500); margin-top: 2px;">{row.id}</div>
                                        {/if}
                                        {#if row.tags && row.tags.length > 0}
                                            <div class="flex items-center gap-1 flex-nowrap">
                                                {#each row.tags.slice(0, 3) as deviceTag}
                                                    <Tag label={deviceTag.name} size="sm" />
                                                {/each}
                                                {#if row.tags.length > 3}
                                                    <Tag label="+{row.tags.length - 3}" size="sm" />
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </td>
                            {/if}

                            <!-- MAC Address: padding 16px -->
                            {#if !hiddenSet.has('macAddress')}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <span style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-900);">{row.macAddress || "N/A"}</span>
                                </td>
                            {/if}

                            <!-- Operating System (deviceType): padding 16px -->
                            {#if !hiddenSet.has('deviceType')}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <span style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-900);">{formatDeviceOsDisplay(row.deviceType)}</span>
                                </td>
                            {/if}

                            <!-- Usage: padding 12px 16px -->
                            {#if !hiddenSet.has('usage')}
                                <td class="h-[72px]" style="padding: 12px 16px; border-bottom: 1px solid #EAECF0;">
                                    <UsageIndicators
                                        cpuUsage={row.cpuUsage}
                                        memUsage={row.memUsage}
                                        diskUsage={row.diskUsage}
                                    />
                                </td>
                            {/if}

                            <!-- Status: padding 12px 16px, gap 4px -->
                            {#if !hiddenSet.has('connected')}
                                <td class="h-[72px]" style="padding: 12px 16px; border-bottom: 1px solid #EAECF0;">
                                    {#if row.status === 'INACTIVE'}
                                        <Badge
                                            label="Deactivated"
                                            color="warning"
                                            variant="filled"
                                            size="sm"
                                        />
                                    {:else}
                                        <Badge
                                            label={row.connected ? "Online" : "Offline"}
                                            color={row.connected ? "success" : "gray"}
                                            variant="filled"
                                            size="sm"
                                        />
                                    {/if}
                                </td>
                            {/if}

                            <!-- Last Seen: padding 16px -->
                            {#if !hiddenSet.has('disconnectedAt')}
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <span style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: {lastSeen.isRed ? 'var(--ds-color-error-600)' : 'var(--ds-color-gray-900)'};">
                                        {lastSeen.text}
                                    </span>
                                </td>
                            {/if}

                            <!-- Actions: padding 8px 16px -->
                            {#if !hiddenSet.has('actions')}
                                <td class="h-[72px]" style="padding: 8px 16px; border-bottom: 1px solid #EAECF0;">
                                    <div class="relative">
                                        <button
                                            type="button"
                                            class="flex items-center justify-center rounded-lg transition-colors hover:bg-[#F9FAFB]"
                                            style="width: 40px; height: 40px;"
                                            on:click|stopPropagation={(e) => toggleActionMenu(row.id, e)}
                                        >
                                            <MoreVertical size={20} style="color: #475467;" />
                                        </button>
                                    </div>
                                </td>
                            {/if}
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- Pagination: padding 8px 24px, height 56px, border-top #EAECF0 -->
    {#if pagination.total > 0}
        <div class="flex items-center justify-end bg-white" style="padding: 8px 24px; height: 56px; border-top: 1px solid #EAECF0; gap: 8px;">
            <!-- Details: font 14px/20px, color #525252 -->
            <div style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-600); white-space: nowrap;">
                {(Number(pagination.page) - 1) * Number(pagination.perPage) + 1} - {Math.min(Number(pagination.page) * Number(pagination.perPage), Number(pagination.total))} of {pagination.total}
            </div>

            <!-- Pagination numbers: gap 2px -->
            <div class="flex items-center" style="gap: 2px;">
                <!-- First page: 36x36px, padding 8px, border-radius 8px -->
                <button
                    type="button"
                    class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                    disabled={Number(pagination.page) <= 1}
                    on:click={() => goToPage(1)}
                >
                    <ChevronsLeft size={20} style="color: #292929;" />
                </button>

                <!-- Previous page: 36x36px, padding 8px, border-radius 8px -->
                <button
                    type="button"
                    class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                    disabled={Number(pagination.page) <= 1}
                    on:click={() => goToPage(Number(pagination.page) - 1)}
                >
                    <ChevronLeft size={20} style="color: #292929;" />
                </button>

                <!-- Page numbers: 40x40px, padding 12px, border-radius 8px -->
                {#each getPageNumbers() as pageNum, pageIdx (pageNum === '...' ? `e-${pageIdx}` : String(pageNum))}
                    {#if pageNum === "..."}
                        <span style="padding: 0 8px; color: #A3A3A3;">...</span>
                    {:else}
                        <button
                            type="button"
                            class="flex items-center justify-center rounded transition-colors"
                            style="width: 40px; height: 40px; padding: 12px; border-radius: var(--ds-radius-lg); font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); {Number(pagination.page) === Number(pageNum) ? 'background: var(--ds-color-gray-50); color: var(--ds-color-gray-800);' : 'color: var(--ds-color-gray-600);'}"
                            on:click={() => goToPage(Number(pageNum))}
                        >
                            {pageNum}
                        </button>
                    {/if}
                {/each}

                <!-- Next page: 36x36px, padding 8px, border-radius 8px -->
                <button
                    type="button"
                    class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                    disabled={Number(pagination.page) >= Number(pagination.totalPages)}
                    on:click={() => goToPage(Number(pagination.page) + 1)}
                >
                    <ChevronRight size={20} style="color: #292929;" />
                </button>

                <!-- Last page: 36x36px, padding 8px, border-radius 8px -->
                <button
                    type="button"
                    class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                    disabled={Number(pagination.page) >= Number(pagination.totalPages)}
                    on:click={() => goToPage(Number(pagination.totalPages))}
                >
                    <ChevronsRight size={20} style="color: #292929;" />
                </button>
            </div>
        </div>
    {/if}
</div>

<!-- Filter Dropdown Portal (rendered outside table to avoid overflow clipping) -->
{#if openFilterColumn}
    {@const currentColumn = visibleColumns.find(c => c.id === openFilterColumn)}
    {#if currentColumn?.filterOptions}
        <!-- Backdrop to close dropdown when clicking outside -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="fixed inset-0"
            style="z-index: 9998;"
            on:click={() => openFilterColumn = null}
            on:keydown={(e) => { if (e.key === 'Escape') openFilterColumn = null; }}
        ></div>
        <div
            class="fixed bg-white shadow-lg"
            style="top: {filterDropdownPosition.top}px; left: {filterDropdownPosition.left}px; min-width: 160px; padding: 12px; border-radius: 12px; border: 1px solid #E5E5E5; z-index: 9999;"
            role="listbox"
            tabindex="-1"
        >
            {#each currentColumn.filterOptions as option (option.value)}
                <div
                    class="flex items-center gap-3 cursor-pointer"
                    style="padding: 10px 8px; border-radius: 8px; transition: background-color 0.15s ease;"
                    role="option"
                    aria-selected={activeFilters[openFilterColumn]?.includes(option.value) || false}
                    on:mouseenter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                    on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    on:click|stopPropagation={() => {
                        if (!openFilterColumn) return;
                        const current = activeFilters[openFilterColumn] || [];
                        const isChecked = current.includes(option.value);
                        if (isChecked) {
                            activeFilters = { ...activeFilters, [openFilterColumn]: current.filter(v => v !== option.value) };
                        } else {
                            activeFilters = { ...activeFilters, [openFilterColumn]: [...current, option.value] };
                        }
                        dispatch("filter", activeFilters);
                    }}
                    on:keydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!openFilterColumn) return;
                            const current = activeFilters[openFilterColumn] || [];
                            const isChecked = current.includes(option.value);
                            if (isChecked) {
                                activeFilters = { ...activeFilters, [openFilterColumn]: current.filter(v => v !== option.value) };
                            } else {
                                activeFilters = { ...activeFilters, [openFilterColumn]: [...current, option.value] };
                            }
                            dispatch("filter", activeFilters);
                        }
                    }}
                    tabindex="0"
                >
                    <Checkbox
                        checked={activeFilters[openFilterColumn]?.includes(option.value) || false}
                        size="md"
                    />
                    <span
                        style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-700);"
                    >
                        {option.label}
                    </span>
                </div>
            {/each}
        </div>
    {/if}
{/if}

<!-- Action Menu Portal (rendered outside table to avoid overflow clipping) -->
{#if openActionMenuId && actionMenuPosition}
    {@const currentRow = filteredData.find(r => r.id === openActionMenuId)}
    {#if currentRow}
        <!-- Backdrop to close menu when clicking outside -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="fixed inset-0"
            style="z-index: 9998;"
            on:click={() => { openActionMenuId = null; actionMenuPosition = null; }}
            on:keydown={(e) => { if (e.key === 'Escape') { openActionMenuId = null; actionMenuPosition = null; } }}
        ></div>
        <div
            class="fixed bg-white rounded-lg shadow-lg py-2"
            style="top: {actionMenuPosition.top}px; left: {actionMenuPosition.left}px; z-index: 9999; min-width: 160px; border: 1px solid #E5E5E5; border-radius: 12px;"
            role="menu"
            tabindex="-1"
        >
            <button
                type="button"
                class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer;"
                on:click={() => handleAction("view", currentRow)}
            >
                View
            </button>
            <button
                type="button"
                class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer;"
                on:click={() => handleAction("edit", currentRow)}
            >
                Edit Device
            </button>
            <button
                type="button"
                class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer;"
                on:click={() => handleAction("toggleStatus", currentRow)}
            >
                {currentRow.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            </button>
            {#if currentRow.status === 'ACTIVE' && currentRow.connected}
                <button
                    type="button"
                    class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                    style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer;"
                    on:click={() => handleAction("reboot", currentRow)}
                >
                    Reboot
                </button>
            {/if}
            <div style="height: 1px; background: var(--ds-border-default); margin: 4px 0;"></div>
            <button
                type="button"
                class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-error-600); border: none; background: transparent; cursor: pointer;"
                on:click={() => handleAction("delete", currentRow)}
            >
                Delete
            </button>
        </div>
    {/if}
{/if}

<style>
    table {
        font-family: var(--ds-font-family-primary);
    }

    th,
    td {
        vertical-align: middle;
    }

    .device-name-link:hover {
        text-decoration: underline;
        color: var(--ds-color-primary-800);
    }
</style>
