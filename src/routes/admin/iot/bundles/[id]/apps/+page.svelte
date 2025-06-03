<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Plus } from 'lucide-svelte';
    import { page } from '$app/stores';
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    
    import AppsTable from "./table.svelte";
    
    export let data;
    const { bundle } = data;
    
    const title = `Bundle Apps: ${bundle.name || bundle.id}`;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle.name || "Bundle", `/admin/iot/bundles/${bundle.id}`],
        ["Apps", ""]
    ];
    
    const appsCount = bundle.apps?.length || 0;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto(`/admin/iot/bundles/${bundle.id}`),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Add App",
        icon: Plus,
        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/apps/add`),
        variant: "default",
        class: "h-9"
      }
    ]}
>
    <div class="w-full space-y-6">
        <Card class="w-full">
            <CardHeader>
                <CardTitle>Bundle Apps</CardTitle>
                <CardDescription>
                    {appsCount} app{appsCount !== 1 ? 's' : ''} in this bundle
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AppsTable props={{
                    records: bundle.apps,
                    bundleId: bundle.id,
                    loading: false
                }} />
            </CardContent>
        </Card>
    </div>
</AdminPageLayout>
