<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { ComponentType } from 'svelte';

    /**
     * Props for PinRuleListPage component
     */
    export let data: any; // PageData from route (rules, meta, user, accountRole)
    export let breadcrumbs: [string, string][];
    export let baseUrl: string; // "/admin/iot/pin-rules" or "/user/iot/pin-rules"
    export let newPinRulePath: string; // "/admin/iot/pin-rules/new" or "/user/iot/pin-rules/new"
    export let title: string = "Pin Rules";
    export let context: 'admin' | 'user' = 'admin';
    export let tableComponent: ComponentType; // The table component to use (from route)
    export let currentUserId: string | undefined = undefined; // For user routes
    export let accountRole: string | undefined = undefined; // For user routes

    $: ({ rules: records, meta } = data as any);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");

    let loading = false;

    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
</script>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Add Pin Rule",
            icon: Plus,
            onClick: () => goto(newPinRulePath)
        }
    ]}
>
    <!-- Use the table component from the route -->
    <svelte:component
        this={tableComponent}
        props={{
            records: records || [],
            pagination,
            sort,
            loading,
            ...(context === 'user' ? { currentUserId, accountRole } : {})
        }}
    />
</AdminPageLayout>

