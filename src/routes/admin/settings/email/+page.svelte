<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import EmailProvidersTable from "./table.svelte";
    import type { PageData } from "./$types";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the email providers table
    $: tableProps = {
        records: data.emailProviders || [],
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
            providerTypes: data.providerTypes || [],
            types: data.filters?.types || [],
            isActive: data.filters?.isActive || ''
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        "Email"
    ];
</script>

<AdminPageLayout
    title="Email Providers"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Provider",
            icon: Plus,
            onClick: () => goto('/admin/settings/email/new')
        }
    ]}
>
    <EmailProvidersTable props={tableProps} />
</AdminPageLayout>
