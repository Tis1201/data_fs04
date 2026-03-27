<script context="module" lang="ts">
    export interface AppPickerItem {
        id: string;
        name: string;
        packageName: string;
        /** App version string from the resource row */
        version?: string | null;
        /** Upload/created date - for display and ordering */
        createdAt?: string | null;
    }
</script>

<script lang="ts">
    import { createEventDispatcher, tick, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { Button, Modal, InputField, Checkbox } from '$lib/design-system/components';
    import { Search, X } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import { formatTableDateTime } from '$lib/utils/format';

    // ==========================================================================
    // PROPS
    // ==========================================================================

    /** Whether the modal is open */
    export let open: boolean = false;
    /** Modal title */
    export let title: string = 'Install New App';
    /** Modal size */
    export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
    /** Confirm button text */
    export let confirmText: string = 'Confirm';
    /** Confirm button loading text (shown when confirmLoading is true) */
    export let confirmLoadingText: string = 'Installing…';
    /** Whether the confirm action is in progress */
    export let confirmLoading: boolean = false;
    /** API endpoint to fetch apps from */
    export let appsEndpoint: string = '/api/user/resources/apps';
    /**
     * Extra query params forwarded to the apps endpoint.
     * Pass a stable reference (e.g. a module-level object or a prop from the parent),
     * not an inline `{}` literal, to avoid unnecessary re-renders.
     */
    export let extraParams: Record<string, string> = {};
    /** Package names to exclude from the list (already selected elsewhere) */
    export let excludePackages: string[] = [];
    /** Package names currently installed (shows "Already on device" badge) */
    export let installedPackageNames: Set<string> = new Set();
    /** Whether to show "Already on device" badges */
    export let showAlreadyBadge: boolean = false;
    /** Selection mode: 'id' stores app ids, 'packageName' stores package names */
    export let selectionMode: 'id' | 'packageName' = 'id';

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    const dispatch = createEventDispatcher<{
        close: void;
        confirm: { selected: string[]; apps: AppPickerItem[] };
    }>();

    // ==========================================================================
    // CONSTANTS
    // ==========================================================================

    const PAGE_LIMIT = 100;
    /** px from bottom of dropdown list that triggers fetching the next page */
    const SCROLL_LOAD_THRESHOLD_PX = 100;
    /** ms to wait after the user stops typing before querying the server */
    const SEARCH_DEBOUNCE_MS = 300;

    // ==========================================================================
    // PORTAL ACTION
    // Renders dropdown at document body level to avoid overflow/z-index clipping
    // inside the Modal component (same approach as DeviceSelector).
    // ==========================================================================

    function appendToBody(node: HTMLElement) {
        if (typeof document !== 'undefined') document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        };
    }

    // ==========================================================================
    // STATE
    // ==========================================================================

    let search = '';
    let selected: string[] = [];
    /**
     * Cache of selected AppPickerItems keyed by their selection key.
     * Survives cross-search cycles so the Selected section always shows full
     * app details even after the user changes the search term.
     */
    let selectedAppCache = new Map<string, AppPickerItem>();

    let dropdownOpen = false;
    let dropdownInteracting = false;
    let inputContainer: HTMLDivElement;
    let dropdownPortalEl: HTMLElement | null = null;
    let dropdownRect: { top: number; left: number; width: number } | null = null;
    let scrollResizeCleanup: (() => void) | null = null;

    let options: AppPickerItem[] = [];
    let optionsLoading = false;
    let loadingMore = false;
    let hasMorePages = false;
    /** Next 1-based page number to fetch for infinite scroll */
    let nextPage = 1;
    /** Incremented on every loadOptions call; loadMoreApps bails if it changed (race guard) */
    let fetchEpoch = 0;
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let prevSearch = '';

    const listboxId = 'app-picker-listbox';

    // ==========================================================================
    // REACTIVE — search debounce + open/close lifecycle
    // ==========================================================================

    // Debounced server-side search: re-fetches from page 1 when search changes.
    $: if (browser && open && search !== prevSearch) {
        prevSearch = search;
        if (searchDebounceTimer != null) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchDebounceTimer = null;
            void loadOptions();
        }, SEARCH_DEBOUNCE_MS);
    }

    let prevOpen = false;
    $: if (open && !prevOpen) {
        prevOpen = true;
        resetAndLoad();
    } else if (!open && prevOpen) {
        prevOpen = false;
        dropdownOpen = false;
        dropdownInteracting = false;
        dropdownRect = null;
        search = '';
        prevSearch = '';
        if (searchDebounceTimer != null) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
    }

    // ==========================================================================
    // REACTIVE — portal dropdown positioning
    // ==========================================================================

    function updateDropdownPosition() {
        if (!inputContainer || !dropdownOpen) return;
        const r = inputContainer.getBoundingClientRect();
        dropdownRect = { left: r.left, top: r.bottom + 8, width: r.width };
    }

    $: if (browser && dropdownOpen && inputContainer) {
        updateDropdownPosition();
        // Double-rAF ensures layout/paint are complete before reading dimensions.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => updateDropdownPosition());
        });
    } else if (!dropdownOpen) {
        dropdownRect = null;
    }

    // Re-position whenever the selected list changes: the Modal is vertically
    // centered, so adding/removing chips shifts the modal and search input.
    $: if (browser && dropdownOpen && inputContainer && selected) {
        requestAnimationFrame(() => updateDropdownPosition());
    }

    /**
     * Keep portal position in sync with parent scroll / window resize.
     * The portal element itself is excluded from the listener list to prevent a
     * feedback loop (scrolling inside the dropdown would re-position it, causing jitter).
     */
    $: if (browser && dropdownOpen && inputContainer) {
        if (scrollResizeCleanup) {
            scrollResizeCleanup();
            scrollResizeCleanup = null;
        }
        const onSync = () => updateDropdownPosition();
        const scrollTargets: (Window | Element)[] = [window];
        let el: Element | null = inputContainer;
        while (el) {
            if (el !== dropdownPortalEl) {
                const style = getComputedStyle(el);
                const overflow = style.overflow + style.overflowY + style.overflowX;
                if (/\b(auto|scroll|overlay)\b/.test(overflow)) scrollTargets.push(el);
            }
            el = el.parentElement;
        }
        scrollTargets.forEach((t) => t.addEventListener('scroll', onSync, true));
        window.addEventListener('resize', onSync);
        scrollResizeCleanup = () => {
            scrollTargets.forEach((t) => t.removeEventListener('scroll', onSync, true));
            window.removeEventListener('resize', onSync);
        };
    } else {
        if (scrollResizeCleanup) {
            scrollResizeCleanup();
            scrollResizeCleanup = null;
        }
    }

    // ==========================================================================
    // DATA HELPERS
    // ==========================================================================

    function mapRawToOption(item: Record<string, unknown>): AppPickerItem {
        return {
            id: String(item.id ?? ''),
            name: (item.name as string) || 'Unknown App',
            packageName: (item.packageName as string) || '-',
            version: item.version != null ? String(item.version) : null,
            createdAt: (item.createdAt as string | null | undefined) ?? null
        };
    }

    /**
     * Merge paginated batches; dedupe by resource id (each row is a package + version).
     */
    function mergeOptions(existing: AppPickerItem[], incoming: AppPickerItem[]): AppPickerItem[] {
        const seen = new Set(existing.map((a) => a.id));
        const out = [...existing];
        for (const a of incoming) {
            if (a.id && !seen.has(a.id)) {
                seen.add(a.id);
                out.push(a);
            }
        }
        return out;
    }

    /** Supports flat `{ items, meta }` (user route) and wrapped `{ success, data: { items, meta } }` (v2 unified). */
    function parseAppsResponse(body: Record<string, unknown>): {
        rawItems: Record<string, unknown>[];
        meta: Record<string, unknown>;
    } {
        const data = body?.data as Record<string, unknown> | undefined;
        if (data && Array.isArray(data.items)) {
            return {
                rawItems: data.items as Record<string, unknown>[],
                meta: (data.meta as Record<string, unknown>) ?? {}
            };
        }
        return {
            rawItems: (body.items as Record<string, unknown>[]) ?? [],
            meta: (body.meta as Record<string, unknown>) ?? {}
        };
    }

    // ==========================================================================
    // FETCHING
    // ==========================================================================

    async function fetchAppsPage(
        page: number,
        searchTerm: string
    ): Promise<{ batch: AppPickerItem[]; meta: Record<string, unknown> }> {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(PAGE_LIMIT));
        params.set('sort', 'createdAt');
        params.set('order', 'desc');
        for (const [k, v] of Object.entries(extraParams)) {
            if (v != null && v !== '') params.set(k, v);
        }
        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (excludePackages.length) params.set('excludePackages', excludePackages.join(','));

        const res = await fetch(`${appsEndpoint}?${params}`);
        if (!res.ok) throw new Error('Failed to load apps');
        const body = (await res.json()) as Record<string, unknown>;
        const { rawItems, meta } = parseAppsResponse(body);
        return { batch: rawItems.map(mapRawToOption), meta };
    }

    function syncPagingAfterFetch(page: number, batch: AppPickerItem[], meta: Record<string, unknown>) {
        const pageSize = Math.min(100, Math.max(1, Number(meta.pageSize) || PAGE_LIMIT));

        if (batch.length === 0) {
            hasMorePages = false;
            nextPage = page;
            return;
        }

        if (meta.hasNext === true) {
            hasMorePages = true;
        } else if (meta.hasNext === false) {
            hasMorePages = false;
        } else {
            hasMorePages = batch.length >= pageSize;
        }

        nextPage = page + 1;
    }

    async function resetAndLoad() {
        if (searchDebounceTimer != null) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        prevSearch = '';
        search = '';
        selected = [];
        selectedAppCache.clear();
        dropdownOpen = false;
        dropdownInteracting = false;
        dropdownRect = null;
        await loadOptions();
        await tick();
        await tick();
        const tryOpenDropdown = (retries = 0) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (inputContainer) {
                        dropdownOpen = true;
                    } else if (retries < 5) {
                        tryOpenDropdown(retries + 1);
                    }
                });
            });
        };
        tryOpenDropdown();
        setTimeout(updateDropdownPosition, 50);
    }

    async function loadOptions() {
        fetchEpoch += 1;
        const myEpoch = fetchEpoch;

        optionsLoading = true;
        loadingMore = false;
        hasMorePages = false;
        nextPage = 1;

        try {
            const { batch, meta } = await fetchAppsPage(1, search);
            if (myEpoch !== fetchEpoch) return;
            options = batch;
            syncPagingAfterFetch(1, batch, meta);
        } catch {
            if (myEpoch !== fetchEpoch) return;
            toast.error('Failed to load apps. Please try again.');
            options = [];
            hasMorePages = false;
            nextPage = 1;
        } finally {
            if (myEpoch === fetchEpoch) optionsLoading = false;
        }
    }

    async function loadMoreApps() {
        if (!hasMorePages || optionsLoading || loadingMore) return;
        loadingMore = true;
        const myEpoch = fetchEpoch;
        const pageToFetch = nextPage;
        try {
            const { batch, meta } = await fetchAppsPage(pageToFetch, search);
            if (myEpoch !== fetchEpoch) return;
            if (batch.length === 0) {
                hasMorePages = false;
                nextPage = pageToFetch;
            } else {
                options = mergeOptions(options, batch);
                syncPagingAfterFetch(pageToFetch, batch, meta);
            }
        } catch {
            if (myEpoch !== fetchEpoch) return;
            toast.error('Failed to load more apps.');
        } finally {
            if (myEpoch === fetchEpoch) loadingMore = false;
        }
    }

    function handleDropdownScroll(e: Event) {
        const el = e.currentTarget as HTMLElement;
        if (el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_LOAD_THRESHOLD_PX) return;
        void loadMoreApps();
    }

    // ==========================================================================
    // SELECTION
    // ==========================================================================

    function getSelectionKey(app: AppPickerItem): string {
        return selectionMode === 'packageName' ? app.packageName : app.id;
    }

    function toggleSelection(app: AppPickerItem) {
        const key = getSelectionKey(app);
        if (selected.includes(key)) {
            selected = selected.filter((k) => k !== key);
            selectedAppCache.delete(key);
        } else {
            selected = [...selected, key];
            selectedAppCache.set(key, app);
        }
    }

    function removeSelection(key: string) {
        selected = selected.filter((k) => k !== key);
        selectedAppCache.delete(key);
    }

    function handleSelectAll() {
        const entries = options.map((a) => ({ key: getSelectionKey(a), app: a }));
        const keys = entries.map((e) => e.key);
        const allSelected = keys.length > 0 && keys.every((k) => selected.includes(k));
        if (allSelected) {
            selected = selected.filter((k) => !keys.includes(k));
            keys.forEach((k) => selectedAppCache.delete(k));
        } else {
            entries.forEach(({ key, app }) => {
                if (!selected.includes(key)) selectedAppCache.set(key, app);
            });
            selected = [...new Set([...selected, ...keys])];
        }
    }

    /**
     * Resolve full AppPickerItem from a selection key.
     * Checks the cross-search cache first so app details are available
     * even if the user has changed the search term since selecting the app.
     */
    function findAppByKey(key: string): AppPickerItem | undefined {
        const cached = selectedAppCache.get(key);
        if (cached) return cached;
        if (selectionMode === 'packageName') {
            return options.find((a) => a.packageName === key);
        }
        return options.find((a) => a.id === key);
    }

    // ==========================================================================
    // EVENT HANDLERS
    // ==========================================================================

    function handleFocus() {
        dropdownOpen = true;
    }

    function handleBlur() {
        setTimeout(() => {
            if (!dropdownInteracting) dropdownOpen = false;
        }, 150);
    }

    function handleInputClick() {
        dropdownOpen = true;
    }

    function handleWindowMouseDown(e: MouseEvent) {
        if (!dropdownOpen || !inputContainer) return;
        const target = e.target as HTMLElement;
        if (inputContainer.contains(target)) return;
        // Portal div lives at body level; don't close when clicking inside it.
        if (target.closest('.app-picker-dropdown-portal')) return;
        dropdownOpen = false;
    }

    function handleClose() {
        dispatch('close');
    }

    function handleConfirm() {
        const selectedApps = selected
            .map((key) => findAppByKey(key))
            .filter((a): a is AppPickerItem => !!a);
        dispatch('confirm', { selected, apps: selectedApps });
    }

    onDestroy(() => {
        if (searchDebounceTimer != null) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        if (scrollResizeCleanup) {
            scrollResizeCleanup();
            scrollResizeCleanup = null;
        }
    });
