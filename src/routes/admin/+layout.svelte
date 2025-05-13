<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
    import { fly } from "svelte/transition";
    import { LogOut, FileText, UserPlus, Download, Upload, Settings } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import SimpleMenubar from "$lib/components/ui_components_sveltekit/menubar/SimpleMenubar.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";

    export let data;
    let collapsed = false;
    let showMenu = false;
    
    // Determine which menubar to show based on the current path
    $: currentPath = $page.url.pathname;
    $: showUsersMenubar = currentPath.startsWith('/admin/users');
    
    // Force reactivity with page changes
    $: {
        // This will re-evaluate whenever the page changes
        const path = $page.url.pathname;
        
        // Only reset menu items when navigating away from settings
        if (!path.includes('/admin/settings/general')) {
            topMenuItems.set(null);
        }
    }
    
    // Define menu items for different sections
    const usersMenuItems = [
        {
            label: 'Users',
            icon: UserPlus,
            items: [
                { label: 'New User', icon: UserPlus, action: () => goto('/admin/users/new') },
                { separator: true },
                { label: 'View Reports', icon: FileText },
                { separator: true },
                { label: 'Export Users', icon: Download },
                { label: 'Import Users', icon: Upload }
            ]
        },
        {
            label: 'Options',
            icon: Settings,
            items: [
                { label: 'User Settings', icon: Settings }
            ]
        }
    ];
    
    // No need for event listeners with slots
</script>

<div class="relative flex h-screen">
    <AdminSidebar bind:collapsed />
    <div class="flex-1 flex flex-col">
        <header class="border-b">
            <div class="relative flex h-12 items-center px-4 gap-4">
                <div class="flex-1">
                    {#if $topMenuItems}
                        <SimpleMenubar items={$topMenuItems} on:select />
                    {:else if showUsersMenubar}
                        <SimpleMenubar items={usersMenuItems} />
                    {/if}
                </div>
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <button
                            type="button"
                            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
                            on:click={() => showMenu = !showMenu}
                        >
                            <span class="text-sm font-medium">
                                {data.user?.email?.[0]?.toUpperCase() ?? "U"}
                            </span>
                        </button>
                        
                        {#if showMenu}
                        <div 
                            class="absolute right-0 top-full mt-1 w-56 rounded-md border bg-white shadow-lg"
                            transition:fly={{ y: -5, duration: 150 }}
                            role="menu"
                            tabindex="0"
                            on:mouseleave={() => showMenu = false}
                        >
                            <div class="p-2">
                                <div class="px-2 py-1.5">
                                    <div class="text-sm font-medium leading-none">
                                        {data.user?.email}
                                    </div>
                                </div>
                                <div class="h-px my-1 bg-gray-200" />
                                <a 
                                    href="/auth/logout"
                                    class="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100"
                                    role="menuitem"
                                >
                                    <LogOut class="h-4 w-4" />
                                    <span>Log out</span>
                                </a>
                            </div>
                        </div>
                        {/if}
                    </div>
                </div>
            </div>
        </header>
        <main class="flex-1 p-2 overflow-y-auto">
            <slot />
        </main>
    </div>
</div>
