<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import RadarSensorsTable from "./table.svelte";
    import { canCreate, canDelete } from "$lib/utils/permissions";
    import type { PageData } from "./$types";

    export let data: PageData;

    // Check permissions for buttons
    $: showCreateButton = canCreate(
        data.modulePermissions,
        'ADMIN_CONTROLLERS_RADAR',
        data.user?.systemRole
    );

    $: showDeleteButton = canDelete(
        data.modulePermissions,
        'ADMIN_CONTROLLERS_RADAR',
        data.user?.systemRole
    );

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
        // Pass permission to table for delete button
        canDelete: showDeleteButton,
    };

    // Conditional action buttons based on permissions
    $: actionButtons = showCreateButton ? [
        {
            label: "Register Controller",
            icon: Plus,
            onClick: () => goto("/admin/controllers/radar/new"),
        },
    ] : [];

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        "Radar",
    ];
</script>

<AdminPageLayout
    title="Radar Controllers"
    crumbs={pageCrumbs}
    {actionButtons}
>
    <RadarSensorsTable props={tableProps} />
</AdminPageLayout>
