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
    RefreshCw,
    Clock,
    Activity,
    Settings,
    Save
  } from "lucide-svelte";
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/ProfileSettingsEditor.svelte';
  import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
  import { superForm } from 'sveltekit-superforms/client';
  import { enhance } from '$app/forms';

  /* Reused lists */
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

  export let device: any;
  export let actionLogs: any[] = [];
  export let licenses: any[] = [];
  export let apiKeyEnhance: any;
  export let apiKeySubmitting: any;
  export let isLoading: any;
  export let actionStatus: any;
  export let deviceInformation: any = null;
  export let deviceProfile: any = null;
  export let deviceProfileForm: any = null;
  export let sseStore: any; // ✅ FIX: Receive sseStore as prop from parent

  let activeTab = "overview";
  let loading = false;
  let profileSettingsEditor: any;
  
  // Initialize form for device profile editing (MUST be at top level, not in onMount)
  let localProfileSettings: any[] = [];
  let profileEnhance: any = undefined;
  let profileSubmitting: any = undefined;
  let profileForm: any = undefined;
  
  // Call superForm at top level (required by Svelte)
  if (deviceProfileForm) {
    const formResult = superForm(deviceProfileForm, {
      taintedMessage: false,
      invalidateAll: false,
      resetForm: false,
      onResult: async ({ result }) => {
        if (result.type === "success") {
          toast.success('Device profile updated successfully');
          // Refresh the page to show updated profile
          goto($page.url.pathname + $page.url.search, { invalidateAll: true });
        } else if (result.type === "failure") {
          toast.error('Failed to update device profile');
        }
      }
    });
    
    profileForm = formResult.form;
    profileEnhance = formResult.enhance;
    profileSubmitting = formResult.submitting;
    
    // Initialize localProfileSettings from form data
    try {
      localProfileSettings = JSON.parse($profileForm.settings || '[]');
    } catch (e) {
      localProfileSettings = [];
    }
  } else if (deviceProfile?.settings) {
    // Fallback: initialize from deviceProfile if form not available (read-only mode)
    localProfileSettings = deviceProfile.settings.map((s: any) => ({
      key: s.key,
      value: s.value,
      dataType: s.dataType,
      label: s.label,
      category: s.category,
      order: s.order,
      enabled: s.dataType === 'boolean' ? true : false
    }));
  }
  
  // Update form settings when localProfileSettings changes (user edits)
  $: if (profileForm && localProfileSettings) {
    $profileForm.settings = JSON.stringify(localProfileSettings);
  }
  
  onMount(() => {
    // Initialize activeTab from URL parameter
    const urlParams = new URLSearchParams($page.url.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'apps', 'activity', 'security', 'tags'].includes(tabParam)) {
      activeTab = tabParam;
    }
    
    console.log('[DeviceDetailTabs] Form initialized:', {
      hasDeviceProfileForm: !!deviceProfileForm,
      hasDeviceProfile: !!deviceProfile,
      deviceProfileLevel: deviceProfile?.level,
      deviceProfileId: deviceProfile?.id,
      hasProfileEnhance: !!profileEnhance,
      settingsCount: localProfileSettings.length
    });
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

<div class="space-y-4">
  <!-- Header with Device Name and Sync Button -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{device.name || "Device Details"}</h1>
      <p class="text-xs text-gray-600 mt-0.5">
        Device ID: {device.id}
        {#if device.connected}
          <Badge variant="success" class="ml-2 text-xs py-0 px-1.5">Connected</Badge>
        {:else}
          <Badge variant="destructive" class="ml-2 text-xs py-0 px-1.5">Disconnected</Badge>
        {/if}
      </p>
    </div>
    <div class="flex items-center space-x-2">
    </div>
  </div>

  <!-- Tabs Navigation -->
  <Tabs bind:value={activeTab} class="w-full">
    <TabsList class="grid w-full grid-cols-5 h-9">
      <TabsTrigger value="overview" class="flex items-center space-x-1.5 text-xs py-1.5">
        <Info class="h-3.5 w-3.5" />
        <span>Overview</span>
      </TabsTrigger>
      <TabsTrigger value="apps" class="flex items-center space-x-1.5 text-xs py-1.5">
        <Monitor class="h-3.5 w-3.5" />
        <span>Apps</span>
      </TabsTrigger>
      <TabsTrigger value="activity" class="flex items-center space-x-1.5 text-xs py-1.5">
        <Activity class="h-3.5 w-3.5" />
        <span>Activity</span>
      </TabsTrigger>
      <TabsTrigger value="security" class="flex items-center space-x-1.5 text-xs py-1.5">
        <Shield class="h-3.5 w-3.5" />
        <span>Security</span>
      </TabsTrigger>
      <TabsTrigger value="tags" class="flex items-center space-x-1.5 text-xs py-1.5">
        <Tag class="h-3.5 w-3.5" />
        <span>Tags</span>
      </TabsTrigger>
    </TabsList>

    <!-- Overview Tab -->
    <TabsContent value="overview" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Device Information Card -->
        <AdminCard
          title="Device Information"
          description="Basic details about this device"
          icon={Info}
          compact={true}
          class_name="md:col-span-2"
        >
          <div class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="md:col-span-2">
                <DeviceInformationContent {device} />
              </div>
              <div class="border-l-0 md:border-l border-muted pl-0 md:pl-4">
                {#if device}
                  <CompactInfoGrid columns={1} gap="gap-1">
                    <CompactInfoItem label="Device Created" icon={Clock}>
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
                      <CompactInfoItem label="Last System Updated" icon={Clock}>
                        <div class="text-xs">
                          <RelativeDate date={device.updatedAt} />
                        </div>
                      </CompactInfoItem>
                    {/if}

                    {#if device.lastUsedAt}
                      <CompactInfoItem label="Last System Connection" icon={Clock}>
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
                  label: "Device Created",
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
                  label: "Last System Updated",
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
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ConnectionStatusCard {device} />
            <div class="border-t md:border-t-0 md:border-l border-muted pt-3 md:pt-0 md:pl-3">
              <SecurityCard {device} {apiKeyEnhance} {apiKeySubmitting} />
            </div>
          </div>
        </AdminCard>

        <!-- Technical Details Card -->
        <AdminCard
          title="Technical Details"
          description="Hardware and software information"
          icon={Cpu}
          compact={true}
          class_name="md:col-span-2"
        >
          <TechnicalDetailsContent {device} {deviceInformation} />
        </AdminCard>

        <!-- Device Profile Card -->
        {#if deviceProfile}
          <AdminCard
            title="Device Profile"
            description="Configuration profile assigned to this device"
            icon={Settings}
            compact={true}
            class_name="md:col-span-2"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-medium">{deviceProfile.name}</h4>
                  {#if deviceProfile.description}
                    <p class="text-xs text-muted-foreground mt-1">{deviceProfile.description}</p>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <Badge variant={deviceProfile.level === 'DEVICE' ? 'default' : 'secondary'} class="text-xs">
                    {deviceProfile.level === 'DEVICE' ? 'Device Level' : 'Global'}
                  </Badge>
                  {#if deviceProfile.level === 'GLOBAL' && deviceProfile.hasOverrides}
                    <Badge variant="outline" class="text-xs border-blue-300 text-blue-700">
                      {deviceProfile.overrideCount} Customization{deviceProfile.overrideCount === 1 ? '' : 's'}
                    </Badge>
                  {/if}
                </div>
              </div>

              {#if deviceProfile.level === 'DEVICE' || deviceProfile.level === 'GLOBAL'}
                {#if !deviceProfileForm}
                  <div class="rounded-md bg-yellow-50 border border-yellow-200 p-3 mt-3">
                    <p class="text-sm text-yellow-800">
                      Profile detected, but form not initialized. 
                      Please refresh the page.
                    </p>
                    <p class="text-xs text-yellow-700 mt-1">
                      Profile ID: {deviceProfile.id} ({deviceProfile.level})
                    </p>
                  </div>
                {:else if !profileEnhance}
                  <div class="rounded-md bg-yellow-50 border border-yellow-200 p-3 mt-3">
                    <p class="text-sm text-yellow-800">
                      Form initialized but editor not ready. Check browser console for errors.
                    </p>
                  </div>
                {:else}
                  <!-- Show editable Profile Settings for both DEVICE-level and GLOBAL profiles -->
                  {#if deviceProfile.level === 'GLOBAL'}
                    <div class="rounded-md bg-blue-50 border border-blue-200 p-3 mb-4">
                      <p class="text-sm text-blue-800 mb-1">
                        <strong>Global Profile with Customizations</strong>
                      </p>
                      <p class="text-xs text-blue-700">
                        {#if deviceProfile.hasOverrides}
                          This device has {deviceProfile.overrideCount} customized setting{deviceProfile.overrideCount === 1 ? '' : 's'}. 
                          Changes will update your device-specific customizations.
                        {:else}
                          This is a global profile. Changes you make will create device-specific customizations (overrides) 
                          that only apply to this device.
                        {/if}
                      </p>
                    </div>
                  {/if}
                  
                  <form method="POST" action="?/updateDeviceProfile" use:profileEnhance>
                    <ProfileSettingsEditor 
                      bind:this={profileSettingsEditor}
                      bind:settings={localProfileSettings} 
                      {availableSettings} 
                    />
                    <input type="hidden" name="name" bind:value={$profileForm.name} />
                    <input type="hidden" name="description" bind:value={$profileForm.description} />
                    <input type="hidden" name="settings" bind:value={$profileForm.settings} />
                    <div class="flex justify-between items-center mt-4 pt-4 border-t">
                      {#if deviceProfile.level === 'GLOBAL' && deviceProfile.hasOverrides}
                        <a 
                          href="/admin/iot/device-profiles/{deviceProfile.id}/edit?tab=devices" 
                          class="text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          View Global Profile →
                        </a>
                      {:else if deviceProfile.level === 'GLOBAL'}
                        <p class="text-xs text-muted-foreground">
                          Based on: <a 
                            href="/admin/iot/device-profiles/{deviceProfile.id}/edit?tab=devices" 
                            class="text-primary hover:underline"
                          >
                            {deviceProfile.name}
                          </a>
                        </p>
                      {:else}
                        <div></div>
                      {/if}
                      <Button 
                        type="submit"
                        size="sm"
                        disabled={$profileSubmitting}
                      >
                        <Save class="h-3 w-3 mr-1" />
                        {#if $profileSubmitting}
                          Saving...
                        {:else}
                          Save Changes
                        {/if}
                      </Button>
                    </div>
                  </form>
                {/if}
              {:else}
                <p class="text-sm text-muted-foreground">Profile loading...</p>
              {/if}
              
              <div class="border-t pt-3 mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  <span>Last updated: </span>
                  <RelativeDate date={deviceProfile.updatedAt} />
                </div>
                {#if deviceProfile.level !== 'DEVICE'}
                  <a 
                    href="/admin/iot/device-profiles/{deviceProfile.id}/edit?tab=devices" 
                    class="text-primary hover:underline"
                  >
                    Manage Profile
                  </a>
                {/if}
              </div>
            </div>
          </AdminCard>
        {/if}
      </div>
    </TabsContent>

    <!-- Apps Tab -->
    <TabsContent value="apps" class="space-y-4">
      {#if device?.id}
        <!-- Pinned Apps (favorite) -->
        <AdminCard
          title="Pinned Apps"
          description="Your favorite apps on this device"
          icon={Monitor}
          compact={true}
        >
          <DeviceAppList 
            deviceId={device.id}
            accountId={device.accountId}
            {actionLogs}
            {isLoading}
            {actionStatus}
            {sseStore}
            endpoint={`/api/devices/${device.id}/apps-with-pins`}
            initialQuery={{ filter: 'pinned' }}
          />
        </AdminCard>

        <!-- All Apps -->
        <AdminCard
          title="All Apps"
          description="Complete list of apps installed on this device"
          icon={Monitor}
          compact={true}
        >
          <DeviceAppList 
            deviceId={device.id} 
            accountId={device.accountId}
            {actionLogs}
            {isLoading}
            {actionStatus}
            {sseStore}
            endpoint={`/api/devices/${device.id}/apps`}
            initialQuery={{ filter: 'all' }}
          />
        </AdminCard>

        <!-- Action History: render ONCE on this page -->
        {#if actionLogs && actionLogs.length > 0}
          <AdminCard
            title="Action History"
            description="Recent actions performed on this device"
            icon={FileText}
            compact={true}
            class_name="text-sm"
          >
            <ActionHistory {actionLogs} />
          </AdminCard>
        {/if}
      {:else}
        <div class="text-center py-8">
          <p class="text-gray-500">Device information not available</p>
        </div>
      {/if}
    </TabsContent>

    <!-- Activity Tab -->
    <TabsContent value="activity" class="space-y-4">
      {#if device?.id}
        <AdminCard
          title="Action History"
          description="All actions performed on this device in real-time"
          icon={Activity}
          compact={true}
          class_name="text-sm"
        >
          {#if actionLogs && actionLogs.length > 0}
            <ActionHistory {actionLogs} />
          {:else}
            <div class="text-center py-8">
              <p class="text-muted-foreground text-sm">No action history available</p>
            </div>
          {/if}
        </AdminCard>
      {:else}
        <div class="text-center py-8">
          <p class="text-gray-500">Device information not available</p>
        </div>
      {/if}
    </TabsContent>

    <!-- Security Tab -->
    <TabsContent value="security" class="space-y-4">
      <AdminCard
        title="Security & Licenses"
        description="API keys, licenses, and security settings"
        icon={Shield}
        compact={true}
      >
        <div class="space-y-4">
          <!-- Security Section -->
          <div>
            <h3 class="text-sm font-medium mb-2">Security Settings</h3>
            <SecurityCard {device} {apiKeyEnhance} {apiKeySubmitting} />
          </div>

          <!-- Licenses Section -->
          <div>
            <h3 class="text-sm font-medium mb-2">Device Licenses</h3>
            {#if licenses && licenses.length > 0}
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-left border-b">
                      <th class="py-1.5 pr-3">License ID</th>
                      <th class="py-1.5 pr-3">Status</th>
                      <th class="py-1.5 pr-3">Issued At</th>
                      <th class="py-1.5 pr-3">Expires At</th>
                      <th class="py-1.5 pr-3">Key ID</th>
                      <th class="py-1.5 pr-3">Algorithm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each licenses as license}
                      <tr class="border-b last:border-b-0">
                        <td class="py-1.5 pr-3">{license.id}</td>
                        <td class="py-1.5 pr-3">
                          <Badge variant={getLicenseStatusBadgeVariant(license.status)} class="text-xs py-0 px-1.5">
                            {getLicenseStatusLabel(license.status)}
                          </Badge>
                        </td>
                        <td class="py-1.5 pr-3 text-neutral-500">{new Date(license.issuedAt).toLocaleString()}</td>
                        <td class="py-1.5 pr-3 text-neutral-500">{new Date(license.expiresAt).toLocaleString()}</td>
                        <td class="py-1.5 pr-3">{license.keyId}</td>
                        <td class="py-1.5 pr-3">{license.algorithm}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-xs text-neutral-500">No licenses.</div>
            {/if}
          </div>
        </div>
      </AdminCard>
    </TabsContent>

    <!-- Tags Tab -->
    <TabsContent value="tags" class="space-y-4">
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
