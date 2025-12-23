<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import RadarControllersTable from "./table.svelte";
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
    };

    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Controllers", "/user/controllers"],
        "Radar",
    ];
</script>

<UserPageLayout
    title="Radar Controllers"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Register Controller",
            icon: Plus,
            onClick: () => goto("/user/controllers/radar/new"),
        },
    ]}
>
    <RadarControllersTable props={tableProps} />
</UserPageLayout>
