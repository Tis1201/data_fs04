<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import PinRuleManager from '$lib/components/pin-management/PinRuleManager.svelte';

  // Authentication is handled server-side in +page.server.ts
</script>

<svelte:head>
  <title>Pin Rule Management - Admin Panel</title>
  <meta name="description" content="Manage hierarchical pin rules for device apps" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <PinRuleManager />
  </div>
</div>
