<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { writable } from 'svelte/store';

  // ===== Props =====
  export let deviceId: string;
  export let accountId: string | undefined;
  export let actionLogs: any[] = []; // not rendered here (only in detail page)
  export let isLoading: any = writable(false);
  // IMPORTANT: include packageName so we can clear the right row
  export let actionStatus: any = writable({ action: '', status: '', message: '', packageName: '' });

  // Use this component for both pinned/all by changing the endpoint & initialQuery
  export let endpoint: string | undefined;
  export let initialQuery: Partial<Record<'search' | 'filter' | 'sortBy' | 'sortOrder', string>> = {};
  
  // Accept SSE store from parent to avoid creating multiple connections
  export let sseStore: any = null;

  // ===== Types =====
  interface DeviceApp {
    device_id: string;
    account_id: string;
    app_name: string;
    package_name: string;
    version: string;
    app_type: 'System' | 'Normal' | 'User' | string;
    last_modified: string;
    install_date: string;
    size_bytes: number;
    is_pinned?: boolean;
    is_system_app: boolean;
    is_pinned_rule?: boolean;
    permissions: string[];
    metadata: Record<string, string>;
    pinInfo?: {
      isPinned?: boolean;
      pinnedBy?: string;
      ruleType?: string;
      pinnedAt?: string;
      ruleId?: string;
      createdBy?: string;
      createdByUser?: { name?: string; email?: string };
    } | null;
  }

  interface AppSummary {
    deviceId: string;
    totalAppsCount: number;
    systemAppsCount: number;
    normalAppsCount: number;
    lastAppSync: string | null;
    lastProcessedAt: string;
    device: {
      id: string;
      name: string;
      status: string;
      lastUsedAt: string | null;
      connected: boolean;
      connectedAt: string | null;
    };
  }

  // ===== Local state =====
  let apps: DeviceApp[] = [];
  let summary: AppSummary | null = null;
  let loading = true;
  let error: string | null = null;
  let lastSync: Date | null = null;

  // UI state (defaults from initialQuery)
  let searchTerm = initialQuery.search ?? '';
  let filterType = initialQuery.filter ?? 'all';
  let sortBy = initialQuery.sortBy ?? 'name';
  let sortOrder: 'asc' | 'desc' = (initialQuery.sortOrder as 'asc' | 'desc') ?? 'asc';

  // Per-row loading: key = `${packageName}-${action}` where action ∈ {'uninstall','restart','config'}
  // Using writable store to ensure reactivity
  const actionLoadingStore = writable<Record<string, string>>({});
  $: actionLoading = $actionLoadingStore;

  // Confirmation modal state
  let showUninstallConfirm = false;
  let confirmUninstallApp: { name: string; packageName: string } | null = null;

  // Pagination
  let currentPage = 1;
  let pageSize = 10;
  let totalApps = 0;
  let totalPages = 0;

  // SSE - now using parent's SSE store instead of creating own connection
  let sseUnsubscribe: (() => void) | null = null;

  // Derived
  $: sortedApps = apps;

  // Reload when UI filters change
  let isInitialized = false;
  $: if (isInitialized && (searchTerm !== undefined || filterType !== undefined || sortBy !== undefined || sortOrder !== undefined)) {
    currentPage = 1;
    loadData();
  }

  // Update from initialQuery after first load
  $: if (isInitialized) {
    searchTerm = initialQuery.search ?? searchTerm;
    filterType = initialQuery.filter ?? filterType;
    sortBy = initialQuery.sortBy ?? sortBy;
    sortOrder = (initialQuery.sortOrder as 'asc' | 'desc') ?? sortOrder;
  }


  onMount(async () => {
    if (!deviceId) {
      error = 'Device ID is not available';
      loading = false;
      return;
    }

    await loadData();
    isInitialized = true;
    setupSSE();
  });

  onDestroy(() => {
    // Unsubscribe from SSE messages
    if (sseUnsubscribe) {
      sseUnsubscribe();
      sseUnsubscribe = null;
    }
  });

  // ===== Data loading =====
  async function loadData() {
    try {
      loading = true;
      error = null;

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (searchTerm) params.set('search', searchTerm);
      if (filterType) params.set('filter', filterType);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      if (initialQuery) {
        Object.entries(initialQuery).forEach(([k, v]) => {
          if (v != null && v !== '' && !params.has(k)) params.set(k, String(v));
        });
      }

      const base = endpoint ?? `/api/devices/${deviceId}/apps`;
      const res = await fetch(`${base}?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load apps: ${res.statusText}`);

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to load apps');

      apps = data.data.apps;
      totalApps = data.data.pagination.total;
      totalPages = data.data.pagination.totalPages;
      lastSync = new Date(data.data.timestamp);
      calculateSummary();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      toast.error('Failed to load device apps', { description: error });
    } finally {
      loading = false;
    }
  }

  function calculateSummary() {
    if (!apps?.length) {
      summary = null;
      return;
    }
    const systemApps = apps.filter(a => (a.app_type || '').toLowerCase() === 'system');
    const normalApps = apps.filter(a => ['user', 'normal'].includes((a.app_type || '').toLowerCase()));
    summary = {
      deviceId,
      totalAppsCount: apps.length,
      systemAppsCount: systemApps.length,
      normalAppsCount: normalApps.length,
      lastAppSync: lastSync?.toISOString() || null,
      lastProcessedAt: lastSync?.toISOString() || new Date().toISOString(),
      device: {
        id: deviceId,
        name: 'Device',
        status: 'ACTIVE',
        connected: true,
        connectedAt: lastSync?.toISOString() || null,
        lastUsedAt: lastSync?.toISOString() || null
      }
    };
  }

  // ===== SSE handling =====
  function setupSSE() {
    if (!browser || !sseStore) {
      console.warn('[DeviceAppList] No SSE store provided, real-time updates disabled');
      return;
    }

    // Subscribe to SSE messages using parent's SSE store (no new connection created!)
    console.log('[DeviceAppList:SSE] Subscribing to messages for device:', deviceId);
    sseUnsubscribe = sseStore.on('*', (msg: any) => {
      try {
        const data = msg?.data || msg;
        handleSSEMessage(data);
      } catch (err) {
        console.error('[DeviceAppList:SSE] Failed to handle message:', err);
      }
    });
  }

  function handleSSEMessage(data: any) {
    if (data?.type === 'ping') return;

    if (data?.type === 'device:statusUpdate' || data?.type === 'device:progressUpdate') {
      handleAppActionUpdate(data);
    }

    // Handle data updates pushed via SSE
    if (data?.type === 'device:dataUpdate') {
      handleDataUpdate(data);
    }
  }

  // Apply fresh data from SSE push
  function handleDataUpdate(data: any) {
    const payload = data?.payload || {};
    const updatedData = payload.updatedData;
    
    if (!updatedData) return;
    
    console.log('[DeviceAppList:SSE] Received fresh data via SSE push');
    
    // Check if this component uses a special endpoint (like apps-with-pins)
    const usesSpecialEndpoint = endpoint && endpoint.includes('apps-with-pins');
    
    if (usesSpecialEndpoint) {
      // For special endpoints (e.g., apps-with-pins), reload from the correct endpoint
      // because SSE data doesn't include pin information
      console.log('[DeviceAppList:SSE] Using special endpoint, reloading from API');
      loadData();
      return;
    }
    
    // Update apps directly from SSE data (for basic apps endpoint)
    if (updatedData.apps && Array.isArray(updatedData.apps)) {
      apps = updatedData.apps;
      
      // Update pagination
      if (updatedData.appsPagination) {
        totalApps = updatedData.appsPagination.total;
        totalPages = updatedData.appsPagination.totalPages;
        currentPage = updatedData.appsPagination.page;
      }
      
      // Update timestamp
      lastSync = new Date(updatedData.timestamp);
      
      // Recalculate summary
      calculateSummary();
      
      console.log(`[DeviceAppList:SSE] Updated ${apps.length} apps from SSE (total: ${totalApps})`);
      
      // If there's more data than what was pushed, optionally reload full list
      if (updatedData.shouldReloadFullList && currentPage > 1) {
        console.log('[DeviceAppList:SSE] Large app list detected, reloading current page');
        loadData(); // Reload to respect current page/filters
      }
    }
  }

  function handleAppUpdate(data: any) {
    if (data?.type === 'apps_updated' || data?.type === 'apps_processed') {
      loadData();
      toast.success('Apps updated', { description: `${data.appCount || 0} apps synchronized` });
    } else if (data?.type === 'apps_error') {
      toast.error('App sync failed', { description: data.error || 'Unknown error occurred' });
    }
  }

  // Example payload you gave:
  // {
  //   "type": "device:statusUpdate",
  //   "payload": {
  //     "action": "restartApp",
  //     "status": "complete",
  //     "message": "App com.microsoft.teams2 restarted successfully"
  //   }
  // }
  function handleAppActionUpdate(data: any) {
    console.log(`[DeviceAppList:SSE] update received:`, JSON.stringify(data));
    const payload = data?.payload || {};
    const action = payload.action as string;          // e.g. 'restartApp' | 'uninstall' | 'config'
    const status = payload.status as string;          // 'complete' | 'failed' | ...
    const message = payload.message as string | undefined;

    console.log(`[DeviceAppList:SSE] action: ${action}, status: ${status}`);
    if (!action) return;

    const displayAction = action === 'restartApp' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);

    // The parent component is no longer responsible for the final toast.
    // We update the actionStatus for external listeners, but also show the toast here.
    actionStatus.set({
      action: action,
      status: status, // 'complete' or 'failed'
      message: message || `${displayAction} operation ${status}`,
      packageName: extractPackageFromMessage(message) || ''
    });

    // Show toast only when the action completes/fails, and only if we were tracking it.
    const pkg = extractPackageFromMessage(message);
    if (pkg) {
      const key = `${pkg}-${normalizeActionKey(action)}`;
      if (actionLoading[key]) {
        if (status === 'complete') {
          toast.success(`${displayAction} completed`, { description: message || `${displayAction} operation completed successfully` });
        } else if (status === 'failed') {
          toast.error(`${displayAction} failed`, { description: message || `${displayAction} operation failed` });
        }
      }
    }

    // For final states, clear the loading spinner for the specific action row.
    const finalPkg = extractPackageFromMessage(message);
    if (finalPkg) {
      const normalized = normalizeActionKey(action);
      const key = `${finalPkg}-${normalized}`;
      if (actionLoading[key]) {
        actionLoadingStore.update(state => {
          const newState = { ...state };
          delete newState[key];
          return newState;
        });
        console.log(`[DeviceAppList:SSE] cleared ${key} from actionLoading`);
      }
    }
  }

  // ===== UI helpers =====
  async function syncDevice() {
    try {
      const res = await fetch(`/api/devices/${deviceId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Sync failed');

      toast.success('Sync initiated', { description: 'Device app data is being synchronized' });
    } catch (err) {
      toast.error('Sync failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function getAppTypeColor(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'system': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'user':   return 'bg-green-100 text-green-800';
      default:       return 'bg-gray-100 text-gray-800';
    }
  }

  function normalizeActionKey(action: string): 'restart' | 'uninstall' | 'config' | null {
    if (action === 'restartApp' || action === 'restart') return 'restart';
    if (action === 'uninstall') return 'uninstall';
    if (action === 'config') return 'config';
    // For other actions like 'progressUpdate', we don't want to map to a key.
    return null;
  }

  // Extract package name from strings like:
  // "App com.microsoft.teams2 restarted successfully"
  function extractPackageFromMessage(msg?: string): string | null {
    if (!msg) return null;
    // Look for typical package patterns (com.example.app, io.company.product, etc.)
    const match = msg.match(/\b([a-zA-Z][\w.]+(?:\.[a-zA-Z0-9_]+)+)\b/);
    return match ? match[1] : null;
  }

  // ===== Actions =====
  function handleUninstallClick(appName: string, packageName: string) {
    confirmUninstallApp = { name: appName, packageName };
    showUninstallConfirm = true;
  }

  function confirmUninstall() {
    if (confirmUninstallApp) {
      sendDeviceAction('uninstall', confirmUninstallApp.packageName);
      showUninstallConfirm = false;
      confirmUninstallApp = null;
    }
  }

  function cancelUninstall() {
    showUninstallConfirm = false;
    confirmUninstallApp = null;
  }

  function handleModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancelUninstall();
    }
  }

  async function sendDeviceAction(action: 'uninstall' | 'restart' | 'config', packageName: string) {
    const actionKey = `${packageName}-${action}`;
    
    try {
      // Set row loading state
      actionLoadingStore.update(state => ({ ...state, [actionKey]: action }));

      // Global flag for parent-level UX
      isLoading.set(true);

      actionStatus.set({
        action: action === 'restart' ? 'restartApp' : action,
        status: 'loading',
        message: `Sending ${action} command for ${packageName}...`,
        packageName
      });

      const res = await fetch(`/api/devices/${deviceId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'restart' ? 'restartApp' : action,
          packageName
        })
      });

      if (!res.ok) {
        let msg = `Failed to send action: ${res.statusText}`;
        try {
          const j = await res.json();
          msg = j?.error?.message || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      // Success - show toast and clear loading immediately
      const pretty = action === 'restart' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
      actionStatus.set({ action: action === 'restart' ? 'restartApp' : action, status: 'success', message: `${pretty} command sent`, packageName });
      toast.success(`${pretty} command sent`, { description: `Action sent to device for ${packageName}` });

      // The loading state will be cleared by the SSE handler when a 'complete' or 'failed' message is received.

    } catch (err) {
      const pretty = action === 'restart' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
      const msg = err instanceof Error ? err.message : 'Failed to send action';
      actionStatus.set({ action: action === 'restart' ? 'restartApp' : action, status: 'error', message: msg, packageName });
      toast.error(`Failed to ${pretty.toLowerCase()} app`, { description: msg });

      // Clear row on error
      actionLoadingStore.update(state => {
        const newState = { ...state };
        delete newState[actionKey];
        return newState;
      });
    } finally {
      isLoading.set(false);
    }
  }

