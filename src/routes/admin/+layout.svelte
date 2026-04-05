<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
    import { fly } from "svelte/transition";
    import { LogOut, FileText, UserPlus, Download, Upload, Settings } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import EnhancedMenubar from "$lib/components/ui_components_sveltekit/menubar/EnhancedMenubar.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";

    export let data;
    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    export let params: Record<string, string> = {};
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
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-900 dark:text-purple-100 bg-purple-50 dark:bg-purple-900/60 rounded-md border border-purple-200 dark:border-purple-700 shadow-sm hover:shadow transition-all duration-200 group">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-purple-600 dark:text-purple-300 group-hover:scale-110 transition-transform">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        <span class="font-semibold">Admin</span>
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
        <main class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
            <slot />
        </main>
    </div>
</div>
