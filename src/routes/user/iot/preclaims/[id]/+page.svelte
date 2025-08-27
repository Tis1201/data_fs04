<script lang="ts">
  import { goto } from '$app/navigation';
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import { AdminCard } from "$lib/components/admin";
  import { Badge } from "$lib/components/ui/badge";
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import { toast } from 'svelte-sonner';
  import { ArrowLeft, Info } from 'lucide-svelte';
  import ClaimsTable from './claims/table.svelte';
  import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";

  export let data: any;
  let preclaimSet = data.preclaimSet;
  $: preclaimSet = data.preclaimSet;
  const metrics = data?.metrics ?? { total: 0, claimed: 0, left: 0 };

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

      <!-- Basic info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      <!-- Metrics tiles -->
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">Total Devices</p>
          <p class="text-2xl font-semibold">{metrics.total}</p>
          <p class="text-xs text-muted-foreground">Devices in this pre-claim set</p>
        </div>
        <div class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">Devices Claimed</p>
          <p class="text-2xl font-semibold">{metrics.claimed}</p>
          <p class="text-xs text-muted-foreground">Claimed or used</p>
        </div>
        <div class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">Devices Left</p>
          <p class="text-2xl font-semibold">{metrics.left}</p>
          <p class="text-xs text-muted-foreground">Remaining to be claimed</p>
        </div>
        <div class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">Expires</p>
          <p class="text-sm">
            {#if preclaimSet?.expiresAt}
              <RelativeDate date={preclaimSet.expiresAt} />
            {:else}
              No expiry
            {/if}
          </p>
          <p class="text-xs text-muted-foreground">Validity of this set</p>
        </div>
      </div>

      {#if preclaimSet?.description}
        <div class="mt-4 pt-4 border-t">
          <p class="text-xs text-muted-foreground mb-1">Description</p>
          <p class="text-sm">{preclaimSet.description}</p>
        </div>
      {/if}

      <svelte:fragment slot="footer">
        <MetadataFooter
          items={[
            { label: "ID", value: preclaimSet?.id, icon: "hash" },
            { label: "Account", value: preclaimSet?.account?.name || "None", icon: "tag" },
            { label: "Created By", value: preclaimSet?.user?.name || "Unknown", icon: "user" },
            { label: "Created", date: preclaimSet?.createdAt, icon: "calendar" },
            { label: "Last Updated", date: preclaimSet?.updatedAt, icon: "clock" }
          ]}
        />
      </svelte:fragment>
    </AdminCard>

    <!-- Claims List -->
    <AdminCard>
      <svelte:fragment slot="header">
        <h3 class="text-lg font-medium">Claims</h3>
        <p class="text-sm text-muted-foreground">Devices included in this pre-claim set</p>
      </svelte:fragment>

      <ClaimsTable preclaimId={preclaimSet.id} />
    </AdminCard>
  </div>
</AdminPageLayout>
