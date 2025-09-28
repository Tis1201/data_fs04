<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import { writable } from 'svelte/store';
  import { sseStore } from '$lib/stores/sse-store';
  import { subscribeDeviceDetailEvents } from '$lib/client/actionHandlers';
  import ActionHistory from '$lib/components/ui_components_sveltekit/devices/ActionHistory.svelte';

  export let deviceId: string;
  export let actionLogs: any[] = []; // Accept action logs from parent
  export let isLoading: any = writable(false); // Accept loading state from parent
  export let actionStatus: any = writable({ action: "", status: "", message: "" }); // Accept action status from parent

  interface DeviceApp {
    device_id: string;
    account_id: string;
    app_name: string;
    package_name: string;
    version: string;
    app_type: 'System' | 'Normal' | 'User';
    last_modified: string;
    install_date: string;
    size_bytes: number;
    is_pinned: boolean;
    is_system_app: boolean;
    permissions: string[];
    metadata: Record<string, string>;
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

  let apps: DeviceApp[] = [];
  let summary: AppSummary | null = null;
  let loading = true;
  let error: string | null = null;
  let lastSync: Date | null = null;
  let sseConnection: EventSource | null = null;
  let searchTerm = '';
  let filterType = 'all';
  let sortBy = 'name';
  let sortOrder: 'asc' | 'desc' = 'asc';
  let actionLoading: Record<string, string> = {}; // Track which action is loading for which app
  
  // Pagination state
  let currentPage = 1;
  let pageSize = 10;
  let totalApps = 0;
  let totalPages = 0;

  // Computed properties - apps are already filtered and sorted on server
  $: sortedApps = apps;
  
  // Reactive statements to reload data when filters change
  let isInitialized = false;
  
  $: if (isInitialized && (searchTerm !== undefined || filterType !== undefined || sortBy !== undefined || sortOrder !== undefined)) {
    currentPage = 1; // Reset to first page when filters change
    loadData();
  }

  // Handle parent's action status changes for real-time updates
  $: if ($actionStatus && $actionStatus.action) {
    const action = $actionStatus.action;
    const status = $actionStatus.status;
    const message = $actionStatus.message;
    
    // Handle app action status updates from parent
    if (['uninstall', 'restartApp', 'config'].includes(action)) {
      if (status === 'success') {
        const displayAction = action === 'restartApp' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
        toast.success(`${displayAction} completed`, {
          description: message || `${displayAction} operation completed successfully`
        });
        
        // Clear loading state
        const actionKey = Object.keys(actionLoading).find(key => 
          actionLoading[key] === action
        );
        if (actionKey) {
          delete actionLoading[actionKey];
          actionLoading = { ...actionLoading };
        }
        
      } else if (status === 'error') {
        const displayAction = action === 'restartApp' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
        toast.error(`${displayAction} failed`, {
          description: message || `${displayAction} operation failed`
        });
        
        // Clear loading state
        const actionKey = Object.keys(actionLoading).find(key => 
          actionLoading[key] === action
        );
        if (actionKey) {
          delete actionLoading[actionKey];
          actionLoading = { ...actionLoading };
        }
      }
    }
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
    if (sseConnection) {
      sseConnection.close();
    }
  });

  async function loadData() {
    try {
      loading = true;
      error = null;

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString()
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      if (filterType !== 'all') {
        params.append('filter', filterType);
      }
      
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }

      // Load apps data with pagination and filters
      const appsResponse = await fetch(`/api/devices/${deviceId}/apps?${params.toString()}`);

      if (!appsResponse.ok) {
        throw new Error(`Failed to load apps: ${appsResponse.statusText}`);
      }

      const appsData = await appsResponse.json();

      if (appsData.success) {
        apps = appsData.data.apps;
        totalApps = appsData.data.pagination.total;
        totalPages = appsData.data.pagination.totalPages;
        lastSync = new Date(appsData.data.timestamp);
        
        // Calculate summary from apps data
        calculateSummary();
      } else {
        throw new Error(appsData.error || 'Failed to load apps');
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
      toast.error('Failed to load device apps', {
        description: error
      });
    } finally {
      loading = false;
    }
  }

  function calculateSummary() {
    if (!apps || apps.length === 0) {
      summary = null;
      return;
    }

    const systemApps = apps.filter(app => app.app_type?.toLowerCase() === 'system');
    const normalApps = apps.filter(app => app.app_type?.toLowerCase() === 'user' || app.app_type?.toLowerCase() === 'normal');
    const otherApps = apps.filter(app => !['system', 'user', 'normal'].includes(app.app_type?.toLowerCase() || ''));

    summary = {
      deviceId: deviceId,
      totalAppsCount: apps.length,
      systemAppsCount: systemApps.length,
      normalAppsCount: normalApps.length,
      lastAppSync: lastSync?.toISOString() || null,
      lastProcessedAt: lastSync?.toISOString() || new Date().toISOString(),
      device: {
        id: deviceId,
        name: 'Device', // We don't have device name in apps data
        status: 'ACTIVE',
        connected: true,
        connectedAt: lastSync?.toISOString() || null,
        lastUsedAt: lastSync?.toISOString() || null
      }
    };
  }

  function setupSSE() {
    if (!browser) return;

    const sseUrl = `/api/sse?deviceId=${deviceId}`;
    sseConnection = new EventSource(sseUrl);

    sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEMessage(data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    sseConnection.onerror = (event) => {
      console.error('SSE connection error:', event);
      toast.error('Connection lost', {
        description: 'Real-time updates may not work properly'
      });
    };

    sseConnection.addEventListener('device-apps-changed', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleAppUpdate(data);
      } catch (err) {
        console.error('Failed to parse app update:', err);
      }
    });
  }


  function handleSSEMessage(data: any) {
    if (data.type === 'ping') {
      // Handle ping messages
      return;
    }
    
    // Handle app action status updates
    if (data.type === 'device:statusUpdate' || data.type === 'device:progressUpdate') {
      handleAppActionUpdate(data);
    }
  }

  function handleAppUpdate(data: any) {
    if (data.type === 'apps_updated' || data.type === 'apps_processed') {
      // Reload data when apps are updated
      loadData();
      
      toast.success('Apps updated', {
        description: `${data.appCount || 0} apps synchronized`
      });
    } else if (data.type === 'apps_error') {
      toast.error('App sync failed', {
        description: data.error || 'Unknown error occurred'
      });
    }
  }

  function handleAppActionUpdate(data: any) {
    const payload = data.payload || data;
    const action = payload.action;
    const status = payload.status;
    const progress = payload.progress;
    const message = payload.message;
    
    // Handle app action status updates
    if (['uninstall', 'restartApp', 'config'].includes(action)) {
      if (status === 'complete') {
        const displayAction = action === 'restartApp' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
        toast.success(`${displayAction} completed`, {
          description: message || `${displayAction} operation completed successfully`
        });
        
        // Clear loading state
        const actionKey = Object.keys(actionLoading).find(key => 
          actionLoading[key] === action
        );
        if (actionKey) {
          delete actionLoading[actionKey];
          actionLoading = { ...actionLoading };
        }
        
      } else if (status === 'failed') {
        const displayAction = action === 'restartApp' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
        toast.error(`${displayAction} failed`, {
          description: message || `${displayAction} operation failed`
        });
        
        // Clear loading state
        const actionKey = Object.keys(actionLoading).find(key => 
          actionLoading[key] === action
        );
        if (actionKey) {
          delete actionLoading[actionKey];
          actionLoading = { ...actionLoading };
        }
        
      } else if (progress !== undefined) {
        // Show progress updates
        console.log(`${action} progress: ${progress}% - ${message}`);
      }
    }
  }

  async function syncDevice() {
    try {
      const response = await fetch(`/api/devices/${deviceId}/sync`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Sync initiated', {
          description: 'Device app data is being synchronized'
        });
        // Data will be reloaded via SSE
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function getAppTypeColor(type: string): string {
    switch (type.toLowerCase()) {
      case 'system':
        return 'bg-red-100 text-red-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  async function sendDeviceAction(action: string, packageName: string) {
    const actionKey = `${packageName}-${action}`;
    
    try {
      // Set loading state for real-time tracking
      isLoading.set(true);
      actionStatus.set({
        action: action === 'restart' ? 'restartApp' : action,
        status: "loading",
        message: `Sending ${action} command for ${packageName}...`,
      });
      
      actionLoading[actionKey] = action;
      actionLoading = { ...actionLoading }; // Trigger reactivity
      
      // Create temporary log entry for real-time tracking
      const displayAction = action === 'restart' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
      const tempId = addActionLogRow(action === 'restart' ? 'restartApp' : action, `Sending ${displayAction} command for ${packageName}...`, 'in_progress');
      
      // Use the unified action API instead of direct SSE (following architecture)
      const response = await fetch(`/api/devices/${deviceId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'restart' ? 'restartApp' : action,
          packageName: packageName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to send action: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update status to success
      actionStatus.set({
        action: action === 'restart' ? 'restartApp' : action,
        status: "success",
        message: `${displayAction} command sent`,
      });
      
      toast.success(`${displayAction} command sent`, {
        description: `Action sent to device for ${packageName}`
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send action';
      
      // Update status to error
      const displayAction = action === 'restart' ? 'Restart App' : action.charAt(0).toUpperCase() + action.slice(1);
      actionStatus.set({
        action: action === 'restart' ? 'restartApp' : action,
        status: "error",
        message: errorMessage,
      });
      
      toast.error(`Failed to ${displayAction.toLowerCase()} app`, {
        description: errorMessage
      });
    } finally {
      isLoading.set(false);
      delete actionLoading[actionKey];
      actionLoading = { ...actionLoading }; // Trigger reactivity
    }
  }

  function isActionLoading(packageName: string, action: string): boolean {
    return actionLoading[`${packageName}-${action}`] === action;
  }

  function addActionLogRow(actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed' = 'initiated', logId?: string) {
    const id = logId || `temp-${actionType}-${Date.now()}`;
    actionLogs = [
      {
        id,
        deviceId: deviceId,
        actionType,
        status,
        message,
        initiatedAt: new Date().toISOString(),
        completedAt: status === 'success' || status === 'failed' ? new Date().toISOString() : null,
        durationMs: null,
        progress: status === 'in_progress' ? 0 : null,
        user: null
      },
      ...actionLogs
    ].slice(0, 15);
    return id;
  }
</script>

<div class="space-y-6">
  <!-- Summary Info -->
  {#if summary}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-medium text-blue-900">App Summary</h3>
          <p class="text-sm text-blue-700">
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

  <!-- Filters and Search -->
  <div class="flex flex-col sm:flex-row gap-4">
    <div class="flex-1">
      <input
        type="text"
        placeholder="Search apps..."
        bind:value={searchTerm}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div class="flex gap-2">
      <select
        bind:value={filterType}
        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">All Types</option>
        <option value="system">System</option>
        <option value="normal">Normal</option>
        <option value="user">User</option>
      </select>
      <select
        bind:value={sortBy}
        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="name">Name</option>
        <option value="package">Package</option>
        <option value="version">Version</option>
        <option value="size">Size</option>
        <option value="modified">Modified</option>
      </select>
      <button
        on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
        class="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Loading apps...</span>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{error}</p>
      <button
        on:click={loadData}
        class="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  {:else if sortedApps.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-500">No apps found</p>
    </div>
  {:else}
    <!-- Apps List -->
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                App
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modified
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each sortedApps as app (app.package_name)}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                        <span class="text-sm font-medium text-gray-600">
                          {app.app_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">{app.app_name}</div>
                      <div class="text-sm text-gray-500">{app.package_name}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getAppTypeColor(app.app_type)}">
                    {app.app_type}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {app.version}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatBytes(app.size_bytes)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(app.last_modified)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center space-x-2">
                    <!-- Status Icons -->
                    {#if app.is_pinned}
                      <span class="text-yellow-600" title="Pinned">📌</span>
                    {/if}
                    {#if app.is_system_app}
                      <span class="text-red-600" title="System App">⚙️</span>
                    {/if}
                    
                    <!-- Action Buttons -->
                    <div class="flex items-center space-x-4 ml-2">
                      <!-- Uninstall Button -->
                      <button
                        on:click={() => sendDeviceAction('uninstall', app.package_name)}
                        disabled={isActionLoading(app.package_name, 'uninstall') || app.is_system_app || ($isLoading && $actionStatus.action === 'uninstall')}
                        class="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[40px] h-10 flex items-center justify-center"
                        title={app.is_system_app ? 'Cannot uninstall system app' : 'Uninstall app'}
                      >
                        {#if isActionLoading(app.package_name, 'uninstall') || ($isLoading && $actionStatus.action === 'uninstall')}
                          <div class="animate-spin rounded-full h-4 w-4 border-b border-red-700"></div>
                        {:else}
                          <span class="text-lg">🗑️</span>
                        {/if}
                      </button>
                      
                      <!-- Restart Button -->
                      <button
                        on:click={() => sendDeviceAction('restart', app.package_name)}
                        disabled={isActionLoading(app.package_name, 'restart') || ($isLoading && $actionStatus.action === 'restartApp')}
                        class="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[40px] h-10 flex items-center justify-center"
                        title="Restart App"
                      >
                        {#if isActionLoading(app.package_name, 'restart') || ($isLoading && $actionStatus.action === 'restartApp')}
                          <div class="animate-spin rounded-full h-4 w-4 border-b border-blue-700"></div>
                        {:else}
                          <span class="text-lg">🔄</span>
                        {/if}
                      </button>
                      
                      <!-- Config Button -->
                      <button
                        on:click={() => sendDeviceAction('config', app.package_name)}
                        disabled={isActionLoading(app.package_name, 'config') || ($isLoading && $actionStatus.action === 'config')}
                        class="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[40px] h-10 flex items-center justify-center"
                        title="Configure app"
                      >
                        {#if isActionLoading(app.package_name, 'config') || ($isLoading && $actionStatus.action === 'config')}
                          <div class="animate-spin rounded-full h-4 w-4 border-b border-green-700"></div>
                        {:else}
                          <span class="text-lg">⚙️</span>
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

    <!-- Pagination Controls -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <label for="pageSize" class="text-sm text-gray-700">Show:</label>
          <select
            id="pageSize"
            bind:value={pageSize}
            on:change={() => { 
              pageSize = parseInt(pageSize.toString());
              currentPage = 1; 
              loadData(); 
            }}
            class="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span class="text-sm text-gray-700">per page</span>
        </div>
        
        <div class="text-sm text-gray-700">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalApps)} of {totalApps} apps
        </div>
      </div>

      <!-- Page Navigation -->
      <div class="flex items-center space-x-2">
        <button
          on:click={() => { currentPage = 1; loadData(); }}
          disabled={currentPage === 1}
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          First
        </button>
        
        <button
          on:click={() => { currentPage = Math.max(1, currentPage - 1); loadData(); }}
          disabled={currentPage === 1}
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span class="px-3 py-1 text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          on:click={() => { currentPage = Math.min(totalPages, currentPage + 1); loadData(); }}
          disabled={currentPage === totalPages}
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
        
        <button
          on:click={() => { currentPage = totalPages; loadData(); }}
          disabled={currentPage === totalPages}
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Last
        </button>
      </div>
    </div>

    <!-- Last Updated Info -->
    {#if lastSync}
      <div class="text-sm text-gray-500 text-center">
        Last updated: {formatDate(lastSync.toISOString())}
      </div>
    {/if}
  {/if}

  <!-- Action History Section -->
  {#if actionLogs && actionLogs.length > 0}
    <div class="mt-8">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Actions</h3>
      <div class="bg-white shadow rounded-lg overflow-hidden">
        <ActionHistory {actionLogs} />
      </div>
    </div>
  {/if}
</div>