</script>

<div class="space-y-3">
  <!-- Summary (only for the 'all' list) -->
  {#if summary && (initialQuery?.filter ?? filterType) === 'all'}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-blue-900">App Summary</h3>
          <p class="text-xs text-blue-700">
            {summary.totalAppsCount} total apps • 
            {summary.systemAppsCount} system • 
            {summary.normalAppsCount} normal
            {#if summary.lastAppSync}
              • Last sync: {formatDate(summary.lastAppSync)}
            {/if}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="flex flex-col sm:flex-row gap-2">
    <div class="flex-1">
      <input
        type="text"
        placeholder="Search apps..."
        bind:value={searchTerm}
        class="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div class="flex gap-1.5">
      <!-- If you want client-side filter switching, uncomment this block
      <select
        bind:value={filterType}
        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">All Types</option>
        <option value="system">System</option>
        <option value="normal">Normal</option>
        <option value="user">User</option>
        <option value="pinned">Pinned</option>
      </select>
      -->
      <select
        bind:value={sortBy}
        class="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="name">Name</option>
        <option value="package">Package</option>
        <option value="version">Version</option>
        <option value="size">Size</option>
        <option value="modified">Modified</option>
      </select>
      <button
        on:click={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
        class="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  </div>

  <!-- States -->
  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-sm text-gray-600">Loading apps...</span>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-3">
      <p class="text-sm text-red-800">{error}</p>
      <button
        on:click={loadData}
        class="mt-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  {:else if !sortedApps.length}
    <div class="text-center py-8">
      <p class="text-sm text-gray-500">No apps found</p>
    </div>
  {:else}
    <!-- App table -->
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each sortedApps as app (app.package_name)}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-2.5 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-8 w-8">
                      <div class="h-8 w-8 rounded-lg bg-gray-200 flex items-center justify-center">
                        <span class="text-xs font-medium text-gray-600">
                          {app.app_name?.charAt(0)?.toUpperCase() || 'A'}
                        </span>
                      </div>
                    </div>
                    <div class="ml-3">
                      <div class="flex items-center gap-1.5">
                        <div class="text-xs font-medium text-gray-900">{app.app_name}</div>
                        {#if app.is_pinned || app.pinInfo?.isPinned}
                          <span class="text-yellow-500" title={app.pinInfo?.pinnedBy ? `Pinned by ${app.pinInfo.pinnedBy}` : 'Pinned'}>★</span>
                        {/if}
                      </div>
                      <div class="text-xs text-gray-500">{app.package_name}</div>
                    </div>
                  </div>
                </td>

                <td class="px-4 py-2.5 whitespace-nowrap">
                  <span class="inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full {getAppTypeColor(app.app_type)}">
                    {app.app_type}
                  </span>
                </td>

                <td class="px-4 py-2.5 whitespace-nowrap text-xs text-gray-900">
                  {app.version}
                </td>

                <td class="px-4 py-2.5 whitespace-nowrap text-xs text-gray-900">
                  {formatBytes(app.size_bytes)}
                </td>

                <td class="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">
                  {formatDate(app.last_modified)}
                </td>

                <td class="px-4 py-2.5 whitespace-nowrap text-xs font-medium">
                  <div class="flex items-center space-x-1.5">
                    {#if app.is_pinned || app.pinInfo?.isPinned}
                      <span class="text-yellow-600" title="Pinned">📌</span>
                    {/if}
                    {#if app.is_system_app}
                      <span class="text-red-600" title="System App">⚙️</span>
                    {/if}

                    <div class="flex items-center space-x-3 ml-2">
                      <!-- Uninstall -->
                      <button
                        on:click={() => handleUninstallClick(app.app_name, app.package_name)}
                        disabled={actionLoading[`${app.package_name}-uninstall`] === 'uninstall' || app.is_system_app}
                        class="px-2.5 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                        title={app.is_system_app ? 'Cannot uninstall system app' : 'Uninstall app'}
                      >
                        {#if actionLoading[`${app.package_name}-uninstall`] === 'uninstall'}
                          <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-700"></div>
                        {:else}
                          <span class="text-base">🗑️</span>
                        {/if}
                      </button>

                      <!-- Restart -->
                      <button
                        on:click={() => sendDeviceAction('restart', app.package_name)}
                        disabled={actionLoading[`${app.package_name}-restart`] === 'restart'}
                        class="px-2.5 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                        title="Restart App"
                      >
                        {#if actionLoading[`${app.package_name}-restart`] === 'restart'}
                          <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-700"></div>
                        {:else}
                          <span class="text-base">🔄</span>
                        {/if}
                      </button>

                      <!-- Config -->
                      <button
                        on:click={() => sendDeviceAction('config', app.package_name)}
                        disabled={actionLoading[`${app.package_name}-config`] === 'config'}
                        class="px-2.5 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                        title="Configure app"
                      >
                        {#if actionLoading[`${app.package_name}-config`] === 'config'}
                          <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-green-700"></div>
                        {:else}
                          <span class="text-base">⚙️</span>
                        {/if}
                      </button>
                    </div>
                  </div>
                </td>

              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-1.5">
          <label for="pageSize" class="text-xs text-gray-700">Show:</label>
          <select
            id="pageSize"
            bind:value={pageSize}
            on:change={() => {
              pageSize = parseInt(String(pageSize));
              currentPage = 1;
              loadData();
            }}
            class="px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span class="text-xs text-gray-700">per page</span>
        </div>

        <div class="text-xs text-gray-700">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalApps)} of {totalApps} apps
        </div>
      </div>

      <div class="flex items-center space-x-1.5">
        <button on:click={() => { currentPage = 1; loadData(); }} disabled={currentPage === 1} class="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">First</button>
        <button on:click={() => { currentPage = Math.max(1, currentPage - 1); loadData(); }} disabled={currentPage === 1} class="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
        <span class="px-2.5 py-1 text-xs text-gray-700">Page {currentPage} of {totalPages}</span>
        <button on:click={() => { currentPage = Math.min(totalPages, currentPage + 1); loadData(); }} disabled={currentPage === totalPages} class="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        <button on:click={() => { currentPage = totalPages; loadData(); }} disabled={currentPage === totalPages} class="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Last</button>
      </div>
    </div>

    {#if lastSync}
      <div class="text-xs text-gray-500 text-center">
        Last updated: {formatDate(lastSync.toISOString())}
      </div>
    {/if}
  {/if}
</div>

<!-- Uninstall Confirmation Modal -->
{#if showUninstallConfirm && confirmUninstallApp}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
    on:click={cancelUninstall}
    on:keydown={handleModalKeydown}
    role="presentation"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" 
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 id="modal-title" class="text-lg font-medium text-gray-900 mb-2">Confirm Uninstall</h3>
          <p class="text-sm text-gray-600 mb-4">
            Are you sure you want to uninstall <strong>{confirmUninstallApp.name}</strong>?
          </p>
          <p class="text-xs text-gray-500 mb-4">
            Package: {confirmUninstallApp.packageName}
          </p>
          <p class="text-xs text-red-600 mb-6">
            This action cannot be undone. The app will be permanently removed from the device.
          </p>
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              on:click={cancelUninstall}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              on:click={confirmUninstall}
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Uninstall
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
