<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import JwtSigningKeysTable from "./table.svelte";
    import type { PageData } from "./$types";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the JWT signing keys table
    $: tableProps = {
        records: data.jwtSigningKeys || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: data.sort?.order || "desc"
        },
        loading: false,
        filters: {
            keyTypeOptions: data.keyTypeOptions || [],
            keyTypes: data.filters?.keyTypes || [],
            isActive: data.filters?.isActive || ''
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["JWT", "/admin/jwt"],
        "Signing Keys"
    ];
</script>

<AdminPageLayout
    title="JWT Signing Keys"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Key",
            icon: Plus,
            onClick: () => goto('/admin/jwt/signing_keys/new')
        }
    ]}
>
    <JwtSigningKeysTable props={tableProps} />
</AdminPageLayout>
