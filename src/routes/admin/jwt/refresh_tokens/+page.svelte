<script lang="ts">
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import RefreshTokensTable from "./table.svelte";
    import type { PageData } from "./$types";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the refresh tokens table
    $: tableProps = {
        records: data.refreshTokens || [],
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
            accounts: data.accounts || [],
            users: data.users || [],
            isRevoked: data.filters?.isRevoked || '',
            accountId: data.filters?.accountId || '',
            userId: data.filters?.userId || ''
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["JWT", "/admin/jwt"],
        "Refresh Tokens"
    ];
</script>

<AdminPageLayout
    title="JWT Refresh Tokens"
    crumbs={pageCrumbs}
>
    <RefreshTokensTable props={tableProps} />
</AdminPageLayout>
