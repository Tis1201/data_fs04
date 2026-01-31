<script lang="ts">
    import { page } from "$app/stores";
    import { createEventDispatcher } from 'svelte';
    import { Sidebar, type NavItem } from '$lib/design-system/components';
    import AlertToastContainer from '$lib/components/AlertToastContainer.svelte';
    import { TopNavigation } from '$lib/design-system/components';
    import type { TopNavStyle, UserInfo } from '$lib/design-system/components';
    import AccountSelector from "$lib/components/account/AccountSelector.svelte";
    import { goto } from "$app/navigation";
    
    // Import Design System Tokens - CRITICAL for design system to work
    import "$lib/design-system/tokens/index.css";
    import {
        LayoutGrid,
        Settings,
        CircleHelp,
        Globe,
        LayoutList,
        Box,
        Radio

    } from "lucide-svelte";

    export let data;

    const dispatch = createEventDispatcher();

    // Sidebar state
    let sidebarExpanded = true;

    // Module permissions from layout data
    const modulePermissions: Record<string, string[]> = data.modulePermissions || {};
    const userSystemRole: string = data.user?.systemRole || 'USER';

    // Main navigation items matching Figma design
    const mainNavItems: NavItem[] = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutGrid,
            href: '/user/dashboard'
        },
        {
            id: 'devices',
            label: 'Devices',
            icon: LayoutList,
            children: [
                // New module not designed yet - leads to separate route (will 404)
                { id: 'device-listing', label: 'Device Listing', href: '/user/devices/listing' },
                { id: 'tags', label: 'Tags', href: '/user/devices/tags' }
            ]
        },
        {
            id: 'organization',
            label: 'Organization',
            icon: Globe,
            href: '/user/settings/account',
            dividerAfter: true
        },
        // RDM Management Section
        {
            id: 'rdm-management',
            label: 'RDM Management',
            icon: Box,
            children: [
                { id: 'rdm-devices', label: 'Devices', href: '/user/iot/devices' },
                { id: 'bulk-deployment', label: 'Bulk Deployment', href: '/user/iot/bundles' },
                { id: 'applications', label: 'Application & Resources', href: '/user/resources' },
                { id: 'pre-enrollment', label: 'Pre-Enrollment', href: '/user/iot/preclaims' },
                { id: 'app-pinning', label: 'App Pinning Rules', href: '/user/iot/pin-rules' },
                { id: 'profiles', label: 'Profiles', href: '/user/iot/device-profiles' }
            ]
        },
        // IoT Management Section
        {
            id: 'iot-management',
            label: 'IoT Management',
            icon: Radio,
            children: [
                { id: 'sensors', label: 'Sensors', href: '/user/controllers/radar' },
                { id: 'templates', label: 'Templates', href: '/user/iot/templates' },
                { id: 'data', label: 'Data', href: '/user/analytics/radar' },
                { id: 'api-keys', label: 'API Keys', href: '/user/settings/api-keys' }
            ]
        }
    ];

    // Footer navigation items
    const footerNavItems: NavItem[] = [
        {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            href: '/user/profile'
        },
        {
            id: 'help',
            label: 'Help & Support',
            icon: CircleHelp,
            href: '/user/support'
        }
    ];

    // User info for TopNavigation
    let userInfo: UserInfo;
    $: userInfo = {
        email: data.user?.email || '',
        role: data.user?.systemRole || 'USER',
        name: data.user?.email?.split('@')[0] || 'User'
    };

    // Page config based on route
    $: pageConfig = getPageConfig($page.url.pathname);

    function getPageConfig(pathname: string): {
        headerStyle: TopNavStyle;
        title: string;
        subtitle: string;
    } {
        if (pathname.includes('/iot/devices/new')) {
            return {
                headerStyle: 'page',
                title: 'Claim Device',
                subtitle: 'Connect a new device to your account'
            };
        }
        if (pathname.includes('/iot/devices/') && pathname.endsWith('/edit')) {
            return {
                headerStyle: 'page',
                title: 'Edit Device',
                subtitle: 'Update device information'
            };
        }
        if (pathname.includes('/iot/devices/') && pathname.endsWith('/terminal')) {
            return {
                headerStyle: 'page',
                title: 'Terminal',
                subtitle: 'Remote terminal session'
            };
        }
        if (pathname.includes('/iot/devices/') && pathname.endsWith('/rdp')) {
            return {
                headerStyle: 'page',
                title: 'Remote Desktop',
                subtitle: 'Remote device screen'
            };
        }
        if (pathname.includes('/iot/devices')) {
            return {
                headerStyle: 'page',
                title: 'Devices',
                subtitle: 'View, filter, and manage all registered devices'
            };
        }
        if (pathname.includes('/iot/device-profiles/') && pathname.endsWith('/edit')) {
            return {
                headerStyle: 'page',
                title: 'Edit Profile',
                subtitle: 'Edit profile settings and assignments'
            };
        }
        if (pathname.includes('/iot/device-profiles')) {
            const isDetailView = /^\/user\/iot\/device-profiles\/[^/]+$/.test(pathname.replace(/\/$/, ''));
            return {
                headerStyle: 'page',
                title: isDetailView ? 'Profile Details' : 'Profiles',
                subtitle: isDetailView ? 'Key information about this profile' : 'Manage device profiles and assignments'
            };
        }
        // Sensors listing only (not detail /radar/[id] or /radar/new)
        if (pathname === '/user/controllers/radar' || pathname === '/user/controllers/radar/') {
            return {
                headerStyle: 'page',
                title: 'Sensors',
                subtitle: 'View, filter, and manage all radar sensors'
            };
        }
        if (pathname.includes('/dashboard')) {
            return {
                headerStyle: 'page',
                title: 'Dashboard',
                subtitle: 'Overview of your account'
            };
        }
        // Default
        return {
            headerStyle: 'page',
            title: '',
            subtitle: ''
        };
    }

    function handleSidebarToggle(e: CustomEvent<boolean>) {
        sidebarExpanded = e.detail;
        dispatch('sidebarToggle', sidebarExpanded);
    }

    function handleItemClick(e: CustomEvent<NavItem>) {
        if (e.detail.href) {
            goto(e.detail.href);
        }
        dispatch('navigate', e.detail);
    }

    function handleUserMenuClick() {
        // Handle user menu click (profile, logout, etc.)
        // This will be handled by TopNavigation component
    }

    function handleUserMenuAction(e: CustomEvent<{ id: string }>) {
        const id = e.detail?.id;
        if (!id) return;
        if (id === 'settings') {
            goto('/user/settings/account');
            return;
        }
        if (id === 'logout') {
            // Use hard navigation so cookies/session are cleared reliably
            window.location.href = '/auth/logout';
            return;
        }
    }

    function handleSearch() {
        // Handle search
    }

    function handleNotifications() {
        // Handle notifications
    }

    function handleBack() {
        window.history.back();
    }

    function handleGridClick() {
        // Handle grid view toggle
    }
