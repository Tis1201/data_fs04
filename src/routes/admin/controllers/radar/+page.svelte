<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import RadarSensorsTable from "./table.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    $: tableProps = {
        records: data.radarSensors || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0,
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: data.sort?.order || "desc",
        },
        loading: false,
        filters: {
            accounts: data.accounts || [],
        },
    };

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        "Radar",
    ];
</script>

<AdminPageLayout
    title="Radar Controllers"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Register Controller",
            icon: Plus,
            onClick: () => goto("/admin/controllers/radar/new"),
        },
    ]}
>
    <RadarSensorsTable props={tableProps} />
</AdminPageLayout>
