<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';

  export let deviceId: string;
  export let accountId: string;

  interface AppSummary {
    deviceId: string;
    accountId: string;
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

  let summary: AppSummary | null = null;
  let loading = true;
  let error: string | null = null;
  let sseConnection: EventSource | null = null;

  onMount(async () => {
    await loadSummary();
    setupSSE();
  });

  onDestroy(() => {
    if (sseConnection) {
      sseConnection.close();
    }
  });

  async function loadSummary() {
    try {
      loading = true;
      error = null;

      const response = await fetch(`/api/devices/${deviceId}/apps`);
      const data = await response.json();

      if (data.success) {
        // Calculate summary from apps data
        const apps = data.data.apps;
        const systemApps = apps.filter((app: any) => app.app_type?.toLowerCase() === 'system');
        const normalApps = apps.filter((app: any) => app.app_type?.toLowerCase() === 'user' || app.app_type?.toLowerCase() === 'normal');
        
        summary = {
          deviceId: deviceId,
          accountId: '', // We don't have accountId in apps data
          totalAppsCount: apps.length,
          systemAppsCount: systemApps.length,
          normalAppsCount: normalApps.length,
          lastAppSync: data.data.timestamp,
          lastProcessedAt: data.data.timestamp,
          device: {
            id: deviceId,
            name: 'Device', // We don't have device name in apps data
            status: 'ACTIVE',
            connected: true,
            connectedAt: data.data.timestamp,
            lastUsedAt: data.data.timestamp
          }
        };
      } else {
        throw new Error(data.error || 'Failed to load apps');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load summary';
      toast.error('Failed to load device summary', {
        description: error
      });
    } finally {
      loading = false;
    }
  }

  function setupSSE() {
    if (!browser) return;

    const sseUrl = `/api/sse?deviceId=${deviceId}`;
    sseConnection = new EventSource(sseUrl);

    sseConnection.addEventListener('device-apps-changed', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleAppUpdate(data);
      } catch (err) {
        console.error('Failed to parse app update:', err);
      }
    });

    sseConnection.onerror = (event) => {
      console.error('SSE connection error:', event);
    };
  }

  function handleAppUpdate(data: any) {
    if (data.type === 'apps_updated' || data.type === 'apps_processed') {
      // Reload summary when apps are updated
      loadSummary();
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  function getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  }

  function getConnectionStatus(): { text: string; color: string } {
    if (!summary) return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    
    if (summary.device.connected) {
      return { text: 'Connected', color: 'bg-green-100 text-green-800' };
    } else {
      return { text: 'Disconnected', color: 'bg-red-100 text-red-800' };
    }
  }

  function getSyncStatus(): { text: string; color: string } {
    if (!summary || !summary.lastAppSync) {
      return { text: 'Never synced', color: 'bg-gray-100 text-gray-800' };
    }

    const lastSync = new Date(summary.lastAppSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));

    if (diffMinutes < 5) {
      return { text: 'Just now', color: 'bg-green-100 text-green-800' };
    } else if (diffMinutes < 60) {
      return { text: `${diffMinutes}m ago`, color: 'bg-yellow-100 text-yellow-800' };
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return { text: `${hours}h ago`, color: 'bg-orange-100 text-orange-800' };
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return { text: `${days}d ago`, color: 'bg-red-100 text-red-800' };
    }
  }
</script>

<div class="space-y-6">
  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Loading summary...</span>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{error}</p>
    </div>
  {:else if summary}
    <!-- Device Info Card -->
    <div class="bg-white shadow rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-medium text-gray-900">{summary.device.name}</h3>
          <p class="text-sm text-gray-500">Device ID: {summary.device.id}</p>
        </div>
        <div class="flex items-center space-x-3">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(summary.device.status)}">
            {summary.device.status}
          </span>
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getConnectionStatus().color}">
            {getConnectionStatus().text}
          </span>
        </div>
      </div>
    </div>

    <!-- App Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Apps -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span class="text-blue-600 font-semibold">📱</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Total Apps</p>
            <p class="text-2xl font-semibold text-gray-900">{summary.totalAppsCount}</p>
          </div>
        </div>
      </div>

      <!-- System Apps -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <span class="text-red-600 font-semibold">⚙️</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">System Apps</p>
            <p class="text-2xl font-semibold text-gray-900">{summary.systemAppsCount}</p>
          </div>
        </div>
      </div>

      <!-- Normal Apps -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <span class="text-green-600 font-semibold">📦</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Normal Apps</p>
            <p class="text-2xl font-semibold text-gray-900">{summary.normalAppsCount}</p>
          </div>
        </div>
      </div>

      <!-- User Apps -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span class="text-purple-600 font-semibold">👤</span>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">User Apps</p>
            <p class="text-2xl font-semibold text-gray-900">
              {summary.totalAppsCount - summary.systemAppsCount - summary.normalAppsCount}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Status Card -->
    <div class="bg-white shadow rounded-lg p-6">
      <h4 class="text-lg font-medium text-gray-900 mb-4">Sync Status</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm font-medium text-gray-500">Last App Sync</p>
          <div class="flex items-center mt-1">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getSyncStatus().color}">
              {getSyncStatus().text}
            </span>
            {#if summary.lastAppSync}
              <span class="ml-2 text-sm text-gray-500">
                {formatDate(summary.lastAppSync)}
              </span>
            {/if}
          </div>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-500">Last Processed</p>
          <p class="text-sm text-gray-900 mt-1">
            {formatDate(summary.lastProcessedAt)}
          </p>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-500">Device Last Used</p>
          <p class="text-sm text-gray-900 mt-1">
            {formatDate(summary.device.lastUsedAt)}
          </p>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-500">Connection Time</p>
          <p class="text-sm text-gray-900 mt-1">
            {summary.device.connectedAt ? formatDate(summary.device.connectedAt) : 'Not connected'}
          </p>
        </div>
      </div>
    </div>

    <!-- App Distribution Chart -->
    {#if summary.totalAppsCount > 0}
      <div class="bg-white shadow rounded-lg p-6">
        <h4 class="text-lg font-medium text-gray-900 mb-4">App Distribution</h4>
        <div class="space-y-3">
          <!-- System Apps -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-red-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-700">System Apps</span>
            </div>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div 
                  class="bg-red-500 h-2 rounded-full" 
                  style="width: {(summary.systemAppsCount / summary.totalAppsCount) * 100}%"
                ></div>
              </div>
              <span class="text-sm text-gray-600">{summary.systemAppsCount}</span>
            </div>
          </div>

          <!-- Normal Apps -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-700">Normal Apps</span>
            </div>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div 
                  class="bg-green-500 h-2 rounded-full" 
                  style="width: {(summary.normalAppsCount / summary.totalAppsCount) * 100}%"
                ></div>
              </div>
              <span class="text-sm text-gray-600">{summary.normalAppsCount}</span>
            </div>
          </div>

          <!-- User Apps -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-purple-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-700">User Apps</span>
            </div>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div 
                  class="bg-purple-500 h-2 rounded-full" 
                  style="width: {((summary.totalAppsCount - summary.systemAppsCount - summary.normalAppsCount) / summary.totalAppsCount) * 100}%"
                ></div>
              </div>
              <span class="text-sm text-gray-600">
                {summary.totalAppsCount - summary.systemAppsCount - summary.normalAppsCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
