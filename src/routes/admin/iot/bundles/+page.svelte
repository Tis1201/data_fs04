<script lang="ts">
    import BundleTable from "./table.svelte";
    import { Plus, Package, Monitor, Settings, Play } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { toast } from 'svelte-sonner';

    export let data: PageData;

    $: ({ bundles: records, meta } = data as any);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    let showInstallModal = false;
    let selectedBundles: string[] = [];
    let selectedDevices: string[] = [];
    let sessionConfig = {
      name: '',
      batchSize: 500,
      priority: 'normal'
    };
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"]
    ];

    function handleInstallSession() {
      if (selectedBundles.length === 0) {
        toast.error('Please select at least one bundle');
        return;
      }
      if (selectedDevices.length === 0) {
        toast.error('Please select at least one device');
        return;
      }
      if (!sessionConfig.name.trim()) {
        toast.error('Please enter a session name');
        return;
      }

      toast.success('Bundle installation session created successfully');
      showInstallModal = false;
      // Reset selections
      selectedBundles = [];
      selectedDevices = [];
      sessionConfig.name = '';
    }

    function canCreateSession(): boolean {
      return selectedBundles.length > 0 && selectedDevices.length > 0 && sessionConfig.name.trim().length > 0;
    }
</script>

<AdminPageLayout
    title="Bundles"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Bundle",
            icon: Plus,
            onClick: () => goto('/admin/iot/bundles/new')
        }
    ]}
>
    <BundleTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>

<!-- Bundle Installation Modal -->
{#if showInstallModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-xl font-semibold">Install Bundles</h3>
          <p class="text-muted-foreground">Deploy selected bundles to multiple devices</p>
        </div>
        <Button variant="ghost" size="sm" on:click={() => showInstallModal = false}>
          ✕
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Bundle Selection -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Package class="h-5 w-5" />
              Select Bundles
            </CardTitle>
            <CardDescription>
              Choose bundles to install
            </CardDescription>
          </CardHeader>
          <CardContent>
            {#if selectedBundles.length === 0}
              <div class="text-center py-8 text-muted-foreground">
                <Package class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bundles selected</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  class="mt-4"
                  on:click={() => selectedBundles = ['bundle-1', 'bundle-2']}
                >
                  Select Sample Bundles
                </Button>
              </div>
            {:else}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <Badge variant="secondary">{selectedBundles.length} bundles selected</Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    on:click={() => selectedBundles = []}
                  >
                    Clear Selection
                  </Button>
                </div>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {#each selectedBundles as bundleId}
                    <div class="text-sm text-muted-foreground">
                      {bundleId}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </CardContent>
        </Card>

        <!-- Device Selection -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Monitor class="h-5 w-5" />
              Select Devices
            </CardTitle>
            <CardDescription>
              Choose target devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {#if selectedDevices.length === 0}
              <div class="text-center py-8 text-muted-foreground">
                <Monitor class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No devices selected</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  class="mt-4"
                  on:click={() => selectedDevices = ['device-1', 'device-2', 'device-3']}
                >
                  Select Sample Devices
                </Button>
              </div>
            {:else}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <Badge variant="secondary">{selectedDevices.length} devices selected</Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    on:click={() => selectedDevices = []}
                  >
                    Clear Selection
                  </Button>
                </div>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {#each selectedDevices as deviceId}
                    <div class="text-sm text-muted-foreground">
                      {deviceId}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </CardContent>
        </Card>
      </div>

      <!-- Session Configuration -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Settings class="h-5 w-5" />
            Session Configuration
          </CardTitle>
          <CardDescription>
            Configure the installation session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="text-sm font-medium">Session Name</label>
              <input 
                type="text" 
                placeholder="Enter session name"
                bind:value={sessionConfig.name}
                class="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label class="text-sm font-medium">Batch Size</label>
              <select 
                bind:value={sessionConfig.batchSize}
                class="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value={100}>100 devices per batch</option>
                <option value={250}>250 devices per batch</option>
                <option value={500}>500 devices per batch</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium">Priority</label>
              <select 
                bind:value={sessionConfig.priority}
                class="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          
          <div class="mt-6 flex justify-end gap-2">
            <Button 
              variant="outline"
              on:click={() => showInstallModal = false}
            >
              Cancel
            </Button>
            <Button 
              on:click={handleInstallSession}
              disabled={!canCreateSession()}
            >
              <Play class="h-4 w-4 mr-2" />
              Create Installation Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
{/if}
