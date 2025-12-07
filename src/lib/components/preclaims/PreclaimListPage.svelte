<script lang="ts">
    import { Plus, CheckCircle } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { useSuccessMessage } from "$lib/composables/useSuccessMessage";
    import { Card, CardContent } from "$lib/components/ui/card";
    import type { ComponentType } from 'svelte';

    /**
     * Props for PreclaimListPage component
     */
    export let data: any; // PageData from route (preclaimSets, meta)
    export let breadcrumbs: [string, string][];
    export let baseUrl: string; // "/admin/iot/preclaims" or "/user/iot/preclaims"
    export let newPreclaimPath: string; // "/admin/iot/preclaims/new" or "/user/iot/preclaims/new"
    export let title: string = "Preclaim Sets";
    export let context: 'admin' | 'user' = 'admin';
    export let tableComponent: ComponentType; // The table component to use (from route)

    $: ({ preclaimSets: records, meta } = data as any);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");

    let loading = false;

    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Use success message composable
    const { showSuccessMessage, successMessage } = useSuccessMessage();
</script>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Add Preclaim Set",
            icon: Plus,
            onClick: () => goto(newPreclaimPath)
        }
    ]}
>
    {#if $showSuccessMessage}
        <Card class="w-full mb-4 border-green-200 bg-green-50">
            <CardContent class="pt-4">
                <div class="flex items-center gap-3">
                    <CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p class="text-green-800 font-medium">{$successMessage}</p>
                </div>
            </CardContent>
        </Card>
    {/if}

    <!-- Use the table component from the route -->
    <svelte:component
        this={tableComponent}
        props={{
            records: records || [],
            pagination,
            sort,
            loading
        }}
    />
</AdminPageLayout>

