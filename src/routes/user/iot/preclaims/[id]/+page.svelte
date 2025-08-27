<script lang="ts">
  import { goto } from '$app/navigation';
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import { AdminCard } from "$lib/components/admin";
  import { Badge } from "$lib/components/ui/badge";
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import { toast } from 'svelte-sonner';
  import { ArrowLeft, Info } from 'lucide-svelte';

  export let data: any;
  let preclaimSet = data.preclaimSet;
  $: preclaimSet = data.preclaimSet;

  const title = `Pre-claim Set: ${preclaimSet?.name || preclaimSet?.id}`;

  const pageCrumbs: [string, string][] = [
    ["Home", "/user"],
    ["IoT", "/user/iot"],
    ["Pre-claims", "/user/iot/preclaims"],
    [preclaimSet?.name || 'Pre-claim Set', ""]
  ];

  function getStatusDisplay(status: any) {
    const map: Record<string, string> = {
      'ACTIVE': 'Active',
      'INACTIVE': 'Inactive',
      'EXPIRED': 'Expired'
    };
    return map[status] || status || 'Unknown';
  }

  function getStatusVariant(status: any): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    const map: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
      'ACTIVE': 'success',
      'INACTIVE': 'secondary',
      'EXPIRED': 'destructive'
    };
    return map[status] || 'outline';
  }

  const claims = data?.claims ?? [];
</script>

<AdminPageLayout
  {title}
  crumbs={pageCrumbs}
  actionButtons={[
    {
      label: 'Back',
      icon: ArrowLeft,
      onClick: () => goto('/user/iot/preclaims'),
      variant: 'outline'
    }
  ]}
>
  <div class="w-full space-y-6">
    <!-- Overview -->
    <AdminCard>
      <svelte:fragment slot="header">
        <h3 class="text-lg font-medium">Pre-claim Overview</h3>
        <p class="text-sm text-muted-foreground">Key information about this pre-claim set</p>
      </svelte:fragment>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">Name</p>
          <p class="text-sm font-medium">{preclaimSet?.name || 'Unnamed'}</p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <div>
            <Badge variant={getStatusVariant(preclaimSet?.status)}>
              {getStatusDisplay(preclaimSet?.status)}
            </Badge>
          </div>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">Expires</p>
          {#if preclaimSet?.expiresAt}
            <p class="text-sm"><RelativeDate date={preclaimSet.expiresAt} /></p>
          {:else}
            <p class="text-sm">No expiry</p>
          {/if}
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">Claims</p>
          <p class="text-sm">{claims.length}</p>
        </div>
      </div>

      {#if preclaimSet?.description}
        <div class="mt-4 pt-4 border-t">
          <p class="text-xs text-muted-foreground mb-1">Description</p>
          <p class="text-sm">{preclaimSet.description}</p>
        </div>
      {/if}
    </AdminCard>

    <!-- Claims List -->
    <AdminCard>
      <svelte:fragment slot="header">
        <h3 class="text-lg font-medium">Claims</h3>
        <p class="text-sm text-muted-foreground">Devices included in this pre-claim set</p>
      </svelte:fragment>

      {#if claims.length === 0}
        <div class="p-8 text-center text-muted-foreground">
          <Info class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p class="text-lg font-medium mb-2">No claims</p>
          <p class="text-sm">This pre-claim set has no devices yet.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted-foreground border-b">
                <th class="py-2 pr-4">ID</th>
                <th class="py-2 pr-4">Device</th>
                <th class="py-2 pr-4">Status</th>
                <th class="py-2 pr-4">Claimed At</th>
              </tr>
            </thead>
            <tbody>
              {#each claims as c}
                <tr class="border-b last:border-0">
                  <td class="py-2 pr-4 font-mono text-xs">{c?.id}</td>
                  <td class="py-2 pr-4">{c?.deviceId ?? c?.serial ?? '—'}</td>
                  <td class="py-2 pr-4">
                    <Badge variant={getStatusVariant(c?.status)}>{getStatusDisplay(c?.status)}</Badge>
                  </td>
                  <td class="py-2 pr-4">
                    {#if c?.claimedAt}
                      <RelativeDate date={c.claimedAt} />
                    {:else}
                      —
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </AdminCard>
  </div>
</AdminPageLayout>
