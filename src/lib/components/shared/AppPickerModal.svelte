<script context="module" lang="ts">
    export interface AppPickerItem {
        id: string;
        name: string;
        packageName: string;
    }
</script>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { Button, Modal, InputField, Checkbox } from '$lib/design-system/components';
    import { Search, X } from 'lucide-svelte';

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
    /** Extra query params to pass to the apps endpoint */
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
    // STATE
    // ==========================================================================

    let search = '';
    let selected: string[] = [];
    let dropdownOpen = false;
    let dropdownInteracting = false;
    let inputContainer: HTMLDivElement;
    let dropdownPosition = { top: 0, left: 0, width: 0 };
    let options: AppPickerItem[] = [];
    let optionsLoading = false;

    // ==========================================================================
    // REACTIVE
    // ==========================================================================

    $: filteredOptions = options.filter(
        (app) =>
            app.name.toLowerCase().includes(search.toLowerCase()) ||
            app.packageName.toLowerCase().includes(search.toLowerCase())
    );

    // Track previous open state to detect open/close transitions
    let prevOpen = false;
    $: if (open && !prevOpen) {
        prevOpen = true;
        resetAndLoad();
    } else if (!open && prevOpen) {
        prevOpen = false;
        dropdownOpen = false;
        dropdownInteracting = false;
    }

    // ==========================================================================
    // FUNCTIONS
    // ==========================================================================

    async function resetAndLoad() {
        search = '';
        selected = [];
        dropdownOpen = false;
        dropdownInteracting = false;
        await loadOptions();
        // Wait for DOM, then open dropdown
        await tick();
        await tick();
        if (inputContainer) {
            dropdownOpen = true;
            updateDropdownPosition();
        } else {
            // Fallback: wait for container to be bound
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (inputContainer) {
                        dropdownOpen = true;
                        updateDropdownPosition();
                    }
                });
            });
        }
    }

    async function loadOptions() {
        optionsLoading = true;
        try {
            const params = new URLSearchParams({ pageSize: '100', ...extraParams });
            if (excludePackages.length) {
                params.set('excludePackages', excludePackages.join(','));
            }
            const res = await fetch(`${appsEndpoint}?${params}`);
            if (!res.ok) throw new Error('Failed to load apps');
            const data = await res.json();
            const items = data?.data?.items ?? data?.items ?? [];
            options = items.map((item: any) => ({
                id: item.id,
                name: item.name || 'Unknown App',
                packageName: item.packageName || '-'
            }));
        } catch {
            options = [];
        } finally {
            optionsLoading = false;
        }
    }

    function updateDropdownPosition() {
        if (inputContainer) {
            const rect = inputContainer.getBoundingClientRect();
            dropdownPosition = {
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            };
        }
    }

    async function handleFocus() {
        dropdownOpen = true;
        await tick();
        updateDropdownPosition();
    }

    function handleBlur() {
        setTimeout(() => {
            if (!dropdownInteracting) {
                dropdownOpen = false;
            }
        }, 150);
    }

    function handleInputClick() {
        dropdownOpen = true;
        tick().then(() => updateDropdownPosition());
    }

    /** Close dropdown when clicking outside the search/dropdown area (e.g. Selected section or footer) */
    function handleWindowMouseDown(e: MouseEvent) {
        if (!dropdownOpen || !inputContainer) return;
        const target = e.target as Node;
        if (!inputContainer.contains(target)) {
            dropdownOpen = false;
        }
    }

    function getSelectionKey(app: AppPickerItem): string {
        return selectionMode === 'packageName' ? app.packageName : app.id;
    }

    function toggleSelection(app: AppPickerItem) {
        const key = getSelectionKey(app);
        if (selected.includes(key)) {
            selected = selected.filter((k) => k !== key);
        } else {
            selected = [...selected, key];
        }
        dropdownInteracting = false;
    }

    function removeSelection(key: string) {
        selected = selected.filter((k) => k !== key);
    }

    function findAppByKey(key: string): AppPickerItem | undefined {
        if (selectionMode === 'packageName') {
            return options.find((a) => a.packageName === key);
        }
        return options.find((a) => a.id === key);
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
    <div
        class="w-full app-picker-input-container"
        style="margin-bottom: var(--ds-space-4);"
        bind:this={inputContainer}
        role="combobox"
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        on:click={handleInputClick}
    >
        <InputField
            type="text"
            placeholder="Search and select app"
            bind:value={search}
            state={dropdownOpen ? 'focused' : 'default'}
            on:focus={handleFocus}
            on:blur={handleBlur}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>
        {#if dropdownOpen}
            <div
                role="listbox"
                tabindex="-1"
                class="app-picker-dropdown"
                style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px;"
                on:mouseenter={() => (dropdownInteracting = true)}
                on:mouseleave={() => (dropdownInteracting = false)}
            >
                {#if optionsLoading}
                    <div class="app-picker-empty">Loading…</div>
                {:else}
                    {#key selected.join(',')}
                    {#each filteredOptions as app (app.id)}
                        {@const key = getSelectionKey(app)}
                        {@const isSelected = selected.includes(key)}
                        {@const alreadyInstalled = showAlreadyBadge && app.packageName && installedPackageNames.has(app.packageName.trim())}
                        <button
                            type="button"
                            class="app-picker-option"
                            on:mousedown|preventDefault={() => toggleSelection(app)}
                        >
                            <Checkbox
                                checked={isSelected}
                                size="sm"
                                disabled={false}
                            />
                            <div class="app-picker-option-content">
                                <span class="app-picker-option-name">{app.name}</span>
                                <span class="app-picker-option-package">
                                    {app.packageName}
                                    {#if alreadyInstalled}
                                        <span class="app-picker-already-badge">Already on device</span>
                                    {/if}
                                </span>
                            </div>
                        </button>
                    {/each}
                    {/key}
                    {#if filteredOptions.length === 0}
                        <div class="app-picker-empty">No apps found</div>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>
    <div class="w-full">
        <p class="app-picker-selected-label">Selected ({selected.length} items)</p>
        <div class="app-picker-selected-container">
            {#each selected as key}
                {@const app = findAppByKey(key)}
                <div class="app-picker-selected-item">
                    <div class="app-picker-selected-content">
                        <span class="app-picker-selected-name">{app?.name ?? key}</span>
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
        position: fixed;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        max-height: 240px;
        min-height: 120px;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 150;
        box-shadow: var(--ds-shadow-lg);
        padding: var(--ds-space-1);
        display: flex;
        flex-direction: column;
        margin-top: var(--ds-space-1);
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
        align-items: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-2) var(--ds-space-4);
        border: none;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease;
        min-height: 54px;
    }

    .app-picker-option:hover {
        background: var(--ds-color-neutral-true-50);
    }

    .app-picker-option-content {
        display: flex;
        flex-direction: column;
        gap: 0;
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
