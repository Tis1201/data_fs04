<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import { Button } from "$lib/components/ui/button";
    import {
        LayoutDashboard,
        Users,
        Settings,
        Menu,
        ChevronLeft,
        ChevronRight,
        Building2,
        Key,
        Bell,
        Cctv,
        Cpu,
        Building,
        LayoutGrid,
        Codepen,
        Cable,
        BugOff,
        Target,
        Video,
        Radio,
        Tv,
        Activity,
        Zap,

        Network,

        MessageCircle,

        User,

        Link,

        ArrowRight,

        Link2,

        Link2Icon,

        Mail,

        Settings2,

        Signal,

        BellDot,

        CloudLightning,

        CloudAlert,

        Ear,

        EarIcon,

        DoorOpen
















    } from "lucide-svelte";

    export let className = "";
    export let collapsed = false;
    export let onCollapse = () => {};

    let showContent = !collapsed;
    
    // Handle content visibility after width transition
    function handleTransitionEnd(e: TransitionEvent) {
        if (e.propertyName === 'width') {
            showContent = !collapsed;
        }
    }

    $: if (collapsed) {
        showContent = false;
    }

    interface SubMenuItem {
        href: string;
        label: string;
        icon?: any;
    }

    interface MenuItem {
        href?: string;
        label: string;
        icon: any;
        subItems?: SubMenuItem[];
    }

    const mainMenuItems: MenuItem[] = [
        { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
        // { href: "/admin/streams", label: "Streams", icon: Cctv },
        // { href: "/admin/apps", label: "Apps", icon: Codepen },
        // { href: "/admin/connections", label: "Connections", icon: Cable },
        // { href: "/admin/screens", label: "Screens", icon: Tv },
        // { href: "/admin/mosaic", label: "Mosaic", icon: LayoutGrid },
        {
            label: "Debug",
            icon: BugOff,
            subItems: [
                // { href: "/admin/debug/vpu", label: "VPU", icon: Video },
                // { href: "/admin/debug/npu", label: "NPU", icon: Cpu },
                { href: "/admin/debug/room", label: "Room", icon: DoorOpen },
                { href: "/admin/debug/sse", label: "SSE", icon: BellDot },
                { href: "/admin/debug/websocket", label: "WebSocket", icon: Zap },
                { href: "/admin/debug/stream", label: "WebRTC", icon: Network },
                // { href: "/admin/debug/whatsapp", label: "Whatsapp", icon: MessageCircle },
            ],
        },
        
        { label: "Settings", icon: Settings, 
            subItems: [
                { href: "/admin/settings/general", label: "General", icon: Settings2 },
                { href: "/admin/users", label: "Users", icon: Users },
                { href: "/admin/settings/email", label: "Email", icon: Mail },
                { href: "/admin/settings/api_keys", label: "API Keys", icon: Key },
                { href: "/admin/settings/webhook", label: "Webhook", icon: Link2Icon },
                { href: "/admin/settings/whatsapp/accounts", label: "Whatsapp", icon: MessageCircle }, 
                { href: "/admin/settings/listeners", label: "Listeners", icon: Ear },    
            ],  
        },
        { href: "/admin/monitor", label: "Monitor", icon: Activity },
    ];

    $: currentPath = $page.url.pathname;
    $: isActive = (href: string) => {
        if (href === "/admin/dashboard") {
            return currentPath === "/admin/dashboard" || currentPath === "/admin/dashboard/";
        }
        return currentPath.startsWith(href + "/") || currentPath === href;
    };
</script>

<aside
    class={cn(
        "relative flex flex-col border-r bg-spectrio-purple text-white transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[240px]",
        className
    )}
    on:transitionend={handleTransitionEnd}
>
    <!-- Header -->
    <div class="flex h-16 flex-col justify-center px-3 relative overflow-hidden">
        <div class="flex flex-col items-center gap-2">
            {#if collapsed}
                <button
                    class="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:text-white transition-colors"
                    on:click={onCollapse}
                >
                    <ChevronRight class="h-4 w-4" />
                </button>
            {:else}
                <div class="relative w-full">
                    <span class="text-base font-medium">FS Admin</span>
                    <button
                        class="group absolute right-0 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 transition-colors"
                        on:click={onCollapse}
                        title="Collapse sidebar"
                    >
                        <div class="flex items-center gap-1 text-white">
                            <ChevronLeft class="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                        </div>
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Navigation -->
    <div class="flex-1 overflow-y-auto px-3">
        <nav class="flex flex-col gap-3">
            <div class="flex flex-col gap-0.5">
                {#each mainMenuItems as item}
                    {#if item.href}
                        <a
                            href={item.href}
                            class={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-1.5 text-white/60 transition-colors hover:text-white text-sm",
                                isActive(item.href) && "bg-white/10 text-white"
                            )}
                        >
                            <svelte:component
                                this={item.icon}
                                class={cn("h-4 w-4", collapsed && "mx-auto")}
                            />
                            {#if !collapsed}
                                <span>{item.label}</span>
                            {/if}
                        </a>
                    {:else if item.subItems}
                        <div class="flex flex-col gap-0.5">
                            <div class="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-white/60">
                                <svelte:component this={item.icon} class="h-4 w-4" />
                                {#if !collapsed}
                                    <span>{item.label}</span>
                                {/if}
                            </div>
                            {#if !collapsed}
                                <div class="flex flex-col gap-0.5 pl-6">
                                    {#each item.subItems as subItem}
                                        <a
                                            href={subItem.href}
                                            class={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-1.5 text-white/60 transition-colors hover:text-white text-sm",
                                                isActive(subItem.href) && "bg-white/10 text-white"
                                            )}
                                        >
                                            {#if subItem.icon}
                                                <svelte:component this={subItem.icon} class="h-4 w-4" />
                                            {/if}
                                            <span>{subItem.label}</span>
                                        </a>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
        </nav>
    </div>
</aside>
