<script lang="ts">
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { AdminCard } from "$lib/components/admin";
  import { 
    Info, 
    Monitor, 
    Cpu, 
    Shield, 
    FileText, 
    Tag,
    RefreshCw
  } from "lucide-svelte";
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DeviceAppList from './DeviceAppList.svelte';
  import DeviceInformationContent from "$lib/components/ui_components_sveltekit/devices/DeviceInformationContent.svelte";
  import ConnectionStatusCard from "$lib/components/ui_components_sveltekit/devices/ConnectionStatusCard.svelte";
  import SecurityCard from "$lib/components/ui_components_sveltekit/devices/SecurityCard.svelte";
  import TechnicalDetailsContent from "$lib/components/ui_components_sveltekit/devices/TechnicalDetailsContent.svelte";
  import ActionHistory from "$lib/components/ui_components_sveltekit/devices/ActionHistory.svelte";
  import DeviceDeviceTagComponent from "$lib/components/ui_components_sveltekit/devices/device_device_tag/DeviceDeviceTagComponent.svelte";
  import { CompactInfoGrid, CompactInfoItem } from "$lib/components/ui_components_sveltekit/layout";
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Clock } from "lucide-svelte";

  export let device: any;
  export let actionLogs: any[] = [];
  export let licenses: any[] = [];
  export let apiKeyEnhance: any;
  export let apiKeySubmitting: any;
  export let isLoading: any;
  export let actionStatus: any;

  let activeTab = "overview";
  let loading = false;

  // Initialize activeTab from URL parameter
  onMount(() => {
    const urlParams = new URLSearchParams($page.url.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'apps', 'technical', 'security', 'tags'].includes(tabParam)) {
      activeTab = tabParam;
    }
  });

  // Track previous tab to avoid infinite loops
  let previousTab = activeTab;
  
  // Handle tab change and update URL
  $: if (activeTab && activeTab !== previousTab) {
    previousTab = activeTab;
    const url = new URL($page.url);
    url.searchParams.set('tab', activeTab);
    goto(url.toString(), { replaceState: true });
  }

  // License status helpers
  const LICENSE_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    REVOKED: 'Revoked',
    EXPIRED: 'Expired',
    SUSPENDED: 'Suspended'
  };

  function getLicenseStatusBadgeVariant(status: string): 'success' | 'destructive' | 'secondary' | 'outline' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'revoked') return 'destructive';
    if (s === 'expired') return 'secondary';
    if (s === 'suspended') return 'outline';
    return 'outline';
  }

  function getLicenseStatusLabel(status: string): string {
    return LICENSE_STATUS_LABELS[status] ?? status;
  }

  async function syncDevice() {
    try {
      loading = true;
      const response = await fetch(`/api/devices/${device.id}/sync`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Sync initiated', {
          description: 'Device app data is being synchronized'
        });
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header with Device Name and Sync Button -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">{device.name || "Device Details"}</h1>
      <p class="text-sm text-gray-600 mt-1">
        Device ID: {device.id}
        {#if device.connected}
          <Badge variant="success" class="ml-2">Connected</Badge>
        {:else}
          <Badge variant="destructive" class="ml-2">Disconnected</Badge>
        {/if}
      </p>
    </div>
    <div class="flex items-center space-x-3">
      <Button
        on:click={syncDevice}
        disabled={loading}
        class="flex items-center space-x-2"
      >
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
        <span>{loading ? 'Syncing...' : 'Sync Now'}</span>
      </Button>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <Tabs bind:value={activeTab} class="w-full">
    <TabsList class="grid w-full grid-cols-5">
      <TabsTrigger value="overview" class="flex items-center space-x-2">
        <Info class="h-4 w-4" />
        <span>Overview</span>
      </TabsTrigger>
      <TabsTrigger value="apps" class="flex items-center space-x-2">
        <Monitor class="h-4 w-4" />
        <span>Apps</span>
      </TabsTrigger>
      <TabsTrigger value="technical" class="flex items-center space-x-2">
        <Cpu class="h-4 w-4" />
        <span>Technical</span>
      </TabsTrigger>
      <TabsTrigger value="security" class="flex items-center space-x-2">
        <Shield class="h-4 w-4" />
        <span>Security</span>
      </TabsTrigger>
      <TabsTrigger value="tags" class="flex items-center space-x-2">
        <Tag class="h-4 w-4" />
        <span>Tags</span>
      </TabsTrigger>
    </TabsList>

    <!-- Overview Tab -->
    <TabsContent value="overview" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Device Information Card -->
        <AdminCard
          title="Device Information"
          description="Basic details about this device"
          icon={Info}
          compact={true}
          class_name="md:col-span-2"
        >
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <DeviceInformationContent {device} />
              </div>
              <div class="border-l-0 md:border-l border-muted pl-0 md:pl-4">
                {#if device}
                  <CompactInfoGrid columns={1} gap="gap-1">
                    <CompactInfoItem label="Created" icon={Clock}>
                      <div class="text-xs">
                        <RelativeDate date={device.createdAt} />
                        {#if device.createdBy && device.user}
                          <span class="block text-muted-foreground">
                            by {device.user.name || device.user.email}
                          </span>
                        {/if}
                      </div>
                    </CompactInfoItem>

                    {#if device.updatedAt && device.updatedAt.toString() !== device.createdAt.toString()}
                      <CompactInfoItem label="Updated" icon={Clock}>
                        <div class="text-xs">
                          <RelativeDate date={device.updatedAt} />
                        </div>
                      </CompactInfoItem>
                    {/if}

                    {#if device.lastUsedAt}
                      <CompactInfoItem label="Last used" icon={Clock}>
                        <div class="text-xs">
                          <RelativeDate date={device.lastUsedAt} />
                        </div>
                      </CompactInfoItem>
                    {/if}
                  </CompactInfoGrid>
                {:else}
                  <div class="space-y-2">
                    <Skeleton class="h-3 w-3/4" />
                    <Skeleton class="h-3 w-1/2" />
                  </div>
                {/if}
              </div>
            </div>
          </div>
          <svelte:fragment slot="footer">
            <MetadataFooter
              items={[
                {
                  label: "Created",
                  date: device.createdAt,
                  icon: "calendar",
                },
                {
                  label: "Created By",
                  value: device.user?.name || "Unknown",
                  icon: "user",
                },
                {
                  label: "Account",
                  value: device.account?.name || "None",
                  icon: "tag",
                },
                {
                  label: "Last Updated",
                  date: device.updatedAt,
                  icon: "clock",
                },
              ]}
            />
          </svelte:fragment>
        </AdminCard>

        <!-- Device Status Card -->
        <AdminCard
          title="Device Status"
          icon={Info}
          compact={true}
          class_name="md:col-span-2"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConnectionStatusCard {device} />
            <div class="border-t md:border-t-0 md:border-l border-muted pt-4 md:pt-0 md:pl-4">
              <SecurityCard {device} {apiKeyEnhance} {apiKeySubmitting} />
            </div>
          </div>
        </AdminCard>
      </div>

      <!-- Action History Section -->
      <AdminCard
        title="Action History"
        description="Recent actions performed on this device"
        icon={FileText}
        compact={true}
      >
        {#if actionLogs && actionLogs.length > 0}
          <ActionHistory {actionLogs} />
        {:else}
          <div class="text-sm text-neutral-500">No recent actions.</div>
        {/if}
      </AdminCard>
    </TabsContent>

    <!-- Apps Tab -->
    <TabsContent value="apps" class="space-y-6">
      {#if device?.id}
        <DeviceAppList 
          deviceId={device.id} 
          accountId={device.accountId}
          {actionLogs}
          {isLoading}
          {actionStatus}
        />
      {:else}
        <div class="text-center py-8">
          <p class="text-gray-500">Device information not available</p>
        </div>
      {/if}
    </TabsContent>

    <!-- Technical Tab -->
    <TabsContent value="technical" class="space-y-6">
      <AdminCard
        title="Technical Details"
        description="Hardware and software information"
        icon={Cpu}
        compact={true}
      >
        <TechnicalDetailsContent {device} />
      </AdminCard>
    </TabsContent>

    <!-- Security Tab -->
    <TabsContent value="security" class="space-y-6">
      <AdminCard
        title="Security & Licenses"
        description="API keys, licenses, and security settings"
        icon={Shield}
        compact={true}
      >
        <div class="space-y-6">
          <!-- Security Section -->
          <div>
            <h3 class="text-lg font-medium mb-4">Security Settings</h3>
            <SecurityCard {device} {apiKeyEnhance} {apiKeySubmitting} />
          </div>

          <!-- Licenses Section -->
          <div>
            <h3 class="text-lg font-medium mb-4">Device Licenses</h3>
            {#if licenses && licenses.length > 0}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left border-b">
                      <th class="py-2 pr-4">License ID</th>
                      <th class="py-2 pr-4">Status</th>
                      <th class="py-2 pr-4">Issued At</th>
                      <th class="py-2 pr-4">Expires At</th>
                      <th class="py-2 pr-4">Key ID</th>
                      <th class="py-2 pr-4">Algorithm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each licenses as license}
                      <tr class="border-b last:border-b-0">
                        <td class="py-2 pr-4">{license.id}</td>
                        <td class="py-2 pr-4">
                          <Badge variant={getLicenseStatusBadgeVariant(license.status)}>
                            {getLicenseStatusLabel(license.status)}
                          </Badge>
                        </td>
                        <td class="py-2 pr-4 text-neutral-500">{new Date(license.issuedAt).toLocaleString()}</td>
                        <td class="py-2 pr-4 text-neutral-500">{new Date(license.expiresAt).toLocaleString()}</td>
                        <td class="py-2 pr-4">{license.keyId}</td>
                        <td class="py-2 pr-4">{license.algorithm}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-sm text-neutral-500">No licenses.</div>
            {/if}
          </div>
        </div>
      </AdminCard>
    </TabsContent>


    <!-- Tags Tab -->
    <TabsContent value="tags" class="space-y-6">
      <AdminCard
        title="Device Tags"
        description="Device tags attached to this device"
        icon={Tag}
        compact={true}
      >
        <DeviceDeviceTagComponent 
          deviceId={device.id}
          deviceTags={device.tags || []}
          loading={false}
        />
      </AdminCard>
    </TabsContent>
  </Tabs>
</div>
