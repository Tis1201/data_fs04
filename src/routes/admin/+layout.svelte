<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
    import { fly } from "svelte/transition";
    import { LogOut, FileText, UserPlus, Download, Upload, Settings } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import SimpleMenubar from "$lib/components/ui_components_sveltekit/menubar/SimpleMenubar.svelte";
    import EnhancedMenubar from "$lib/components/ui_components_sveltekit/menubar/EnhancedMenubar.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";

    export let data;
    let collapsed = false;
    let showMenu = false;
    
    // We no longer need to determine which menubar to show based on the path
    // as all sections will use the store-based approach
    
    // Force reactivity with page changes
    $: {
        // This will re-evaluate whenever the page changes
        const path = $page.url.pathname;
        
        // Only reset menu items when navigating away from pages with custom menus
        if (!path.includes('/admin/settings/general') && 
            !path.includes('/admin/users')) {
            topMenuItems.set(null);
        }
    }
    
    // No need for event listeners with slots
</script>

<div class="relative flex h-screen">
    <AdminSidebar bind:collapsed />
    <div class="flex-1 flex flex-col">
        <header class="border-b">
            <div class="relative flex h-12 items-center px-4 gap-4">
                <div class="flex-1">
                    {#if $topMenuItems}
                        <EnhancedMenubar 
                            items={$topMenuItems.items || []} 
                            activeItem={$topMenuItems.activeItem || null} 
                        />
                    {/if}
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                        <svg class="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10a1 1 0 01-1.64 0l-7-10A1 1 0 014 7h4V2a1 1 0 01.7-.954l3 1z" clip-rule="evenodd" />
                        </svg>
                        <span>Admin</span>
                    </div>
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
