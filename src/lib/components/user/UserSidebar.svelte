<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import SimpleSidebar from "$lib/components/ui_components_sveltekit/sidebar/SimpleSidebar.svelte";
    import {
        LayoutDashboard,
        Settings,
        User,
        Bell,
        MessageSquare,
        Video,
        FileText,
        Calendar,
        HelpCircle,
        Activity,

        Network,

        Router,

        Users2,

        Logs,

        LucideActivity,

        ActivitySquare,

        File,

        Files,

        Building2









    } from "lucide-svelte";

    export let className = "";
    export let collapsed = false;
    export let title = "FS User";

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
            href: "/user/dashboard", 
            label: "Dashboard", 
            icon: LayoutDashboard,
            subItems: [] 
        },
        
        {
            label: "IOT",
            icon: Network,
            initialExpanded: false,
            subItems: [
                { href: "/user/iot/devices", label: "Devices", icon: Router }
            ]
        },
        // { 
        //     label: "Communications", 
        //     icon: MessageSquare, 
        //     initialExpanded: false,
        //     subItems: [
        //         { href: "/user/communications/messages", label: "Messages", icon: MessageSquare },
        //         { href: "/user/communications/notifications", label: "Notifications", icon: Bell }
        //     ]
        // },
        // { 
        //     href: "/user/calendar", 
        //     label: "Calendar", 
        //     icon: Calendar,
        //     subItems: [] 
        // },
        // { 
        //     href: "/user/documents", 
        //     label: "Documents", 
        //     icon: FileText,
        //     subItems: [] 
        // },
        { 
            label: "Analytics", 
            icon: ActivitySquare, 
            initialExpanded: false,
            subItems: [
                { href: "/user/analytics/logs", label: "Logs", icon: Logs },
            ]
        },
        { 
            label: "Resources", 
            icon: Files, 
            initialExpanded: false,
            subItems: [
                { href: "/user/settings/files", label: "Files", icon: File },
            ]
        },
         { 
            label: "Settings", 
            icon: Settings, 
            initialExpanded: false,
            subItems: [
                { href: "/user/settings/account", label: "Account", icon: Building2 },
                { href: "/user/settings/users", label: "Users", icon: Users2 },
                { href: "/user/profile", label: "Profile", icon: User },
                
            ]
        },
        { 
            href: "/user/support", 
            label: "Help & Support", 
            icon: HelpCircle,
            subItems: [] 
        },
    ];

    $: currentPath = $page.url.pathname;
    $: pathKey = currentPath; // Force reactivity when path changes
</script>

<div class={cn("bg-blue-700 text-white", className)}>
    <SimpleSidebar
        {title}
        items={mainMenuItems}
        initialCollapsed={collapsed}
        on:toggle={(e) => collapsed = e.detail}
    />
</div>
