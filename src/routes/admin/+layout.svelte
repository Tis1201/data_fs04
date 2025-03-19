<script lang="ts">
    import { page } from "$app/stores";
    import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
    import { fly } from "svelte/transition";
    import { LogOut } from "lucide-svelte";

    export let data;
    let collapsed = false;
    let showMenu = false;
</script>

<div class="relative flex h-screen">
    <AdminSidebar bind:collapsed />
    <div class="flex-1 flex flex-col">
        <header class="border-b">
            <div class="flex h-12 items-center px-4 gap-4">
                <div class="flex-1" />
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
        <main class="flex-1 p-2">
            <slot />
        </main>
    </div>
</div>
