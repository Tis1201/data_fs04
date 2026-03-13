<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { writable } from 'svelte/store';
  import { useDeviceAppMqtt } from '$lib/composables/useDeviceAppMqtt';
  import { restartApp, uninstallApp, configApp } from '$lib/client/mqtt/deviceActions';
  import { isRefreshAction } from '$lib/constants/device';

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
    /** False when app is in pin rule but not yet installed on device (placeholder) */
    isInstalled?: boolean;
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

  // MQTT - real-time updates via composable (useDeviceAppMqtt)

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
    setupAppMqtt();
  });

  onDestroy(() => {
    // Cleanup MQTT subscriptions via composable
    cleanupAppMqtt();
  });

  // ===== Data loading =====
  async function loadData() {
    try {
      loading = true;
      error = null;

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize), // v2 expects pageSize
        limit: String(pageSize) // keep legacy compatibility
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

      const base = endpoint ?? `/api/v2/devices/${deviceId}/apps`;
      const res = await fetch(`${base}?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load apps: ${res.statusText}`);

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to load apps');

      const payload = data.data ?? data;
      const appsPayload = payload.apps ?? payload.items ?? [];
      const paginationPayload = payload.pagination ?? {
        total: payload.total,
        totalPages: payload.totalPages,
        page: payload.page,
        pageSize: payload.pageSize ?? payload.limit
      };

      apps = appsPayload;
      totalApps = paginationPayload?.total ?? appsPayload.length ?? 0;
      totalPages = paginationPayload?.totalPages ?? 1;
      lastSync = new Date(payload.timestamp ?? data.meta?.timestamp ?? Date.now());
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

  // ===== MQTT handling =====
  // Use composable for MQTT handlers (extracted to useDeviceAppMqtt.ts)
  const { setup: setupAppMqtt, cleanup: cleanupAppMqtt } = useDeviceAppMqtt({
    deviceId,
    onAppActionUpdate: handleAppActionUpdate
  });

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
    console.log(`[DeviceAppList:MQTT] update received:`, JSON.stringify(data));
    const payload = data?.payload || {};
    const action = payload.action as string;          // e.g. 'restart_app' | 'uninstall_app' | 'config_app'
    const status = payload.status as string;          // 'complete' | 'failed' | ...
    const message = payload.message as string | undefined;

    console.log(`[DeviceAppList:MQTT] action: ${action}, status: ${status}`);
    if (!action) return;

    const displayAction = formatActionName(action);

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
      const key = `${pkg}-${action}`; // Use snake_case action directly
      if (actionLoading[key]) {
        if (status === 'complete' || status === 'success') {
          toast.success(`${displayAction} completed`, { description: message || `${displayAction} operation completed successfully` });
        } else if (status === 'failed' || status === 'fail') {
          toast.error(`${displayAction} failed`, { description: message || `${displayAction} operation failed` });
        }
      }
    }

    // For final states, clear the loading spinner for the specific action row.
    const finalPkg = extractPackageFromMessage(message);
    if (finalPkg && (action === 'restart_app' || action === 'uninstall_app' || action === 'config_app')) {
      const key = `${finalPkg}-${action}`; // Use snake_case action directly
      if (actionLoading[key]) {
        actionLoadingStore.update(state => {
          const newState = { ...state };
          delete newState[key];
          return newState;
        });
        console.log(`[DeviceAppList:MQTT] cleared ${key} from actionLoading`);
      }
    }

    // Clear global loading state on final status (success or failed)
    if (status === 'success' || status === 'complete' || status === 'failed' || status === 'fail') {
      isLoading.set(false);
      console.log(`[DeviceAppList:MQTT] cleared global loading state for ${action} with status ${status}`);
    }

    // Reload apps list when an action that affects apps/device info succeeds (per AUTO_REFRESH_PLAN)
    const isSuccess = status === 'success' || status === 'complete';
    if (isSuccess && isRefreshAction(action)) {
      loadData();
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

  function formatDate(dateString: string | null | undefined): string {
    if (dateString == null) return '-';
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

  // Helper to format action names for display
  function formatActionName(action: string): string {
    if (action === 'restart_app') return 'Restart App';
    if (action === 'uninstall_app') return 'Uninstall App';
    if (action === 'config_app') return 'Config App';
    // Convert snake_case to Title Case
    return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
      sendDeviceAction('uninstall_app', confirmUninstallApp.packageName);
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

  async function sendDeviceAction(action: 'uninstall_app' | 'restart_app' | 'config_app', packageName: string) {
    const actionKey = `${packageName}-${action}`;
    
    try {
      // Set row loading state
      actionLoadingStore.update(state => ({ ...state, [actionKey]: action }));

      // Global flag for parent-level UX
      isLoading.set(true);

      actionStatus.set({
        action: action, // Use snake_case directly
        status: 'loading',
        message: `Sending ${action} command for ${packageName}...`,
        packageName
      });

      // Use MQTT RPC instead of REST API
      const actionMap = {
        restart_app: restartApp,
        uninstall_app: uninstallApp,
        config_app: configApp
      };

      const result = await actionMap[action]({ deviceId, packageName });

      // Success - show toast and keep loading (will be cleared by MQTT status update)
      const pretty = formatActionName(action);
      toast.success(`${pretty} command sent to device`);

      // Store operationId for tracking
      actionStatus.set({ 
        action: action, 
        status: 'initiated', 
        message: result.message || `${pretty} initiated`, 
        packageName,
        operationId: result.operationId 
      });

      // The loading state will be cleared by the MQTT handler when a 'success' or 'failed' message is received.

    } catch (err) {
      const pretty = formatActionName(action);
      const errMsg = err instanceof Error ? err.message : String(err);
      
      actionStatus.set({ 
        action: action === 'restart_app' ? 'restartApp' : action, 
        status: 'error', 
        message: errMsg, 
        packageName 
      });
      
      toast.error(`Failed to ${action} ${packageName}`, { description: errMsg });
      console.error(`Error sending ${action} action:`, err);
      
      // Clear row loading state on error
      actionLoadingStore.update(state => {
        const newState = { ...state };
        delete newState[actionKey];
        return newState;
      });
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
            {summary.totalAppsCount} total apps
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
                      {#if app.isInstalled === false}
                        <span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded" title="Pinned but not yet installed – use Install New App to install">
                          Not installed
                        </span>
                      {:else}
                        <!-- Uninstall -->
                        <button
                          on:click={() => handleUninstallClick(app.app_name, app.package_name)}
                          disabled={!!(actionLoading[`${app.package_name}-uninstall_app`] || app.is_system_app)}
                          class="px-2.5 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                          title={app.is_system_app ? 'Cannot uninstall system app' : 'Uninstall app'}
                        >
                          {#if actionLoading[`${app.package_name}-uninstall_app`]}
                            <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-700"></div>
                          {:else}
                            <span class="text-base">🗑️</span>
                          {/if}
                        </button>

                        <!-- Restart -->
                        <button
                          on:click={() => sendDeviceAction('restart_app', app.package_name)}
                          disabled={!!actionLoading[`${app.package_name}-restart_app`]}
                          class="px-2.5 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                          title="Restart App"
                        >
                          {#if actionLoading[`${app.package_name}-restart_app`]}
                            <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-700"></div>
                          {:else}
                            <span class="text-base">🔄</span>
                          {/if}
                        </button>

                        <!-- Config -->
                        <button
                          on:click={() => sendDeviceAction('config_app', app.package_name)}
                          disabled={!!actionLoading[`${app.package_name}-config_app`]}
                          class="px-2.5 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] h-8 flex items-center justify-center"
                          title="Configure app"
                        >
                          {#if actionLoading[`${app.package_name}-config_app`]}
                            <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-green-700"></div>
                          {:else}
                            <span class="text-base">⚙️</span>
                          {/if}
                        </button>
                      {/if}
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
