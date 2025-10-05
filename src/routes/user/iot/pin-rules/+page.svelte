<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import type { PageData } from './$types';
    import PinRuleTable from "./table.svelte";
    import { getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";

    export let data: PageData;

    // Create props for the pin rules table
    $: tableProps = {
        records: (data.rules || []) as any[],
        pagination: getDefaultPagination(data.meta, 10),
        sort: getDefaultSort(data.meta, "createdAt", "desc"),
        loading: false
    };
</script>

<AdminPageLayout
    title="Pin Rules"
    crumbs={[['User', '/user'], ['IoT', '/user/iot'], ['Pin Rules', '/user/iot/pin-rules']]}
    actionButtons={[{ label: 'Add Pin Rule', icon: Plus, onClick: () => goto('/user/iot/pin-rules/new') }]}
>
    <PinRuleTable props={tableProps} currentUserId={data.user?.id} accountRole={data.accountRole} />
</AdminPageLayout>
