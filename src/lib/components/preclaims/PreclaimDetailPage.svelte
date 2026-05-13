<script lang="ts">
    import { goto } from '$app/navigation';
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { AdminCard } from "$lib/components/admin";
    import { ArrowLeft, Pencil } from 'lucide-svelte';
    import PreclaimBasicInfo from "$lib/components/ui_components_sveltekit/preclaims/PreclaimBasicInfo.svelte";
    import PreclaimMetrics from "$lib/components/ui_components_sveltekit/preclaims/PreclaimMetrics.svelte";
    import PreclaimDescription from "$lib/components/ui_components_sveltekit/preclaims/PreclaimDescription.svelte";
    import PreclaimMetadata from "$lib/components/ui_components_sveltekit/preclaims/PreclaimMetadata.svelte";
    import PreclaimDeviceTable from "$lib/components/ui_components_sveltekit/preclaims/PreclaimDeviceTable.svelte";

    /**
     * Props for PreclaimDetailPage component
     */
    export let preclaimSet: any;
    export let claims: any[] = [];
    export let metrics: any;
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string; // "/admin" or "/user"
    export let apiPrefix: string; // "/api/admin" or "/api/user"
    export let isAdmin: boolean = false;

    // Make preclaimSet reactive to server invalidations
    $: preclaimSet = preclaimSet;
    $: metrics = metrics || { total: 0, claimed: 0, left: 0 };
    $: claims = claims || [];
</script>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: 'Back',
            icon: ArrowLeft,
            onClick: () => goto(`${basePath}/iot/preclaims`),
            variant: 'outline'
        },
        {
            label: 'Edit',
            icon: Pencil,
            onClick: () => goto(`${basePath}/iot/preclaims/${preclaimSet?.id}/edit`),
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
                {preclaimSet}
                {isAdmin}
            />

            <PreclaimMetrics
                {preclaimSet}
                {metrics}
            />

            <PreclaimDescription
                {preclaimSet}
            />

            <svelte:fragment slot="footer">
                <PreclaimMetadata
                    {preclaimSet}
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
                preclaimId={preclaimSet?.id}
            />
        </AdminCard>
    </div>
</AdminPageLayout>

