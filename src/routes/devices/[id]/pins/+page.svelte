<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import DeviceAppListWithPins from '$lib/components/device/DeviceAppListWithPins.svelte';

  export let data: {
    deviceId: string;
    user: any;
  };

  let deviceId = data.deviceId;
  let actionLogs: any[] = [];
  let isLoading = false;
  let actionStatus = { action: "", status: "", message: "" };
</script>

<svelte:head>
  <title>Device Pin Management - {deviceId}</title>
  <meta name="description" content="Manage app pins for device {deviceId}" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <nav class="flex items-center space-x-2 text-sm text-gray-600 mb-4">
        <a href="/devices" class="hover:text-gray-900">Devices</a>
        <span>/</span>
        <a href="/devices/{deviceId}" class="hover:text-gray-900">{deviceId}</a>
        <span>/</span>
        <span class="text-gray-900">Pin Management</span>
      </nav>
      
      <h1 class="text-3xl font-bold text-gray-900">Device Pin Management</h1>
      <p class="text-gray-600 mt-1">Manage app pins and pin rules for device {deviceId}</p>
    </div>

    <DeviceAppListWithPins 
      {deviceId}
      {actionLogs}
      {isLoading}
      {actionStatus}
    />
  </div>
</div>