</script>

<div class="flex h-screen bg-white">
    <!-- Sidebar using design system component -->
    <Sidebar
        expanded={sidebarExpanded}
        logoText="Data Realities"
        {mainNavItems}
        {footerNavItems}
        on:toggle={handleSidebarToggle}
        on:itemClick={handleItemClick}
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top Navigation using design system component -->
        <div class="relative">
            <TopNavigation
                style={pageConfig.headerStyle}
                mode="light"
                title={pageConfig.title}
                subtitle={pageConfig.subtitle}
                user={userInfo}
                userMenuItems={[
                    { id: 'settings', label: 'Settings' },
                    { id: 'logout', label: 'Logout', destructive: true }
                ]}
                showSearch={false}
                showNotifications={false}
                showBackButton={false}
                showUserMenu={true}
                showDivider={false}
                showGridButton={false}
                on:search={handleSearch}
                on:notifications={handleNotifications}
                on:userMenuClick={handleUserMenuClick}
                on:userMenuAction={handleUserMenuAction}
                on:back={handleBack}
                on:gridClick={handleGridClick}
            />
            <!-- Account Selector - positioned absolutely before user menu -->
            {#if data.accountMemberships && data.accountMemberships.length > 0}
                <div class="absolute right-24 top-1/2 -translate-y-1/2">
                    <!-- <AccountSelector 
                        currentAccount={data.currentAccount} 
                        accountMemberships={data.accountMemberships} 
                    /> -->
                </div>
            {/if}
        </div>

        <!-- Page content -->
        <main class="flex-1 overflow-auto bg-[#F9FAFB]">
            <slot />
        </main>
    </div>

    <!-- Alert-based toasts (design system) - replaces svelte-sonner in user mode -->
    <AlertToastContainer />
</div>
