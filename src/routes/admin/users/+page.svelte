<script lang="ts">
    import UserTable from "./table.svelte";
    import { Plus, UserPlus, FileText, Download, Upload, Settings } from "lucide-svelte";
    import { onMount, onDestroy } from "svelte";
    import { topMenuItems } from "$lib/stores/menuStore";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ users: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    
    let loading = false;
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);
    
    // Define menu items for the users section
    const menuItems = [
        {
            label: 'Users',
            icon: UserPlus,
            items: [
                { 
                    label: 'All Users', 
                    icon: UserPlus, 
                    action: () => {
                        // Default action for main page
                        return true;
                    }
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
    
    // Set menu items for the top bar immediately
    topMenuItems.set({
        items: menuItems,
        activeItem: 'Users'
    });
    
    // Set again in onMount to ensure it works after client-side navigation
    onMount(() => {
        topMenuItems.set({
            items: menuItems,
            activeItem: 'Users'
        });
        
        // Clean up when component is destroyed
        return () => {
            topMenuItems.set(null);
        };
    });
    
    // Also set on page change
    import { page } from "$app/stores";
    $: if ($page.url.pathname.includes('/admin/users') && !$page.url.pathname.includes('/admin/users/[')) {
        topMenuItems.set({
            items: menuItems,
            activeItem: 'Users'
        });
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        "Users"
    ];
</script>



<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Users">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add User"
                icon={Plus}
                onClick={() => goto('/admin/users/new')}
            />
        </svelte:fragment>
    </PageHeader>

    <UserTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
    />
</PageContainer>