</script>

<Modal
    {open}
    {title}
    {size}
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={handleClose}
>
    <!-- Combobox: search input -->
    <div
        class="w-full app-picker-input-container"
        style="margin-bottom: var(--ds-space-4);"
        bind:this={inputContainer}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        tabindex="0"
        on:click={handleInputClick}
        on:keydown={(e) => {
            if (e.target !== inputContainer) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleInputClick();
            }
        }}
    >
        <InputField
            type="text"
            placeholder="Search and select app"
            suffixIcon={true}
            bind:value={search}
            state={dropdownOpen ? 'focused' : 'default'}
            on:focus={handleFocus}
            on:blur={handleBlur}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>
    </div>

    <!-- Portal: rendered at document.body level to avoid modal overflow clipping -->
    {#if dropdownOpen && dropdownRect}
        <div
            use:appendToBody
            bind:this={dropdownPortalEl}
            id={listboxId}
            role="listbox"
            tabindex="-1"
            class="app-picker-dropdown app-picker-dropdown-portal"
            style="position: fixed; top: {dropdownRect.top}px; left: {dropdownRect.left}px; width: {dropdownRect.width}px; z-index: 9999;"
            on:scroll={handleDropdownScroll}
            on:mouseenter={() => (dropdownInteracting = true)}
            on:mouseleave={() => (dropdownInteracting = false)}
            on:mousedown|stopPropagation={() => (dropdownInteracting = true)}
        >
            {#if optionsLoading}
                <div class="app-picker-empty">Loading…</div>
            {:else}
                <!-- Select All row; disabled while more pages remain unloaded -->
                {@const keys = options.map((a) => getSelectionKey(a))}
                {@const allSelected = keys.length > 0 && keys.every((k) => selected.includes(k))}
                {@const selectAllDisabled = keys.length === 0 || hasMorePages}
                <div
                    role="button"
                    tabindex="0"
                    class="app-picker-option app-picker-select-all"
                    on:click|stopPropagation={() => !selectAllDisabled && handleSelectAll()}
                    on:keydown={(e) =>
                        (e.key === 'Enter' || e.key === ' ') &&
                        !selectAllDisabled &&
                        (e.preventDefault(), handleSelectAll())}
                >
                    <span class="app-picker-checkbox-visual" aria-hidden="true">
                        <Checkbox checked={allSelected} size="sm" disabled={selectAllDisabled} />
                    </span>
                    <span class="app-picker-option-name">
                        Select All{hasMorePages ? ' (scroll to load all)' : ''}
                    </span>
                </div>
                {#each options as app (app.id)}
                    {@const key = getSelectionKey(app)}
                    {@const isSelected = selected.includes(key)}
                    {@const alreadyInstalled =
                        showAlreadyBadge && app.packageName && installedPackageNames.has(app.packageName.trim())}
                    <!-- TC-RDM-APR-0024: Use div + visual-only Checkbox. A <button> containing <label>
                         is invalid HTML and causes checkbox click to behave inconsistently. -->
                    <div
                        role="button"
                        tabindex="0"
                        class="app-picker-option"
                        on:click|stopPropagation={() => toggleSelection(app)}
                        on:keydown={(e) =>
                            e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), toggleSelection(app)) : null}
                    >
                        <span class="app-picker-checkbox-visual" aria-hidden="true">
                            <Checkbox checked={isSelected} size="sm" disabled={false} />
                        </span>
                        <div class="app-picker-option-content">
                            <span class="app-picker-option-name">{app.name}</span>
                            <span class="app-picker-option-meta"
                                >{app.id}{#if app.createdAt}{' - '}{formatTableDateTime(app.createdAt)}{/if}</span
                            >
                            <span class="app-picker-option-package">
                                {app.packageName}{#if app.version}{' · v'}{app.version}{/if}
                                {#if alreadyInstalled}
                                    <span class="app-picker-already-badge">Already on device</span>
                                {/if}
                            </span>
                        </div>
                    </div>
                {/each}
                {#if options.length === 0}
                    <div class="app-picker-empty">No apps found</div>
                {/if}
                {#if loadingMore}
                    <div class="app-picker-loading-more">Loading more…</div>
                {/if}
            {/if}
        </div>
    {/if}

    <!-- Selected chips -->
    <div class="w-full app-picker-selected-section">
        <p class="app-picker-selected-label">Selected ({selected.length} items)</p>
        <div class="app-picker-selected-container">
            {#each selected as key}
                {@const app = findAppByKey(key)}
                <div class="app-picker-selected-item">
                    <div class="app-picker-selected-content">
                        <span class="app-picker-selected-name">{app?.name ?? key}</span>
                        <span class="app-picker-selected-meta"
                            >ID: {app?.id ?? key}{#if app?.version}{' · v'}{app.version}{/if}{#if app?.createdAt}{' · '}{formatTableDateTime(
                                app.createdAt
                            )}{/if}</span
                        >
                        <span class="app-picker-selected-package">{app?.packageName ?? key}</span>
                    </div>
                    <Button
                        variant="text"
                        size="sm"
                        icon={X}
                        iconPosition="only"
                        iconSize={16}
                        on:click={() => removeSelection(key)}
                        aria-label="Remove"
                    />
                </div>
            {/each}
            {#if selected.length === 0}
                <span class="app-picker-empty-state">No apps selected</span>
            {/if}
        </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px;"
            on:click={handleClose}
            disabled={confirmLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={handleConfirm}
            disabled={confirmLoading || selected.length === 0}
            style="height: 44px; min-width: 100px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {confirmLoading ? confirmLoadingText : confirmText}
        </Button>
    </div>
</Modal>

<svelte:window on:mousedown={handleWindowMouseDown} />

<style>
    /* ========================================================================
     * App Picker Modal Styles (same as device Install New App)
     * ======================================================================== */

    .app-picker-input-container {
        position: relative;
        overflow: visible;
        z-index: 10;
    }

    .app-picker-dropdown {
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        max-height: 240px;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: var(--ds-shadow-lg);
        padding: var(--ds-space-1);
        display: flex;
        flex-direction: column;
    }

    .app-picker-dropdown::-webkit-scrollbar {
        width: 16px;
    }
    .app-picker-dropdown::-webkit-scrollbar-track {
        background: var(--ds-bg-secondary);
    }
    .app-picker-dropdown::-webkit-scrollbar-thumb {
        background: var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-lg);
        border: 4px solid var(--ds-bg-secondary);
    }

    .app-picker-option {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: var(--ds-space-3);
        padding: var(--ds-space-2) var(--ds-space-4);
        border: none;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease;
    }

    .app-picker-select-all {
        border-bottom: 1px solid var(--ds-border-default);
    }

    /* TC-RDM-APR-0024: Checkbox is visual-only. pointer-events: none ensures
       clicks pass through to the row div so toggle works consistently everywhere. */
    .app-picker-checkbox-visual {
        pointer-events: none;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .app-picker-option:hover {
        background: var(--ds-color-neutral-true-50);
    }

    .app-picker-option-content {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        flex: 1;
    }

    .app-picker-option-meta {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-400);
    }

    .app-picker-option-name {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
    }

    .app-picker-option-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .app-picker-already-badge {
        margin-left: var(--ds-space-2);
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 500;
        color: var(--ds-color-gray-600);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-sm);
    }

    .app-picker-empty {
        padding: var(--ds-space-3) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    .app-picker-loading-more {
        padding: var(--ds-space-2) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        color: var(--ds-color-gray-400);
        font-style: italic;
    }

    .app-picker-selected-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-neutral-true-800);
        margin: 0 0 var(--ds-space-2) 0;
    }

    .app-picker-selected-container {
        display: flex;
        flex-direction: column;
        gap: 0;
        height: 160px;
        overflow-y: auto;
    }

    .app-picker-selected-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-3) 0;
        border-bottom: 1px solid var(--ds-border-default);
    }

    .app-picker-selected-content {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .app-picker-selected-meta {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .app-picker-selected-name {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-neutral-true-800);
    }

    .app-picker-selected-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .app-picker-empty-state {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
        padding: var(--ds-space-3) 0;
    }
</style>
