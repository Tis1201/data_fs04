<script lang="ts">
  import { goto } from '$app/navigation';
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import { AdminCard } from "$lib/components/admin";
  import { ArrowLeft, Info, Pencil } from 'lucide-svelte';
  import PreclaimBasicInfo from "$lib/components/ui_components_sveltekit/preclaims/PreclaimBasicInfo.svelte";
  import PreclaimMetrics from "$lib/components/ui_components_sveltekit/preclaims/PreclaimMetrics.svelte";
  import PreclaimDescription from "$lib/components/ui_components_sveltekit/preclaims/PreclaimDescription.svelte";
  import PreclaimMetadata from "$lib/components/ui_components_sveltekit/preclaims/PreclaimMetadata.svelte";
  import PreclaimDeviceTable from "$lib/components/ui_components_sveltekit/preclaims/PreclaimDeviceTable.svelte";

  export let data: any;
  let preclaimSet = data.preclaimSet;
  $: preclaimSet = data.preclaimSet;
  const metrics = data?.metrics ?? { total: 0, claimed: 0, left: 0 };

  const title = `Pre-claim Set: ${preclaimSet?.name || preclaimSet?.id}`;

  const pageCrumbs: [string, string][] = [
    ["Home", "/user"],
      ["IOT", ""],
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
    },
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => goto(`/user/iot/preclaims/${preclaimSet.id}/edit`),
      variant: 'default'
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

      <PreclaimBasicInfo
        preclaimSet={preclaimSet}
        isAdmin={false}
      />

      <PreclaimMetrics
        preclaimSet={preclaimSet}
        metrics={data.metrics}
      />

      <PreclaimDescription
        preclaimSet={preclaimSet}
      />

      <svelte:fragment slot="footer">
        <PreclaimMetadata
          preclaimSet={preclaimSet}
        />
      </svelte:fragment>
    </AdminCard>

    <!-- Claims List -->
    <AdminCard>
      <svelte:fragment slot="header">
        <h3 class="text-lg font-medium">Claims</h3>
        <p class="text-sm text-muted-foreground">Devices included in this pre-claim set</p>
      </svelte:fragment>

      <PreclaimDeviceTable
        preclaimId={preclaimSet.id}
        apiPrefix="/api/user"
      />
    </AdminCard>
  </div>
</AdminPageLayout>
