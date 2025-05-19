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
        Activity
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
            href: "/user/profile", 
            label: "My Profile", 
            icon: User,
            subItems: [] 
        },
        {
            label: "Media",
            icon: Video,
            initialExpanded: false,
            subItems: [
                { href: "/user/media/videos", label: "Videos", icon: Video },
                { href: "/user/media/streams", label: "Live Streams", icon: Activity }
            ]
        },
        { 
            label: "Communications", 
            icon: MessageSquare, 
            initialExpanded: false,
            subItems: [
                { href: "/user/communications/messages", label: "Messages", icon: MessageSquare },
                { href: "/user/communications/notifications", label: "Notifications", icon: Bell }
            ]
        },
        { 
            href: "/user/calendar", 
            label: "Calendar", 
            icon: Calendar,
            subItems: [] 
        },
        { 
            href: "/user/documents", 
            label: "Documents", 
            icon: FileText,
            subItems: [] 
        },
        { 
            href: "/user/settings", 
            label: "Settings", 
            icon: Settings,
            subItems: [] 
        },
        { 
            href: "/user/help", 
            label: "Help & Support", 
            icon: HelpCircle,
            subItems: [] 
        }
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
