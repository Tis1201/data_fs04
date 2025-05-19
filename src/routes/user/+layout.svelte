<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import UserSidebar from "$lib/components/user/UserSidebar.svelte";
    import { fly } from "svelte/transition";
    import { LogOut, User } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import EnhancedMenubar from "$lib/components/ui_components_sveltekit/menubar/EnhancedMenubar.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";
    import AccountSelector from "$lib/components/account/AccountSelector.svelte";

    export let data;
    let collapsed = false;
    let showMenu = false;
    
    // Force reactivity with page changes
    $: {
        // This will re-evaluate whenever the page changes
        const path = $page.url.pathname;
        
        // Only reset menu items when navigating away from pages with custom menus
        if (!path.includes('/user/settings') && 
            !path.includes('/user/profile')) {
            topMenuItems.set(null);
        }
    }
</script>

<div class="relative flex h-screen">
    <UserSidebar bind:collapsed />
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
                    <!-- Account Selector Component -->
                    {#if data.accountMemberships && data.accountMemberships.length > 0}
                        <AccountSelector 
                            currentAccount={data.currentAccount} 
                            accountMemberships={data.accountMemberships} 
                        />
                    {/if}
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
                                    href="/user/profile"
                                    class="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100"
                                    role="menuitem"
                                >
                                    <User class="h-4 w-4" />
                                    <span>My Profile</span>
                                </a>
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
