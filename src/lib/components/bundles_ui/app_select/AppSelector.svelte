<script lang="ts">
    import { onMount, createEventDispatcher, tick } from 'svelte';
    import { browser } from '$app/environment';
    import { Search, X } from 'lucide-svelte';
    import type { Resource } from '@prisma/client';

    // Design System – use only $lib/design-system/components (WORKFLOW.md)
    import { Modal, Button, InputField, Toggle, Tooltip } from '$lib/design-system/components';

    import { toast } from '$lib/stores/alertToast';

    interface TableMeta {
        current_page: number;
        per_page: number;
        total: number;
        last_page: number;
    }

    interface TableData {
        records: Resource[];
        pagination: { page: number; per_page: number; total_records: number; total_pages: number };
        sort: { field: string; order: 'asc' | 'desc' };
        loading: boolean;
    }

    interface ApiResponse {
        resources: Resource[];
        meta: TableMeta;
    }

    export let bundleId: string;
    export let autoOpen = false;
    export let open = false;
    export let apiPrefix: string = '/api/v2';
    export let resourceMode: boolean = false;
    export let resourcesEndpoint: string = '/api/v2/resources/apps';
    export let resourceExcludePackages: string[] = [];
    export let resourceRuleId: string | undefined = undefined;

    type SelectedItem = { resource: Resource; autoOpen: boolean };
    let selectedItems: SelectedItem[] = [];

    let tableData: TableData = {
        records: [],
        pagination: { page: 1, per_page: 10, total_records: 0, total_pages: 1 },
        sort: { field: 'name', order: 'asc' },
        loading: false
    };

    let currentPage = 1;
    let perPage = 10;
    let sortField: keyof Resource | 'name' = 'name';
    let sortOrder: 'asc' | 'desc' = 'asc';
    let filterSearch = '';
    let filterFormats: string[] = [];
    let controller: AbortController | null = null;
    let hasLoadedForSession = false;
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleSearchLoad() {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentPage = 1;
            loadApps();
            searchDebounceTimer = null;
        }, 300);
    }

    $: if (browser && open && !hasLoadedForSession) {
        filterSearch = '';
        filterFormats = [];
        if (currentPage < 1) currentPage = 1;
        hasLoadedForSession = true;
        resultsPanelOpen = true; // show results by default when opening (bundle mode)
        loadApps();
        tick().then(() => updateResultsMenuPosition());
    }

    $: if (!open) hasLoadedForSession = false;

    async function loadApps() {
        try {
            tableData = { ...tableData, loading: true };
            const params = new URLSearchParams();
            if (resourceMode) {
                params.append('page', String(currentPage));
                params.append('pageSize', String(perPage));
                params.append('sort', (sortField as string) || 'createdAt');
                params.append('order', sortOrder);
                if (filterSearch) params.append('search', filterSearch);
                if (resourceRuleId) params.append('ruleId', resourceRuleId);
                if (resourceExcludePackages?.length) params.append('excludePackages', resourceExcludePackages.join(','));
            } else {
                params.append('page', String(currentPage));
                params.append('per_page', String(perPage));
                params.append('sort', sortField);
                params.append('order', sortOrder);
                if (filterSearch) params.append('search', filterSearch);
                if (filterFormats.length > 0) params.append('formats', filterFormats.join(','));
            }
            if (controller) controller.abort();
            controller = new AbortController();
            const url = resourceMode
                ? `${resourcesEndpoint}?${params}`
                : `${apiPrefix}/iot/bundles/${bundleId}/components/app_select?${params}`;
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const raw = await response.json();

            let records: Resource[] = (raw?.data?.items ?? raw?.items ?? raw?.resources ?? []) as Resource[];
            let responsePage = currentPage;
            let responsePerPage = perPage;
            let responseTotal = 0;
            let responseLastPage = 1;

            if (resourceMode) {
                responsePage = raw?.data?.page ?? raw?.meta?.page ?? currentPage;
                responsePerPage = raw?.data?.pageSize ?? raw?.meta?.pageSize ?? perPage;
                responseTotal = raw?.data?.total ?? raw?.meta?.totalItems ?? 0;
                responseLastPage = raw?.data?.totalPages ?? raw?.meta?.totalPages ?? 1;
            } else {
                const meta = raw?.meta ?? raw?.pagination;
                responsePage = meta?.current_page ?? meta?.page ?? currentPage;
                responsePerPage = meta?.per_page ?? meta?.pageSize ?? perPage;
                responseTotal = meta?.total ?? meta?.total_records ?? 0;
                responseLastPage = meta?.last_page ?? meta?.total_pages ?? 1;
            }

            tableData = {
                ...tableData,
                loading: false,
                records,
                pagination: { page: responsePage, per_page: responsePerPage, total_records: responseTotal, total_pages: responseLastPage },
                sort: { field: sortField, order: sortOrder }
            };
        } catch (error) {
            if ((error as any)?.name === 'AbortError') return;
            console.error('Failed to load apps:', error);
            toast.error('Failed to load apps. Please try again.');
            tableData = { ...tableData, loading: false };
        }
    }

    const dispatch = createEventDispatcher<{
        select: { id: string; name: string; packageName?: string | null; autoOpen: boolean }[];
        close: void;
        autoOpenChange: boolean;
    }>();

    function closeDialog() {
        open = false;
        selectedItems = [];
        resultsPanelOpen = false; // Reset panel state
        dispatch('close');
    }

    function handleRowClick(resource: Resource) {
        const idx = selectedItems.findIndex((i) => i.resource.id === resource.id);
        if (idx >= 0) {
            selectedItems = selectedItems.filter((_, i) => i !== idx);
        } else {
            selectedItems = [...selectedItems, { resource, autoOpen }];
        }
        selectedItems = selectedItems;
        resultsPanelOpen = false; // close results panel after selecting an app
    }

    function removeSelected(index: number) {
        selectedItems = selectedItems.filter((_, i) => i !== index);
    }

    function setItemAutoOpen(index: number, value: boolean) {
        selectedItems = selectedItems.map((item, i) => (i === index ? { ...item, autoOpen: value } : item));
        selectedItems = selectedItems;
    }

    function handleAssign() {
        if (selectedItems.length === 0) return;
        dispatch('select', selectedItems.map(({ resource, autoOpen: ao }) => ({
            id: resource.id,
            name: resource.name,
            packageName: (resource as any).packageName ?? null,
            autoOpen: ao
        })));
        selectedItems = [];
        closeDialog();
    }

    function handleClose() {
        filterSearch = '';
        filterFormats = [];
        currentPage = 1;
        hasLoadedForSession = false;
        resultsPanelOpen = false; // Reset panel state when closing
        closeDialog();
    }

    /** Upload / created time for list rows (matches Install New App density). */
    function formatResourceCreatedAt(resource: Resource): string {
        const r = resource as Resource & { createdAt?: Date | string | null };
        const d = r.createdAt;
        if (d == null) return '—';
        const date = typeof d === 'string' ? new Date(d) : d instanceof Date ? d : new Date(String(d));
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function getIdAndUploadLine(resource: Resource): string {
        return `${resource.id} - ${formatResourceCreatedAt(resource)}`;
    }

    function formatVersionLabel(version: string | null | undefined): string {
        if (!version?.trim()) return '';
        const t = version.trim();
        return /^v\d/i.test(t) ? t : `v${t}`;
    }

    /** Line 3: package · version (same pattern as device install modal). */
    function getPackageVersionLine(resource: Resource): string {
        const r = resource as Resource & { packageName?: string | null; version?: string | null };
        const pkg = (r.packageName || '').trim() || resource.id || '—';
        const ver = formatVersionLabel(r.version ?? null);
        return ver ? `${pkg} · ${ver}` : pkg;
    }

    let searchComboRef: HTMLDivElement;
    let resultsMenuRect = { top: 0, left: 0, width: 0 };
    let resultsPanelOpen = false;

    function updateResultsMenuPosition() {
        if (!searchComboRef || !browser) return;
        tick().then(() => {
            requestAnimationFrame(() => {
                if (searchComboRef) {
                    const r = searchComboRef.getBoundingClientRect();
                    resultsMenuRect = { top: r.bottom + 4, left: r.left, width: r.width };
                }
            });
        });
    }

    $: if (filterSearch && open) {
        resultsPanelOpen = true;
        updateResultsMenuPosition();
    }

    $: if ((resourceMode || resultsPanelOpen) && open) {
        updateResultsMenuPosition();
    }


    let clickOutsideEnabled = false;

    function handleClickOutside(e: MouseEvent) {
        if (!clickOutsideEnabled) return; // Don't handle clicks until enabled
        if (open && resultsPanelOpen && searchComboRef && !searchComboRef.contains(e.target as Node)) {
            resultsPanelOpen = false;
        }
    }

    // Enable click-outside handler after a short delay when modal opens
    $: if (open && resultsPanelOpen) {
        setTimeout(() => {
            clickOutsideEnabled = true;
        }, 100);
    } else {
        clickOutsideEnabled = false;
    }

    onMount(() => {
        if (!browser) return;
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });
</script>

<Modal
    bind:open
    title="Add App"
    type="default"
    size="md"
    showFooter={false}
    showCloseButton={true}
    on:close={handleClose}
>
    <div class="add-app-modal-body">
        <!-- 1. Search + results dropdown (design: like Dropdown – results in a panel under the input, not a separate block) -->
        <div class="add-app-search-combo" class:add-app-results-open={resultsPanelOpen} bind:this={searchComboRef}>
            <div class="add-app-search-wrap">
                <InputField
                    type="search"
                    placeholder="Search and select app"
                    bind:value={filterSearch}
                    suffixIcon={true}
                    on:input={() => scheduleSearchLoad()}
                    on:change={() => { currentPage = 1; loadApps(); }}
                >
                    <span
                        slot="suffix-icon"
                        role="button"
                        tabindex="-1"
                        aria-label="Close search results"
                        on:click|stopPropagation={() => (resultsPanelOpen = false)}
                        on:keydown|stopPropagation={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (resultsPanelOpen = false))}
                    >
                        <Search size={22} />
                    </span>
                </InputField>
            </div>
            {#if open && (resourceMode || resultsPanelOpen)}
                <div
                    class="add-app-results-menu add-app-results-menu-fixed"
                    role="listbox"
                    style="top: {resultsMenuRect.top}px; left: {resultsMenuRect.left}px; width: {resultsMenuRect.width}px;"
                >
                    {#if tableData.loading}
                        <div class="add-app-results-empty">Loading…</div>
                    {:else if tableData.records.length === 0}
                        <div class="add-app-results-empty">{#if resourceMode && !filterSearch}No apps available.{:else}No apps match your search.{/if}</div>
                    {:else}
                        <div class="add-app-results-options">
                            {#each tableData.records as resource (resource.id)}
                                {@const isSelected = selectedItems.some((i) => i.resource.id === resource.id)}
                                <button
                                    type="button"
                                    class="add-app-result-option"
                                    class:add-app-result-option-selected={isSelected}
                                    disabled={isSelected}
                                    on:click={() => handleRowClick(resource)}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <div class="add-app-result-option-content">
                                        <span class="add-app-result-option-text">{resource.name}</span>
                                        <span class="add-app-result-option-meta">{getIdAndUploadLine(resource)}</span>
                                        <span class="add-app-result-option-supporting">{getPackageVersionLine(resource)}</span>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- 3. Selected list (design: "Selected (2 items)" then rows with App name, Package, Auto open, X) -->
        <div class="add-app-selected-wrap">
            <h4 class="add-app-selected-heading">Selected ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})</h4>
            <div class="add-app-selected-list">
                {#if selectedItems.length === 0}
                    <p class="add-app-selected-empty">No apps selected</p>
                {:else}
                    {#each selectedItems as item, index}
                        <div class="add-app-selected-row">
                            <div class="add-app-selected-content">
                                <span class="add-app-selected-name">{item.resource.name}</span>
                                <span class="add-app-selected-meta">{getIdAndUploadLine(item.resource)}</span>
                                <span class="add-app-selected-package">{getPackageVersionLine(item.resource)}</span>
                            </div>
                            <div class="add-app-selected-actions">
                                <div class="add-app-auto-open">
                                    <span class="add-app-auto-open-label">Auto open</span>
                                    <Tooltip text="Enable to open app automatically after installation" position="top">
                                        <Toggle
                                            size="sm"
                                            checked={item.autoOpen}
                                            on:change={(e) => setItemAutoOpen(index, e.detail)}
                                        />
                                    </Tooltip>
                                </div>
                                <Button
                                    variant="text"
                                    color="gray"
                                    size="sm"
                                    icon={X}
                                    iconPosition="only"
                                    iconSize={20}
                                    aria-label="Remove app"
                                    on:click={() => removeSelected(index)}
                                />
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    </div>

    <svelte:fragment slot="footer">
        <div class="add-app-footer">
            <Button variant="outline" color="primary" size="lg" on:click={handleClose}>
                Cancel
            </Button>
            <Button
                variant="filled"
                color="primary"
                size="lg"
                on:click={handleAssign}
                disabled={selectedItems.length === 0}
            >
                Assign
            </Button>
        </div>
    </svelte:fragment>
</Modal>

<style>
    /* Full width: modal-body uses align-items: flex-start, so we need align-self: stretch */
    .add-app-modal-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        align-self: stretch;
        width: 100%;
        min-width: 0;
        padding: 0;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        box-sizing: border-box;
    }

    /* Search + dropdown panel (same pattern as Dropdown: panel under trigger) */
    .add-app-search-combo {
        position: relative;
        flex: none;
        width: 100%;
        min-width: 0;
    }

    /* When results panel is open, stack above Selected section so it is not covered */
    .add-app-search-combo.add-app-results-open {
        z-index: 50;
        position: relative;
    }

    /* Design system InputField – full width */
    .add-app-search-wrap {
        width: 100%;
        min-width: 0;
    }

    .add-app-search-wrap :global(.input-field-wrapper),
    .add-app-search-wrap :global(.input-container) {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    /* Results panel – same style as Dropdown menu (design system) */
    .add-app-results-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: var(--ds-space-1);
        z-index: 100;
        isolation: isolate;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        box-shadow: var(--ds-shadow-lg);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 280px;
    }

    /* Fixed positioning so panel paints above modal footer (Cancel/Assign); top/left/width set via JS */
    .add-app-results-menu-fixed {
        position: fixed;
        z-index: 9999;
        margin-top: 0;
        left: 0;
        right: auto;
        top: 0;
    }

    .add-app-results-empty {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
        padding: var(--ds-space-4);
        margin: 0;
        text-align: center;
    }

    .add-app-results-options {
        overflow-y: auto;
        overflow-x: hidden;
        padding: var(--ds-space-1);
        flex: 1;
        min-height: 0;
    }

    /* Option row – same structure as Dropdown option (dropdown-option, dropdown-option-content, dropdown-option-text, dropdown-option-supporting) */
    .add-app-result-option {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-space-2) var(--ds-space-4);
        gap: var(--ds-space-3);
        min-height: 72px;
        width: 100%;
        border: none;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        transition: background-color 0.15s ease;
        background: transparent;
        text-align: left;
        font-family: var(--ds-font-family-primary);
        box-sizing: border-box;
    }

    .add-app-result-option:hover:not(:disabled) {
        background: var(--ds-color-neutral-true-50);
    }

    .add-app-result-option.add-app-result-option-selected,
    .add-app-result-option:disabled {
        background: var(--ds-color-primary-50);
        cursor: default;
    }

    .add-app-result-option-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .add-app-result-option-text {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .add-app-result-option-meta {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-gray-500);
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .add-app-result-option-supporting {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-gray-500);
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .add-app-selected-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        flex: none;
        width: 100%;
        min-width: 0;
    }

    /* Figma: Body/16px/16-Medium, Neutral True/800 (#292929) */
    .add-app-selected-heading {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-base);
        line-height: var(--ds-leading-lg);
        color: var(--ds-color-neutral-true-800);
        margin: 0;
    }

    /* Figma: wrap gap 8px – full width */
    .add-app-selected-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        min-height: 48px;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .add-app-selected-empty {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    /* Figma: _Base/ Option - 54px height, padding 8px 16px, gap 12px, Neutral True/50, radius 6px */
    .add-app-selected-row {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-space-2) var(--ds-space-4);
        gap: var(--ds-space-3);
        min-height: 72px;
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-md);
        width: 100%;
        box-sizing: border-box;
    }

    .add-app-selected-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    /* Figma: Text - Body/14px/14-Regular, Neutral True/900 */
    .add-app-selected-name {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        line-height: 20px;
        color: var(--ds-color-neutral-true-900);
    }

    .add-app-selected-meta {
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    /* Figma: Shortcut - Body/12px/12-Regular, Gray/500 */
    .add-app-selected-package {
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .add-app-selected-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
        flex-shrink: 0;
        align-self: center;
    }

    .add-app-auto-open {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
    }

    /* Figma: Toggle label - Body/14px/14-Medium, Neutral True/800 */
    .add-app-auto-open-label {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        line-height: 20px;
        color: var(--ds-color-neutral-true-800);
    }

    /* Figma: _Modal Footer - justify-content flex-end, padding 16px, gap 16px */
    .add-app-footer {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 0;
        gap: var(--ds-space-4);
        width: 100%;
    }
</style>
