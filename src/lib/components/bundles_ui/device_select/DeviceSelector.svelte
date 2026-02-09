<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { X, Search } from 'lucide-svelte';
  import { toast } from '$lib/stores/alertToast';
  import { Modal, Button, InputField } from '$lib/design-system/components';

  /** Portal: render dropdown in body so it is not clipped by modal (modal has transform+overflow which clips fixed descendants) */
  function appendToBody(node: HTMLElement) {
    if (typeof document !== 'undefined') document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  interface Device {
    id: string;
    name: string;
    status: string;
    model?: string;
    description?: string;
    createdAt?: string;
    lastUsedAt?: string;
    connected?: boolean;
    macAddress?: string;
    wifiMac?: string;
    lanMac?: string;
  }

  export let bundleId: string;
  export let apiPrefix: string = '/api/admin';
  export let devicesEndpoint: string | null = null;
  export let excludeDeviceIds: string[] = [];

  let tableData = {
    records: [] as Device[],
    loading: false
  };

  let filterSearch = '';
  let controller: AbortController | null = null;
  let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  let searchDropdownOpen = false;
  let searchWrapRef: HTMLElement | null = null;
  let dropdownRect: { left: number; top: number; width: number } | null = null;

  export let open = false;
  let selectedDevices: Device[] = [];

  const dispatch = createEventDispatcher<{
    select: { id: string; name: string }[];
    close: void;
  }>();

  function getMacDisplay(device: Device): string {
    return device.macAddress || device.wifiMac || device.lanMac || '—';
  }

  function addToSelected(device: Device) {
    if (selectedDevices.some((d) => d.id === device.id)) return;
    selectedDevices = [...selectedDevices, device];
  }

  function removeFromSelected(device: Device) {
    selectedDevices = selectedDevices.filter((d) => d.id !== device.id);
  }

  async function loadDevices() {
    try {
      tableData = { ...tableData, loading: true };

      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('per_page', '10');
      params.append('sort', 'name');
      params.append('order', 'asc');
      if (filterSearch.trim()) params.append('search', filterSearch.trim());
      if (excludeDeviceIds?.length) params.append('excludeDeviceIds', excludeDeviceIds.join(','));

      const apiUrl = devicesEndpoint
        ? `${devicesEndpoint}?${params}`
        : `${apiPrefix}/iot/bundles/${bundleId}/components/device_select?${params}`;

      if (controller) controller.abort();
      controller = new AbortController();
      const response = await fetch(apiUrl, { signal: controller.signal });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const raw = await response.json();
      let devices: Device[] = [];

      if (devicesEndpoint) {
        devices = raw?.data?.devices || raw?.devices || [];
      } else {
        devices = raw?.devices || [];
      }

      tableData = { ...tableData, loading: false, records: devices };
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      console.error('[DeviceSelector] Failed to load devices:', error);
      toast.error('Failed to load devices. Please try again.');
      tableData = { ...tableData, loading: false };
    }
  }

  function onSearchInput() {
    if (searchDebounceId) clearTimeout(searchDebounceId);
    searchDropdownOpen = true;
    searchDebounceId = setTimeout(() => {
      searchDebounceId = null;
      loadDevices();
    }, 300);
  }

  function onSearchFocus() {
    searchDropdownOpen = true;
  }

  function onSearchBlur() {
    // Delay so mousedown on dropdown items can register before hiding
    setTimeout(() => { searchDropdownOpen = false; }, 200);
  }

  // Click outside to close dropdown
  function handleClickOutside(event: MouseEvent) {
    if (!searchDropdownOpen) return;
    const target = event.target as HTMLElement;
    // Check if click is outside both the search input and the dropdown
    const clickedInput = searchWrapRef?.contains(target);
    const clickedDropdown = target.closest('.add-device-search-dropdown-portal');
    if (!clickedInput && !clickedDropdown) {
      searchDropdownOpen = false;
    }
  }

  // Add/remove click-outside listener when dropdown opens/closes
  $: if (browser) {
    if (searchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (browser) {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  });

  function handleConfirm() {
    if (selectedDevices.length === 0) return;
    dispatch(
      'select',
      selectedDevices.map((d) => ({ id: d.id, name: d.name }))
    );
    selectedDevices = [];
    handleClose();
  }

  function handleCancel() {
    open = false;
    selectedDevices = [];
    dispatch('close');
  }

  function handleClose() {
    filterSearch = '';
    tableData = { records: [], loading: false };
    searchDropdownOpen = false;
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }
    open = false;
    selectedDevices = [];
    dispatch('close');
  }

  // Auto-load devices when modal opens
  $: if (open && browser) {
    searchDropdownOpen = true;
    loadDevices();
  }

  $: showDropdown = searchDropdownOpen && open;
  $: canAdd = (device: Device) => !selectedDevices.some((d) => d.id === device.id);
  $: if (browser && showDropdown && searchWrapRef) {
    const r = searchWrapRef.getBoundingClientRect();
    dropdownRect = { left: r.left, top: r.bottom + 4, width: r.width };
  } else {
    dropdownRect = null;
  }
</script>

<Modal
  bind:open
  title="Add Device"
  size="md"
  type="default"
  showCloseButton={true}
  closeOnBackdrop={true}
  closeOnEscape={true}
  showFooter={true}
  confirmText="Add"
  cancelText="Cancel"
  showCancel={true}
  confirmDisabled={selectedDevices.length === 0}
  on:close={handleClose}
  on:confirm={handleConfirm}
  on:cancel={handleClose}
>
  <div class="add-device-modal-body">
    <!-- Search: dropdown rendered via portal so it sits on top of modal (modal transform+overflow clips in-modal fixed) -->
    <div class="add-device-search-wrap add-device-input-container" bind:this={searchWrapRef}>
      <div class="add-device-search">
        <InputField
          type="text"
          placeholder="Search and select device"
          bind:value={filterSearch}
          state={showDropdown ? 'focused' : 'default'}
          showClearButton={true}
          on:input={onSearchInput}
          on:focus={onSearchFocus}
          on:blur={onSearchBlur}
          on:clear={() => { filterSearch = ''; loadDevices(); }}
          label=""
          suffixIcon={true}
        >
          <svelte:fragment slot="suffix-icon">
            <Search size={20} />
          </svelte:fragment>
        </InputField>
      </div>
    </div>
    <!-- Portal: dropdown in body so it is above modal and not clipped -->
    {#if showDropdown && dropdownRect}
      <div
        use:appendToBody
        class="add-device-search-dropdown add-device-search-dropdown-portal"
        role="listbox"
        style="position: fixed; top: {dropdownRect.top}px; left: {dropdownRect.left}px; width: {dropdownRect.width}px; z-index: 9999;"
      >
        {#if tableData.loading}
          <div class="add-device-dropdown-item add-device-dropdown-empty">Loading...</div>
        {:else if tableData.records.length === 0}
          <div class="add-device-dropdown-item add-device-dropdown-empty">No devices found</div>
        {:else}
          {#each tableData.records as device (device.id)}
            <button
              type="button"
              class="add-device-dropdown-item"
              class:is-selected={!canAdd(device)}
              role="option"
              aria-selected={!canAdd(device)}
              disabled={!canAdd(device)}
              on:mousedown|preventDefault={() => canAdd(device) && addToSelected(device)}
            >
              <span class="add-device-dropdown-name">{device.name}</span>
              <span class="add-device-dropdown-mac">{getMacDisplay(device)}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- Selected (N items): name + MAC + X (design) -->
    <div class="add-device-selected">
      <h4 class="add-device-selected-title"
        >Selected ({selectedDevices.length} {selectedDevices.length === 1 ? 'item' : 'items'})</h4
      >
      <div class="add-device-selected-list">
        {#if selectedDevices.length === 0}
          <p class="add-device-selected-empty">No devices selected</p>
        {:else}
          {#each selectedDevices as device (device.id)}
            <div class="add-device-selected-item">
              <div class="add-device-selected-item-text">
                <span class="add-device-selected-name">{device.name}</span>
                <span class="add-device-selected-mac">{getMacDisplay(device)}</span>
              </div>
              <Button
                variant="text"
                color="gray"
                size="sm"
                icon={X}
                iconPosition="only"
                iconSize={18}
                aria-label="Remove {device.name}"
                on:click={() => removeFromSelected(device)}
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</Modal>

<style>
  .add-device-modal-body {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-6);
    padding: var(--ds-space-4);
    font-family: var(--ds-font-family-primary);
    width: 100%;
    min-width: 0;
  }
  .add-device-search-wrap {
    width: 100%;
    min-width: 0;
  }
  /* Same pattern as assign-deployment (devices page): container overflow visible so dropdown is not clipped */
  .add-device-input-container {
    position: relative;
    overflow: visible;
    z-index: 10;
  }
  .add-device-search :global(.input-wrapper) {
    width: 100%;
  }
  .add-device-search-dropdown {
    max-height: 240px;
    overflow-y: auto;
    background: var(--ds-bg-primary);
    border: 1px solid var(--ds-border-default);
    border-radius: var(--ds-radius-lg);
    box-shadow: var(--ds-shadow-lg);
  }
  /* Portal: position/z-index set inline so dropdown is above modal and not clipped by modal transform+overflow */
  .add-device-search-dropdown-portal {
    margin-top: 0;
  }
  .add-device-dropdown-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ds-space-1);
    width: 100%;
    padding: var(--ds-space-3);
    border: none;
    background: var(--ds-color-white);
    font-family: var(--ds-font-family-primary);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    border-bottom: 1px solid var(--ds-color-gray-100);
  }
  .add-device-dropdown-item:last-child {
    border-bottom: none;
  }
  .add-device-dropdown-item:hover:not(:disabled) {
    background: var(--ds-color-gray-50);
  }
  .add-device-dropdown-item.is-selected,
  .add-device-dropdown-item:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    background: var(--ds-color-gray-50);
  }
  .add-device-dropdown-item.is-selected .add-device-dropdown-name,
  .add-device-dropdown-item:disabled .add-device-dropdown-name {
    color: var(--ds-text-tertiary);
  }
  .add-device-dropdown-item.is-selected .add-device-dropdown-mac,
  .add-device-dropdown-item:disabled .add-device-dropdown-mac {
    color: var(--ds-text-quaternary);
  }
  .add-device-dropdown-name {
    font-weight: var(--ds-font-medium);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-text-primary);
  }
  .add-device-dropdown-mac {
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-xs);
    line-height: var(--ds-leading-xs);
    letter-spacing: 0.01em;
    color: var(--ds-text-secondary);
  }
  .add-device-dropdown-empty {
    padding: var(--ds-space-4);
    text-align: center;
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-text-tertiary);
    cursor: default;
  }
  .add-device-selected {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-2);
    width: 100%;
    min-width: 0;
  }
  .add-device-selected-title {
    font-weight: var(--ds-font-medium);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-text-primary);
    margin: 0;
  }
  .add-device-selected-list {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-2);
    max-height: 200px;
    overflow-y: auto;
  }
  .add-device-selected-empty {
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-text-secondary);
    margin: 0;
  }
  .add-device-selected-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-2);
    padding: var(--ds-space-3);
    background: var(--ds-color-gray-50);
    border: 1px solid var(--ds-color-gray-200);
    border-radius: var(--ds-radius-lg);
  }
  .add-device-selected-item-text {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-1);
    min-width: 0;
  }
  .add-device-selected-name {
    font-weight: var(--ds-font-medium);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-text-primary);
  }
  .add-device-selected-mac {
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-xs);
    line-height: var(--ds-leading-xs);
    letter-spacing: 0.01em;
    color: var(--ds-text-secondary);
  }
</style>
