<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import * as Sidebar from "$lib/components/ui_components_sveltekit/sidebar";
    import {
        LayoutDashboard,
        Users,
        Settings,
        ChevronLeft,
        ChevronRight,
        Building2,
        Key,
        Network,
        MessageCircle,
        Link2,
        Link2Icon,
        Mail,
        Settings2,
        Ear,
        Router,
        UserCog2,
        Briefcase,
        Activity,
        BugOff,
        Zap,
        Layers
    } from "lucide-svelte";

    export let className = "";
    export let collapsed = false;
    export let onCollapse = () => {};

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
        {
            label: "IOT",
            icon: Network,
            subItems: [
                { href: "/admin/iot/devices", label: "Devices", icon: Router }
            ]
        },
        { 
            label: "Accounts", 
            icon: Building2, 
            subItems: [
                { href: "/admin/accounts", label: "Accounts", icon: Layers },
                { href: "/admin/companies", label: "Companies", icon: Briefcase },
                { href: "/admin/users", label: "Users", icon: Users },
                { href: "/admin/groups", label: "Groups", icon: UserCog2 }
            ]
        },
        { 
            label: "Integrations", 
            icon: Link2, 
            subItems: [
                { href: "/admin/settings/webhook", label: "Webhook", icon: Link2Icon },
                { href: "/admin/settings/whatsapp/accounts", label: "Whatsapp", icon: MessageCircle }, 
                { href: "/admin/settings/listeners", label: "Listeners", icon: Ear }
            ]
        },
        { 
            label: "Settings", 
            icon: Settings, 
            subItems: [
                { href: "/admin/settings/general", label: "General", icon: Settings2 },
                { href: "/admin/settings/email", label: "Email", icon: Mail },
                { href: "/admin/settings/api_keys", label: "API Keys", icon: Key }
            ]
        },
        { href: "/admin/monitor", label: "Monitor", icon: Activity },
        {
            label: "Debug",
            icon: BugOff,
            subItems: [
                { href: "/admin/debug/websocket", label: "WebSocket", icon: Zap }
            ]
        },
    ];

    $: currentPath = $page.url.pathname;
    $: isActive = (href: string) => {
        if (href === "/admin/dashboard") {
            return currentPath === "/admin/dashboard" || currentPath === "/admin/dashboard/";
        }
        return currentPath.startsWith(href + "/") || currentPath === href;
    };
</script>

<div 
    class={cn(
        "relative flex flex-col border-r bg-spectrio-purple text-white transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[240px]",
        className
    )}
>
    <!-- Header -->
    <Sidebar.Header class="border-none">
        <div class="flex items-center justify-between">
            {#if !collapsed}
                <span class="text-base font-medium">FS Admin</span>
            {/if}
            <button
                class={cn(
                    collapsed 
                        ? "flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:text-white transition-colors" 
                        : "group flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 transition-colors"
                )}
                on:click={onCollapse}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {#if collapsed}
                    <ChevronRight class="h-4 w-4" />
                {:else}
                    <ChevronLeft class="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                {/if}
            </button>
        </div>
    </Sidebar.Header>

    <!-- Navigation -->
    <Sidebar.Content>
        <Sidebar.MenuItems 
            items={mainMenuItems} 
            {collapsed} 
            {isActive} 
        />
    </Sidebar.Content>
</div>
