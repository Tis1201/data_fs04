<script lang="ts">
    import { page } from "$app/stores";
    import { createEventDispatcher } from 'svelte';
    import { Sidebar, type NavItem } from '$lib/design-system/components';
    import AlertToastContainer from '$lib/components/AlertToastContainer.svelte';
    import { TopNavigation } from '$lib/design-system/components';
    import type { TopNavStyle, UserInfo } from '$lib/design-system/components';
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
    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    export let params: Record<string, string> = {};

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
                { id: 'all-devices', label: 'All Devices', href: '/user/devices/listing' },
                { id: 'tags', label: 'Tags', href: '/user/iot/device_tags' }
            ]
        },
        {
            id: 'organization',
            label: 'Organizations',
            icon: Globe,
            href: '/user/settings/organizations',
            dividerAfter: true
        },
        // RDM Management Section
        {
            id: 'rdm-management',
            label: 'RDM Management',
            icon: Box,
            children: [
                { id: 'rdm-devices', label: 'Devices', href: '/user/iot/devices?page=1&per_page=10&sort=name&order=asc', preload: false },
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
        showBackButton?: boolean;
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
        // Data module (analytics/radar)
        if (pathname === '/user/analytics/radar' || pathname === '/user/analytics/radar/') {
            return {
                headerStyle: 'page',
                title: 'Data',
                subtitle: 'View and export sensors data logs'
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
        // Radar sensor detail: title and subtitle in header, show back button
        if (/^\/user\/controllers\/radar\/[^/]+\/?$/.test(pathname.replace(/\/$/, '')) && !pathname.includes('/new')) {
            return {
                headerStyle: 'page',
                title: 'Device Details',
                subtitle: "View and manage this device's status, details, and activity.",
                showBackButton: true
            };
        }
        if (pathname.startsWith('/user/resources/') && pathname !== '/user/resources' && pathname !== '/user/resources/') {
            const isDetail = /^\/user\/resources\/[^/]+$/.test(pathname.replace(/\/$/, ''));
            const isNew = pathname === '/user/resources/new' || pathname === '/user/resources/new/';
            return {
                headerStyle: 'page',
                title: isNew ? 'Add Resource' : isDetail ? 'Resource Details' : 'Applications & Resources',
                subtitle: isDetail ? 'Key information about this resource' : (isNew ? 'Upload a new application or resource package' : 'Manage application packages and resources')
            };
        }
        if (pathname === '/user/resources' || pathname === '/user/resources/') {
            return {
                headerStyle: 'page',
                title: 'Applications & Resources',
                subtitle: 'Manage application packages and resources'
            };
        }
        // Pre-Enrollment (preclaims)
        if (pathname.startsWith('/user/iot/preclaims/') && pathname !== '/user/iot/preclaims' && pathname !== '/user/iot/preclaims/') {
            const isNew = pathname === '/user/iot/preclaims/new' || pathname === '/user/iot/preclaims/new/';
            const isEdit = /\/edit\/?$/.test(pathname);
            const isDetail = /^\/user\/iot\/preclaims\/[^/]+\/?$/.test(pathname.replace(/\/$/, ''));
            return {
                headerStyle: 'page',
                title: isNew ? 'Add Pre-Enrollment Set' : isEdit ? 'Edit Pre-Enrollment Set' : isDetail ? 'Pre-Enrollment Set Details' : 'Pre-Enrollment',
                subtitle: isDetail
                    ? 'Pre-register devices to automatically assign them to the correct account and device profile during enrollment.'
                    : isNew
                        ? 'Create a new pre-enrollment set and upload device list (CSV/XLSX)'
                        : isEdit
                            ? 'Update pre-enrollment set and device profile'
                            : 'Pre-register devices to assign to account and device profile during enrollment.'
            };
        }
        if (pathname === '/user/iot/preclaims' || pathname === '/user/iot/preclaims/') {
            return {
                headerStyle: 'page',
                title: 'Pre-Enrollment',
                subtitle: 'Pre-register devices to assign to account and device profile during enrollment.'
            };
        }
        if (pathname.includes('/dashboard')) {
            return {
                headerStyle: 'page',
                title: 'Dashboard',
                subtitle: 'Key metrics for your management'
            };
        }
        // Bulk Deployments (bundles)
        if (pathname.startsWith('/user/iot/bundles/') && pathname !== '/user/iot/bundles' && pathname !== '/user/iot/bundles/') {
            const isNew = pathname === '/user/iot/bundles/new' || pathname === '/user/iot/bundles/new/';
            const isEdit = /\/edit\/?$/.test(pathname);
            const isDetail = /^\/user\/iot\/bundles\/[^/]+\/?$/.test(pathname.replace(/\/$/, ''));
            return {
                headerStyle: 'page',
                title: isNew ? 'Add Deployment' : isEdit ? 'Edit Deployment' : isDetail ? 'Deployment Details' : 'Bulk Deployments',
                subtitle: isDetail
                    ? 'View deployment status and performance'
                    : isNew
                        ? 'Create a new deployment with apps and devices'
                        : isEdit
                            ? 'Update deployment settings'
                            : 'Deployment contains a grouped set of resources or deployments to devices'
            };
        }
        if (pathname === '/user/iot/bundles' || pathname === '/user/iot/bundles/') {
            return {
                headerStyle: 'page',
                title: 'Bulk Deployments',
                subtitle: 'Deployment contains a grouped set of resources or deployments to devices'
            };
        }
        // App Pinning Rules (detail at [id], edit form at [id]/edit)
        if (pathname === '/user/iot/templates' || pathname === '/user/iot/templates/') {
            return {
                headerStyle: 'page',
                title: 'Templates',
                subtitle: 'Reusable configurations and alert rules'
            };
        }
        if (/^\/user\/iot\/templates\/[^/]+\/?$/.test(pathname.replace(/\/$/, ''))) {
            return {
                headerStyle: 'page',
                title: 'Template Details',
                subtitle: 'Manage reusable sensor templates for quick deployment',
                showBackButton: true
            };
        }
        if (pathname.includes('/iot/pin-rules')) {
            const isNew = pathname === '/user/iot/pin-rules/new' || pathname === '/user/iot/pin-rules/new/';
            const isEditForm = /\/pin-rules\/[^/]+\/edit\/?$/.test(pathname.replace(/\/$/, ''));
            const isDetail = /\/pin-rules\/[^/]+\/?$/.test(pathname.replace(/\/$/, '')) && !isNew && !isEditForm;
            return {
                headerStyle: 'page',
                title: isNew ? 'Add Rule' : isEditForm ? 'Edit Rule' : isDetail ? 'Pin Rule Details' : 'App Pinning Rules',
                subtitle: isNew
                    ? 'Create a new app pinning rule'
                    : isEditForm
                        ? 'Edit rule name, apps, and target devices'
                        : isDetail
                            ? 'Policy configuration and settings'
                            : 'Bulk pin apps to target devices and control layout, fallback behavior.'
            };
        }
        // Device Tags (Tags page - match Devices style)
        if (pathname.includes('/iot/device_tags') || pathname.includes('/devices/tags')) {
            const isNew = pathname === '/user/iot/device_tags/new' || pathname === '/user/iot/device_tags/new/';
            const isDetail = /^\/user\/iot\/device_tags\/[^/]+\/?$/.test(pathname.replace(/\/$/, ''));
            return {
                headerStyle: 'page',
                title: isNew ? 'Add Tag' : isDetail ? 'Tag Details' : 'Tags',
                subtitle: isNew
                    ? 'Create a new tag for organizing devices'
                    : isDetail
                        ? 'Key information about this tag'
                        : 'Manage tags for organizing devices'
            };
        }
        // All Devices (combined Remote Devices + Sensors)
        if (pathname === '/user/devices/listing' || pathname === '/user/devices/listing/') {
            return {
                headerStyle: 'page',
                title: 'All Devices',
                subtitle: 'View, filter, and manage all devices'
            };
        }
        // Organizations (listing)
        if (pathname === '/user/settings/organizations' || pathname === '/user/settings/organizations/') {
            return {
                headerStyle: 'page',
                title: 'Organizations',
                subtitle: 'Manage organizations within your account'
            };
        }
        // Organization detail
        if (/^\/user\/settings\/organizations\/[^/]+\/?$/.test(pathname.replace(/\/$/, ''))) {
            return {
                headerStyle: 'page',
                title: 'Organization Details',
                subtitle: 'View and manage organization profile',
                showBackButton: true
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
        // Do not call goto() here — the Sidebar <a> already navigates. Calling goto() caused a
        // second __data.json load (initiator: +layout.svelte). We only dispatch for listeners.
        dispatch('navigate', e.detail);
    }

    function handleUserMenuClick() {
        // Handle user menu click (profile, logout, etc.)
        // This will be handled by TopNavigation component
    }

    function handleUserMenuAction(e: CustomEvent<{ id: string }>) {
        const id = e.detail?.id;
        if (!id) return;
        if (id === 'profile') {
            goto('/user/profile');
            return;
        }
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

    async function handleSwitchAccount(e: CustomEvent<{ accountId: string }>) {
        const accountId = e.detail?.accountId;
        if (!accountId) return;
        try {
            const response = await fetch('/api/account/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId })
            });
            const result = await response.json();
            if (result.success) {
                window.location.href = '/user/dashboard';
            } else {
                console.error('Switch account failed:', result.message);
                window.location.href = '/user/dashboard';
            }
        } catch (err) {
            console.error('Switch account error:', err);
            window.location.href = '/user/dashboard';
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
                    { id: 'profile', label: 'My Profile' },
                    { id: 'logout', label: 'Sign out of all accounts', destructive: true }
                ]}
                accountMemberships={data.accountMemberships ?? []}
                currentAccount={data.currentAccount}
                showSearch={false}
                showNotifications={false}
                showBackButton={pageConfig.showBackButton ?? false}
                showUserMenu={true}
                showDivider={false}
                showGridButton={false}
                on:search={handleSearch}
                on:notifications={handleNotifications}
                on:userMenuClick={handleUserMenuClick}
                on:userMenuAction={handleUserMenuAction}
                on:switchAccount={handleSwitchAccount}
                on:back={handleBack}
                on:gridClick={handleGridClick}
            />
        </div>

        <!-- Page content -->
        <main class="flex-1 overflow-auto bg-[#F9FAFB]">
            <slot />
        </main>
    </div>

    <!-- Alert-based toasts (design system) - replaces svelte-sonner in user mode -->
    <AlertToastContainer />
</div>
