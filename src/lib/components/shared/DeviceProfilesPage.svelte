<script lang="ts">
    import { Plus } from "lucide-svelte";
    // PageData type will be passed from the parent component
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import DeviceProfilesTable from "./DeviceProfilesTable.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Props
    export let data: any;
    export let context: 'admin' | 'user' = 'admin';
    export let title: string = 'Device Profiles';
    export let breadcrumbs: [string, string | null][];

    $: records = data.profiles || [];
    $: meta = data.meta || { total: 0, page: 1, per_page: 10, total_pages: 0, sort_field: 'createdAt', sort_order: 'desc' };
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    $: props = { records, pagination, sort, loading };
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Get the correct paths based on context
    $: basePath = context === 'admin' ? '/admin/iot' : '/user/iot';
    $: newProfilePath = `${basePath}/device-profiles/new`;
</script>

<PageContainer crumbs={breadcrumbs}>
    <PageHeader {title}>
        <svelte:fragment slot="action">
            <ActionButton
                label="Create Profile"
                icon={Plus}
                onClick={() => goto(newProfilePath)}
            />
        </svelte:fragment>
    </PageHeader>

    <DeviceProfilesTable {props} {context} />
</PageContainer>
