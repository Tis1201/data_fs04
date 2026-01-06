<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils/ui-utils";
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
        Building2,
        MessageCircle,
        ClipboardList,
        ShieldPlus,
        Package2,
        TagIcon,
        Radio,
        BugOff,
        CreditCard,
    } from "lucide-svelte";

    export let className = "";
    export let collapsed = false;
    export let title = "FS User";
    
    // Module permissions from layout data
    // Empty object for ADMIN (has all), populated for regular users
    export let modulePermissions: Record<string, string[]> = {};
    
    // User's system role - ADMIN bypasses permission checks
    export let userSystemRole: string = "USER";

    interface SubMenuItem {
        href: string;
        label: string;
        icon?: any;
        module?: string; // Module required to view this item
    }

    interface MenuItem {
        href?: string;
        label: string;
        icon: any;
        subItems?: SubMenuItem[];
        initialExpanded?: boolean;
        module?: string; // Module required to view this item
        alwaysShow?: boolean; // Always show regardless of permissions
    }

    // Mapping from menu paths to required modules (ONLY for modules in current ACL scope)
    // Current scope: Only USER_CONTROLLERS_RADAR
    const menuModuleMap: Record<string, string> = {
        '/user/controllers/radar': 'USER_CONTROLLERS_RADAR',
        // Other modules will be added when they are in scope
    };

    // Check if user has permission to view a module
    // Only checks permissions for modules in current ACL scope
    function hasModuleAccess(module: string | undefined): boolean {
        // No module requirement = always show
        if (!module) return true;
        
        // ADMIN always has access
        if (userSystemRole === 'ADMIN') return true;
        
        // Special modules that are always accessible
        if (module === 'USER_PROFILE' || module === 'USER_SUPPORT') return true;
        
        // Only check permissions for modules in current ACL scope
        // Current scope: Only USER_CONTROLLERS_RADAR
        if (module !== 'USER_CONTROLLERS_RADAR') {
            // For modules not in scope, always show (no ACL check)
            return true;
        }
        
        // Check if user has VIEW permission for this module
        const permissions = modulePermissions[module];
        return permissions && permissions.includes('VIEW');
    }

    // Filter sub-items based on permissions
    function filterSubItems(subItems: SubMenuItem[] | undefined): SubMenuItem[] {
        if (!subItems) return [];
        
        return subItems.filter(item => {
            const module = menuModuleMap[item.href] || item.module;
            return hasModuleAccess(module);
        });
    }

    // All menu items definition
    // Only USER_CONTROLLERS_RADAR has module permission check (current ACL scope)
    const allMenuItems: MenuItem[] = [
        {
            href: "/user/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            subItems: [],
        },

        {
            label: "IOT",
            icon: Network,
            initialExpanded: false,
            subItems: [
                { href: "/user/iot/devices", label: "Devices", icon: Router },
                {
                    href: "/user/iot/device_tags",
                    label: "Device Tags",
                    icon: TagIcon,
                },
                {
                    href: "/user/iot/device-profiles",
                    label: "Device Profiles",
                    icon: TagIcon,
                },
                { href: "/user/iot/bundles", label: "Bundles", icon: Package2 },
                {
                    href: "/user/iot/preclaims",
                    label: "Preclaims",
                    icon: ShieldPlus,
                },
                {
                    href: "/user/iot/pin-rules",
                    label: "Pin Rules",
                    icon: Settings,
                },
            ],
        },
        {
            label: "Controllers",
            icon: Radio,
            initialExpanded: false,
            subItems: [
                { href: "/user/controllers/radar", label: "Radar", icon: Radio, module: 'USER_CONTROLLERS_RADAR' }
            ],
        },
        {
            label: "Analytics",
            icon: ActivitySquare,
            initialExpanded: false,
            subItems: [
                {
                    href: "/user/analytics/chat",
                    label: "Ask AI",
                    icon: MessageSquare,
                },
                { href: "/user/analytics/radar", label: "Radar", icon: Radio },
            ],
        },
        {
            label: "Resources",
            icon: Files,
            initialExpanded: false,
            subItems: [{ href: "/user/resources", label: "Files", icon: File }],
        },
        {
            label: "Settings",
            icon: Settings,
            initialExpanded: false,
            subItems: [
                {
                    href: "/user/settings/account",
                    label: "Account",
                    icon: Building2,
                },
                { href: "/user/settings/users", label: "Users", icon: Users2 },
                { href: "/user/profile", label: "Profile", icon: User },
            ],
        },
        {
            label: "Billing",
            icon: CreditCard,
            initialExpanded: false,
            subItems: [
                {
                    href: "/user/settings/billing",
                    label: "Plans",
                    icon: CreditCard,
                },
                {
                    href: "/user/billing/invoices",
                    label: "Invoices",
                    icon: FileText,
                },
            ],
        },
        {
            label: "Debug",
            icon: BugOff,
            initialExpanded: false,
            subItems: [
                {
                    href: "/user/debug/audit-logs",
                    label: "Audit Logs",
                    icon: FileText
                },
            ],
        },
    ];

    // Reactive: Filter menu items based on permissions
    $: filteredMenuItems = allMenuItems
        .map(item => {
            // For items with subItems, filter the subItems
            if (item.subItems && item.subItems.length > 0) {
                const filteredSubs = filterSubItems(item.subItems);
                // Only include parent if it has visible children
                if (filteredSubs.length === 0) return null;
                return { ...item, subItems: filteredSubs };
            }
            
            // For items with direct href, check permission
            if (item.href) {
                const module = menuModuleMap[item.href] || item.module;
                if (!hasModuleAccess(module)) return null;
            }
            
            return item;
        })
        .filter((item): item is MenuItem => item !== null);

    $: currentPath = $page.url.pathname;
    $: pathKey = currentPath; // Force reactivity when path changes
</script>

<div class={cn("bg-blue-700 text-white", className)}>
    <SimpleSidebar
        {title}
        items={filteredMenuItems}
        initialCollapsed={collapsed}
        on:toggle={(e) => (collapsed = e.detail)}
    />
</div>
