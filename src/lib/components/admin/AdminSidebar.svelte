<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils/ui-utils";
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
        Layers,

        Lock,

        Ticket,

        Logs,

        KeySquare,

        Eye,

        MonitorCheck,

        Film,

        Monitor,

        MonitorPlay,

        Factory,

        File,

        Files,

        Package,

        PackagePlus,

        Database,

        CreditCard,

        IdCard,

        TagIcon,

        ShieldPlus,
        FileCog,
        Pin,

        Book

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
        { 
            href: "/admin/dashboard", 
            label: "Dashboard", 
            icon: LayoutDashboard,
            subItems: [] 
        },
        {
            label: "IOT",
            icon: Network,
            initialExpanded: false,
            subItems: [
                { href: "/admin/iot/factory_tokens", label: "Factory Tokens", icon: Factory },
                { href: "/admin/iot/devices", label: "Devices", icon: Router },
                { href: "/admin/iot/device_tags", label: "Device Tags", icon: TagIcon },
                { href: "/admin/iot/device-profiles", label: "Device Profiles", icon: FileCog },
                { href: "/admin/iot/resources", label: "Resources", icon: Files},
                { href: "/admin/iot/bundles", label: "Bundles", icon: PackagePlus},
                { href: "/admin/iot/preclaims", label: "Preclaims", icon: ShieldPlus },
                { href: "/admin/iot/pin-rules", label: "Pin Rules", icon: Pin }
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
                { href: "/admin/accounts/groups", label: "Groups", icon: UserCog2 },
                { href: "/admin/accounts/hierarchy", label: "Hierarchy", icon: Layers }
            ]
        },
        {
            label: "Billing",
            icon: CreditCard,
            initialExpanded: false,
            subItems: [
                { href: "/admin/billing/licenses", label: "Licenses", icon: IdCard },
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
                
            ]
        },
        { 
            label: "Security", 
            icon: Lock, 
            initialExpanded: true,
            subItems: [
                { href: "/admin/jwt/signing_keys", label: "Signing Keys", icon: Key },
                { href: "/admin/settings/api_keys", label: "API Keys", icon: Key }
            ]
        },
        { 
            label: "JWT", 
            icon: KeySquare, 
            initialExpanded: true,
            subItems: [
                { href: "/admin/jwt/refresh_tokens", label: "Refresh Tokens", icon: Ticket },
                { href: "/admin/jwt/token_logs", label: "Token Logs", icon: Logs },
            ]
        },
        { 
            label: "Vision", 
            icon: MonitorCheck, 
            initialExpanded: true,
            subItems: [
                { href: "/admin/vision/streams", label: "Streams", icon: MonitorPlay },
                { href: "/admin/vision/preview", label: "Preview", icon: Film },
            ]
        },
        { 
            href: "/admin/monitor", 
            label: "Monitor", 
            icon: Activity,
            subItems: [] 
        },
        
        {
            label: "Debug",
            icon: BugOff,
            initialExpanded: false,
            subItems: [
                { href: "/admin/debug/sse", label: "SSE", icon: Zap },
                { href: "/admin/debug/messaging", label: "Messaging", icon: MessageCircle },
                { href: "/admin/debug/redis", label: "Redis", icon: Database },
                { href: "/admin/debug/dashboard/superset", label: "Superset", icon: Book },
                
                // { href: "/admin/debug/websocket", label: "WebSocket", icon: Zap }
            ]
        },
    ];

    $: currentPath = $page.url.pathname;
    $: pathKey = currentPath; // Force reactivity when path changes
</script>

<div class={cn("bg-spectrio-purple text-white", className)}>
    <SimpleSidebar
        {title}
        items={mainMenuItems}
        initialCollapsed={collapsed}
        on:toggle={(e) => collapsed = e.detail}
    />
</div>
