<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import SimpleSidebar from "$lib/components/ui_components_sveltekit/sidebar/SimpleSidebar.svelte";
    import {
        LayoutDashboard,
        Users,
        Settings,
        Building2,
        Key,
        Network,
        MessageCircle,
        Link2,
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
    export let title = "FS Admin";

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
        initialExpanded?: boolean;
    }

    const mainMenuItems: MenuItem[] = [
        { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
        {
            label: "IOT",
            icon: Network,
            initialExpanded: false,
            subItems: [
                { href: "/admin/iot/devices", label: "Devices", icon: Router }
            ]
        },
        { 
            label: "Access", 
            icon: Building2, 
            initialExpanded: false,
            subItems: [
                { href: "/admin/accounts/accounts", label: "Accounts", icon: Layers },
                { href: "/admin/accounts/companies", label: "Companies", icon: Briefcase },
                { href: "/admin/users", label: "Users", icon: Users },
                { href: "/admin/accounts/groups", label: "Groups", icon: UserCog2 }
            ]
        },
        { 
            label: "Integrations", 
            icon: Link2, 
            initialExpanded: false,
            subItems: [
                { href: "/admin/settings/webhook", label: "Webhook", icon: Link2 },
                { href: "/admin/settings/whatsapp/accounts", label: "Whatsapp", icon: MessageCircle }, 
                { href: "/admin/settings/listeners", label: "Listeners", icon: Ear }
            ]
        },
        { 
            label: "Settings", 
            icon: Settings, 
            initialExpanded: true,
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
            initialExpanded: false,
            subItems: [
                { href: "/admin/debug/websocket", label: "WebSocket", icon: Zap }
            ]
        },
    ];

    $: currentPath = $page.url.pathname;
</script>

<div class={cn("bg-spectrio-purple text-white", className)}>
    <SimpleSidebar
        {title}
        items={mainMenuItems}
        initialCollapsed={collapsed}
        on:toggle={(e) => collapsed = e.detail}
    />
</div>
