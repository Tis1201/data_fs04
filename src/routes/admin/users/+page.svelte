<script lang="ts">
    import { Plus, UserPlus, FileText, Download, Upload, Settings } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { topMenuItems } from "$lib/stores/menuStore";
    import type { PageData } from "./$types";
    import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";
    import UserTable from "./table.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    // Create props for the users table
    $: tableProps = {
        records: data.users || [],
        pagination: getDefaultPagination(data.meta, 10),
        sort: getDefaultSort(data.meta, "createdAt", "desc"),
        loading: false
    };
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"]
    ];

    // Define menu items for the top bar
    const menuItems = [
        {
            label: 'Users',
            icon: UserPlus,
            items: [
                { 
                    label: 'All Users', 
                    icon: UserPlus, 
                    action: () => true
                },
                { separator: true },
                { 
                    label: 'New User', 
                    icon: Plus, 
                    action: () => {
                        goto('/admin/users/new');
                        return true;
                    }
                },
                { separator: true },
                { 
                    label: 'Export Users', 
                    icon: Download
                },
                { 
                    label: 'Import Users', 
                    icon: Upload
                }
            ]
        },
        {
            label: 'Management',
            icon: Settings,
            items: [
                { 
                    label: 'User Groups', 
                    icon: FileText
                },
                { 
                    label: 'Permissions', 
                    icon: Settings
                }
            ]
        }
    ];

    // Set menu items on mount
    onMount(() => {
        topMenuItems.set({
            items: menuItems,
            activeItem: 'Users'
        });
        
        return () => {
            topMenuItems.set(null);
        };
    });
</script>

<AdminPageLayout
    title="Users"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add User",
            icon: Plus,
            onClick: () => goto('/admin/users/new')
        }
    ]}
>
    <UserTable props={tableProps} />
</AdminPageLayout>
