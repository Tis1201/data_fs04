<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { PageData } from "./$types";
    import { page } from "$app/stores";
    import { goto, invalidate } from "$app/navigation";
    import { TabGroup, Button, Badge, Tag, Modal, Dropdown, TextareaField, Toggle, Alert, InputField, Radio } from "$lib/design-system/components";
    import type { TabItem as EditTabItem } from "$lib/design-system/components/TabGroup.svelte";
    import type { TabItem } from "$lib/design-system/components/TabGroup.svelte";
    import { toast } from "svelte-sonner";
    import { 
        PenLine, 
        RefreshCw, 
        Camera, 
        Airplay, 
        Terminal as TerminalIcon, 
        Upload, 
        Download, 
        BookUp2, 
        Power,
        ScanFace,
        Info,
        Wifi,
        Cpu,
        Shield,
        Settings2,
        History,
        Package,
        Copy,
        Eye,
        EyeOff,
        Pin,
        PinOff,
        MoreVertical,
        RotateCcw,
        Settings,
        Trash2,
        Plus,
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight,
        ChevronDown,
        ArrowRight,
        Server,
        GitFork,
        Search
    } from "lucide-svelte";

    // Legacy components for tabs that haven't been migrated yet
    import ActionHistory from "$lib/components/ui_components_sveltekit/devices/ActionHistory.svelte";

    export let data: PageData;
    
    // Apps state
    interface DeviceApp {
        device_id: string;
        account_id: string;
        app_name: string;
        package_name: string;
        version: string;
        app_type: 'System' | 'Normal' | 'User' | string;
        last_modified: string;
        install_date: string;
        size_bytes: number;
        is_pinned?: boolean;
        is_system_app: boolean;
    }
    
    let apps: DeviceApp[] = [];
    let appsLoading = false;
    let appsLoaded = false; // Track if apps have been loaded
    let appsError: string | null = null;
    let appsTotalCount = 0;
    let appsCurrentPage = 1;
    let appsPageSize = 10;
    let appsTotalPages = 1;
    let appsSearchTerm = '';
    let activeAppMenu: string | null = null;
    
    // Deployments state
    type DeploymentStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Failed' | 'Stopped' | 'Cancelled';
    
    interface Deployment {
        id: string;
        name: string;
        version: string;
        startedOn: string | null;
        endedOn: string | null;
        status: DeploymentStatus;
    }
    
    let deployments: Deployment[] = [];
    let deploymentsLoading = false;
    let deploymentsLoaded = false;
    let deploymentsTotalCount = 0;
    let deploymentsCurrentPage = 1;
    let deploymentsPageSize = 10;
    let deploymentsTotalPages = 1;
    let activeDeploymentMenu: string | null = null;
    
    // Mock deployments data
    function getMockDeployments(): Deployment[] {
        return [
            {
                id: '1',
                name: '<Name>',
                version: '1.0.0',
                startedOn: '2024-12-21T15:21:00Z',
                endedOn: '2024-12-21T15:25:00Z',
                status: 'Completed'
            },
            {
                id: '2',
                name: '<Name>',
                version: '1.0.0',
                startedOn: '2024-12-21T14:00:00Z',
                endedOn: '2024-12-21T14:05:00Z',
                status: 'Completed'
            },
            {
                id: '3',
                name: '<Name>',
                version: '1.0.0',
                startedOn: null,
                endedOn: null,
                status: 'Completed'
            }
        ];
    }
    
    // Get allowed actions based on deployment status
    function getDeploymentActions(status: DeploymentStatus): { label: string; action: string; color?: string }[] {
        switch (status) {
            case 'Draft':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Scheduled':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'In Progress':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Completed':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Failed':
                return [
                    { label: 'Retry', action: 'retry' },
                    { label: 'View', action: 'view' },
                    { label: 'Delete', action: 'delete', color: '#B42318' }
                ];
            case 'Stopped':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Cancelled':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            default:
                return [{ label: 'View', action: 'view' }];
        }
    }
    
    // Handle deployment action
    function handleDeploymentAction(deployment: Deployment, action: string) {
        activeDeploymentMenu = null;
        switch (action) {
            case 'view':
                toast.info(`View deployment: ${deployment.name}`);
                // TODO: Navigate to deployment details
                break;
            case 'remove':
            case 'delete':
                toast.info(`Remove deployment: ${deployment.name}`);
                // TODO: Show confirmation and delete
                break;
            case 'retry':
                toast.info(`Retry deployment: ${deployment.name}`);
                // TODO: Retry deployment
                break;
            default:
                toast.info(`Action ${action} on ${deployment.name}`);
        }
    }
    
    // Load deployments from API
    async function loadDeployments() {
        if (!device?.id || deploymentsLoading) return;
        
        try {
            deploymentsLoading = true;
            
            const params = new URLSearchParams({
                page: String(deploymentsCurrentPage),
                pageSize: String(deploymentsPageSize)
            });
            
            const res = await fetch(`/api/devices/${device.id}/deployments?${params.toString()}`);
            
            if (!res.ok) throw new Error(`Failed to load deployments: ${res.statusText}`);
            
            const result = await res.json();
            
            if (result.success && result.data?.deployments) {
                // Transform API response to Deployment format
                deployments = result.data.deployments.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    status: mapBundleStatus(d.deviceStatus || d.bundleStatus),
                    appsCount: d.apps?.length || 0,
                    createdAt: d.createdAt,
                    scheduledAt: d.scheduledAt
                }));
                
                deploymentsTotalCount = result.data.pagination?.total || deployments.length;
                deploymentsTotalPages = result.data.pagination?.totalPages || Math.ceil(deploymentsTotalCount / deploymentsPageSize);
            } else {
                deployments = [];
                deploymentsTotalCount = 0;
                deploymentsTotalPages = 1;
            }
            
            deploymentsLoaded = true;
        } catch (e) {
            console.error('Failed to load deployments:', e);
            deployments = [];
            deploymentsTotalCount = 0;
            deploymentsTotalPages = 1;
            deploymentsLoaded = true;
        } finally {
            deploymentsLoading = false;
        }
    }
    
    // Map bundle/device status to UI status
    function mapBundleStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'DRAFT': 'Draft',
            'PUBLISHED': 'Scheduled',
            'PENDING': 'Scheduled',
            'IN_PROGRESS': 'In Progress',
            'COMPLETED': 'Completed',
            'FAILED': 'Failed',
            'CANCELLED': 'Cancelled',
            'STOPPED': 'Stopped',
            'INCLUDED': 'Scheduled',
            'EXCLUDED': 'Cancelled'
        };
        return statusMap[status?.toUpperCase()] || status || 'Unknown';
    }
    
    // Format deployment date
    function formatDeploymentDate(dateString: string | null): string {
        if (!dateString) return '-';
        const d = new Date(dateString);
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${month} ${day}, ${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }
    
    // Get status badge color
    function getDeploymentStatusColor(status: string): { bg: string; dot: string; text: string } {
        switch (status) {
            case 'Draft': return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
            case 'Scheduled': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' };
            case 'In Progress': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' };
            case 'Completed': return { bg: '#ECFDF3', dot: '#12B76A', text: '#027A48' };
            case 'Failed': return { bg: '#FEF3F2', dot: '#F04438', text: '#B42318' };
            case 'Stopped': return { bg: '#FFFAEB', dot: '#F79009', text: '#B54708' };
            case 'Cancelled': return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
            default: return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
        }
    }
    
    function toggleDeploymentMenu(id: string) {
        activeDeploymentMenu = activeDeploymentMenu === id ? null : id;
    }
    
    // Load deployments when tab changes
    $: if (activeTab === 'deployments' && device?.id && !deploymentsLoaded && !deploymentsLoading) {
        loadDeployments();
    }
    
    // Activity Logs state
    type ActivityLogStatus = 'Success' | 'In Progress' | 'Failed' | 'Warning';
    
    interface ActivityLogDetail {
        label: string;
        oldValue?: string;
        newValue: string;
        tags?: string[]; // For tag-type values
    }
    
    interface ActivityLog {
        id: string;
        eventName: string;
        description: string;
        status: ActivityLogStatus;
        timestamp: string;
        expanded?: boolean;
        details?: ActivityLogDetail[];
    }
    
    let activityLogs: ActivityLog[] = [];
    let activityLogsLoading = false;
    let activityLogsLoaded = false;
    let activityLogsTotalCount = 0;
    let activityLogsCurrentPage = 1;
    let activityLogsPageSize = 10;
    let activityLogsTotalPages = 1;
    
    // Mock activity logs data
    function getMockActivityLogs(): ActivityLog[] {
        return [
            {
                id: '1',
                eventName: '12/10/2025 03:21 PM',
                description: 'Refreshed device',
                status: 'Success',
                timestamp: '2025-12-10T15:21:00Z',
                expanded: true,
                details: [
                    { label: 'API Key:', oldValue: 'e8sc ••• znk0', newValue: 'dssc ••• nca3' }
                ]
            },
            {
                id: '2',
                eventName: '12/10/2025 03:21 PM',
                description: 'Refreshed device',
                status: 'Success',
                timestamp: '2025-12-10T15:21:00Z',
                expanded: false,
                details: []
            },
            {
                id: '3',
                eventName: '12/10/2025 03:14 PM',
                description: 'Uninstalled Weather application',
                status: 'In Progress',
                timestamp: '2025-12-10T15:14:00Z',
                expanded: false,
                details: []
            },
            {
                id: '4',
                eventName: '12/10/2025 03:04 PM',
                description: 'Installed Clock App',
                status: 'Failed',
                timestamp: '2025-12-10T15:04:00Z',
                expanded: true,
                details: [
                    { label: 'App Name:', oldValue: 'None', newValue: 'Clock App' },
                    { label: 'Type:', oldValue: 'None', newValue: 'apk' },
                    { label: 'Version:', oldValue: 'None', newValue: '5.1.0' },
                    { label: 'Size:', oldValue: 'None', newValue: '12 MB' }
                ]
            },
            {
                id: '5',
                eventName: '12/10/2025 03:01 PM',
                description: 'Generated new API Key',
                status: 'Success',
                timestamp: '2025-12-10T15:01:00Z',
                expanded: true,
                details: [
                    { label: 'API Key:', oldValue: 'e8sc ••• znk0', newValue: 'dssc ••• nca3' }
                ]
            },
            {
                id: '6',
                eventName: '01/17/2025 05:24 PM',
                description: 'Modified Device',
                status: 'Success',
                timestamp: '2025-01-17T17:24:00Z',
                expanded: true,
                details: [
                    { label: 'Description:', oldValue: 'None', newValue: 'Lorem ipsum dolor sit amet consectetur. Aenean et diam pellentesque neque mauris fames leo. Tempor scelerisque malesuada pellentesque dolor nec mauris eu integer tellus.' },
                    { label: 'Tag:', oldValue: 'None', newValue: '', tags: ['Tablet', 'Hospital', 'Texas'] }
                ]
            },
            {
                id: '7',
                eventName: '01/10/2025 02:24 PM',
                description: 'Created device',
                status: 'Success',
                timestamp: '2025-01-10T14:24:00Z',
                expanded: true,
                details: [
                    { label: 'Device PIN Code:', oldValue: 'None', newValue: '000 001' }
                ]
            }
        ];
    }
    
    // Get activity log status color
    function getActivityLogStatusColor(status: ActivityLogStatus): { bg: string; dot: string; text: string } {
        switch (status) {
            case 'Success': return { bg: '#ECFDF3', dot: '#12B76A', text: '#027A48' }; // Green
            case 'In Progress': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' }; // Blue
            case 'Failed': return { bg: '#FEF3F2', dot: '#F04438', text: '#B42318' }; // Red
            case 'Warning': return { bg: '#FFFAEB', dot: '#F79009', text: '#B54708' }; // Orange/Yellow
            default: return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
        }
    }
    
    // Toggle activity log expansion
    function toggleActivityLogExpansion(logId: string) {
        activityLogs = activityLogs.map(log => 
            log.id === logId ? { ...log, expanded: !log.expanded } : log
        );
    }
    
    // Load activity logs from API
    async function loadActivityLogs() {
        if (!device?.id || activityLogsLoading) return;
        
        try {
            activityLogsLoading = true;
            
            const offset = (activityLogsCurrentPage - 1) * activityLogsPageSize;
            const res = await fetch(`/api/devices/${device.id}/action-logs?limit=${activityLogsPageSize}&offset=${offset}`);
            
            if (!res.ok) throw new Error(`Failed to load activity logs: ${res.statusText}`);
            
            const result = await res.json();
            
            if (result.success && result.data?.logs) {
                // Transform API response to ActivityLog format
                activityLogs = result.data.logs.map((log: any) => ({
                    id: log.id,
                    eventName: formatActivityLogDate(log.initiatedAt),
                    description: formatActionDescription(log.actionType, log.message),
                    status: mapActionStatus(log.status),
                    timestamp: log.initiatedAt,
                    expanded: false,
                    details: buildActivityLogDetails(log)
                }));
                
                // Get total count for pagination
                const countRes = await fetch(`/api/devices/${device.id}/action-logs?limit=1&offset=0`);
                if (countRes.ok) {
                    const countResult = await countRes.json();
                    // Estimate total based on whether we got full page
                    activityLogsTotalCount = activityLogs.length < activityLogsPageSize 
                        ? offset + activityLogs.length 
                        : Math.max(offset + activityLogsPageSize * 2, 100); // Estimate
                }
                activityLogsTotalPages = Math.max(1, Math.ceil(activityLogsTotalCount / activityLogsPageSize));
            } else {
                activityLogs = [];
                activityLogsTotalCount = 0;
                activityLogsTotalPages = 1;
            }
            
            activityLogsLoaded = true;
        } catch (e) {
            console.error('Failed to load activity logs:', e);
            activityLogs = [];
            activityLogsTotalCount = 0;
            activityLogsTotalPages = 1;
            activityLogsLoaded = true;
        } finally {
            activityLogsLoading = false;
        }
    }
    
    // Format activity log date
    function formatActivityLogDate(dateString: string): string {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${month}/${day}/${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }
    
    // Format action description based on action type
    function formatActionDescription(actionType: string, message?: string): string {
        if (message) return message;
        
        const descriptions: Record<string, string> = {
            'reboot': 'Rebooted device',
            'restart': 'Restarted device',
            'refresh': 'Refreshed device',
            'screenshot': 'Captured screenshot',
            'install_app': 'Installed application',
            'uninstall_app': 'Uninstalled application',
            'restart_app': 'Restarted application',
            'push_file': 'Pushed file to device',
            'pull_file': 'Pulled file from device',
            'update_firmware': 'Updated firmware',
            'config_app': 'Configured application',
            'get_logs': 'Retrieved device logs'
        };
        
        return descriptions[actionType] || `Action: ${actionType}`;
    }
    
    // Map API status to ActivityLogStatus
    function mapActionStatus(status: string): ActivityLogStatus {
        const statusMap: Record<string, ActivityLogStatus> = {
            'success': 'Success',
            'completed': 'Success',
            'failed': 'Failed',
            'error': 'Failed',
            'in_progress': 'In Progress',
            'pending': 'In Progress',
            'warning': 'Warning'
        };
        return statusMap[status?.toLowerCase()] || 'In Progress';
    }
    
    // Build activity log details from API response
    function buildActivityLogDetails(log: any): Array<{ label: string; oldValue?: string; newValue?: string; tags?: string[] }> {
        const details: Array<{ label: string; oldValue?: string; newValue?: string; tags?: string[] }> = [];
        
        if (log.durationMs) {
            details.push({ label: 'Duration:', newValue: `${log.durationMs}ms` });
        }
        
        if (log.user?.name) {
            details.push({ label: 'Initiated by:', newValue: log.user.name });
        }
        
        if (log.error) {
            details.push({ label: 'Error:', newValue: log.error });
        }
        
        return details;
    }
    
    // Load activity logs when tab changes
    $: if (activeTab === 'activity' && device?.id && !activityLogsLoaded && !activityLogsLoading) {
        loadActivityLogs();
    }
    
    // Load apps data
    async function loadApps() {
        if (!device?.id || appsLoading) return;
        
        try {
            appsLoading = true;
            appsError = null;
            
            const params = new URLSearchParams({
                page: String(appsCurrentPage),
                pageSize: String(appsPageSize)
            });
            
            if (appsSearchTerm) params.set('search', appsSearchTerm);
            
            const res = await fetch(`/api/v2/devices/${device.id}/apps?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load apps: ${res.statusText}`);
            
            const result = await res.json();
            if (!result?.success) throw new Error(result?.error || 'Failed to load apps');
            
            const payload = result.data ?? result;
            const fetchedApps = payload.apps ?? payload.items ?? [];
            
            // Use mock data if API returns empty (for UI testing)
            if (fetchedApps.length === 0) {
                apps = getMockApps();
                appsTotalCount = apps.length;
                appsTotalPages = 1;
            } else {
                apps = fetchedApps;
                appsTotalCount = payload.pagination?.total ?? apps.length;
                appsTotalPages = payload.pagination?.totalPages ?? 1;
            }
            appsLoaded = true; // Mark as loaded
        } catch (e) {
            // On error, use mock data for UI testing
            apps = getMockApps();
            appsTotalCount = apps.length;
            appsTotalPages = 1;
            appsLoaded = true;
            // Don't show error toast when using mock data
            console.warn('Using mock data for apps:', e);
        } finally {
            appsLoading = false;
        }
    }
    
    // Format bytes
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${sizes[i]}`;
    }
    
    // Format install date
    function formatInstallDate(dateString: string): string {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
        const hour12 = d.getHours() % 12 || 12;
        return `${month} ${day}, ${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }
    
    // Get app type badge color
    function getAppTypeBadgeColor(type: string): { bg: string; text: string } {
        switch ((type || '').toLowerCase()) {
            case 'system': return { bg: '#FEF3F2', text: '#B42318' };
            case 'normal': return { bg: '#EFF8FF', text: '#175CD3' };
            case 'user': return { bg: '#ECFDF3', text: '#027A48' };
            default: return { bg: '#F5F5F5', text: '#525252' };
        }
    }
    
    // Toggle pin app
    async function togglePinApp(app: DeviceApp) {
        try {
            const res = await fetch(`/api/v2/devices/${device.id}/apps/${app.package_name}/pin`, {
                method: app.is_pinned ? 'DELETE' : 'POST'
            });
            if (!res.ok) throw new Error('Failed to toggle pin');
            
            // Update local state
            apps = apps.map(a => 
                a.package_name === app.package_name 
                    ? { ...a, is_pinned: !a.is_pinned } 
                    : a
            );
            toast.success(app.is_pinned ? 'App unpinned' : 'App pinned');
        } catch (e) {
            toast.error('Failed to toggle pin', { description: e instanceof Error ? e.message : 'Unknown error' });
        }
    }
    
    // App actions
    async function handleRestartApp(app: DeviceApp) {
        activeAppMenu = null;
        try {
            toast.info('Restarting app...', { description: app.app_name });
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'restartApp',
                    packageName: app.package_name
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to restart app');
            }
            
            toast.success('App restart initiated!', { description: app.app_name });
        } catch (error) {
            console.error('Restart app failed:', error);
            toast.error('Unable to restart app. Please try again!');
        }
    }
    
    async function handleAppSettings(app: DeviceApp) {
        activeAppMenu = null;
        try {
            toast.info('Opening app settings...', { description: app.app_name });
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'config',
                    packageName: app.package_name
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to open app settings');
            }
            
            toast.success('App settings opened!', { description: app.app_name });
        } catch (error) {
            console.error('App settings failed:', error);
            toast.error('Unable to open app settings. Please try again!');
        }
    }
    
    async function handleUninstallApp(app: DeviceApp) {
        activeAppMenu = null;
        if (app.is_system_app) {
            toast.error('Cannot uninstall system app');
            return;
        }
        
        if (!confirm(`Are you sure you want to uninstall "${app.app_name}"?`)) {
            return;
        }
        
        try {
            toast.info('Uninstalling app...', { description: app.app_name });
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'uninstall',
                    packageName: app.package_name
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to uninstall app');
            }
            
            toast.success('App uninstall initiated!', { description: app.app_name });
            // Reload apps list after uninstall
            setTimeout(() => loadApps(), 2000);
        } catch (error) {
            console.error('Uninstall app failed:', error);
            toast.error('Unable to uninstall app. Please try again!');
        }
    }
    
    function toggleAppMenu(packageName: string) {
        activeAppMenu = activeAppMenu === packageName ? null : packageName;
    }
    
    // Close menu when clicking outside
    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.app-actions-menu') && !target.closest('.action-menu-btn')) {
            activeAppMenu = null;
        }
    }
    
    // Load apps when tab changes to apps (only once)
    $: if (activeTab === 'apps' && device?.id && !appsLoaded && !appsLoading) {
        loadApps();
    }
    
    // API Key visibility state
    let showApiKey = false;

    // =========================
    // Edit Device Modal
    // =========================
    let showEditDeviceModal = false;
    let editDeviceLoading = false;
    let editDeviceError: string | null = null;
    
    // Edit Device form state - Details tab
    let editDeviceName = "";
    let editDeviceActive = true;
    let editDeviceTags: string[] = [];
    let editDeviceDescription = "";
    
    // Edit Device form state - Configuration tab
    let editActiveTab = "details";
    let editAssignedProfile = "";
    let editKioskLockMode = false;
    let editExitLockdownPassword = "";
    let editShowPassword = false;
    let editKioskApplication = "";
    let editDisplayResolution = "";
    let editScreenOrientation = "";
    let editBrightnessLevel = 100;
    let editAudioEnabled = true;
    let editAudioVolume = 100;
    let editTimezone = "";
    let editHomeLauncher = "";
    let editPowerManagementSchedule = false;
    let editRebootSchedule = false;
    let editDownloadSchedule = false;

    // Edit Device tabs
    const editDeviceTabs: EditTabItem[] = [
        { id: 'details', label: 'Details' },
        { id: 'configuration', label: 'Configuration' }
    ];

    // Available tags from server
    $: availableTags = data.availableTags || [];
    
    // Computed: Tag options for Edit Device modal
    $: editTagOptions = availableTags.map((t: { id: string; name: string }) => ({ id: t.id, label: t.name, type: 'checkbox' as const }));

    // =========================
    // Pull File Modal
    // =========================
    let showPullFileModal = false;
    let pullFileSourcePath = "";
    let pullFileLoading = false;

    // =========================
    // Push File Modal
    // =========================
    let showPushFileModal = false;
    let pushFileDestinationPath = "";
    let pushFileSearchTerm = "";
    let pushFileLoading = false;
    let pushFileResources: Array<{
        id: string;
        name: string;
        packageName: string | null;
        version: string | null;
        size: number | null;
        createdAt: string;
    }> = [];
    let pushFileResourcesLoading = false;
    let pushFileSelectedResourceId: string | null = null;
    let pushFileTotalCount = 0;
    let pushFileCurrentPage = 1;
    let pushFilePageSize = 10;
    let pushFileTotalPages = 1;

    // =========================
    // Update Firmware Modal (matching listing page style)
    // =========================
    interface FirmwareOption {
        id: string;
        name: string;
        packageName: string;
        version: string;
        size: string;
        createdOn: string;
    }
    
    let showUpdateFirmwareModal = false;
    let updateFirmwareSearch = "";
    let updateFirmwareSelected: string | null = null;
    let updateFirmwareLoading = false;
    let updateFirmwarePage = 1;
    const updateFirmwarePerPage = 10;
    let updateFirmwareOptions: FirmwareOption[] = [];
    let updateFirmwareOptionsLoading = false;

    // Computed: filtered firmwares for Update Firmware modal
    $: updateFirmwareFilteredOptions = updateFirmwareOptions.filter((fw) => 
        fw.name.toLowerCase().includes(updateFirmwareSearch.toLowerCase()) ||
        fw.packageName.toLowerCase().includes(updateFirmwareSearch.toLowerCase())
    );
    
    // Computed: paginated firmwares
    $: updateFirmwareTotalPages = Math.max(1, Math.ceil(updateFirmwareFilteredOptions.length / updateFirmwarePerPage));
    $: updateFirmwarePaginatedOptions = updateFirmwareFilteredOptions.slice(
        (updateFirmwarePage - 1) * updateFirmwarePerPage,
        updateFirmwarePage * updateFirmwarePerPage
    );

    // Make device reactive to server invalidations
    let device = data.device;
    $: device = data.device;
    
    // Device information from ClickHouse (loaded on server)
    // Will be null if ClickHouse is not configured or no data available
    $: deviceInfo = data.deviceInformation;
    
    // Auto-refresh device info every 30 seconds to get latest metrics
    let healthRefreshInterval: ReturnType<typeof setInterval> | null = null;
    
    onMount(() => {
        // Refresh device info periodically to get latest metrics from ClickHouse
        healthRefreshInterval = setInterval(() => {
            invalidate('app:device-detail');
        }, 30000); // Refresh every 30 seconds
    });
    
    onDestroy(() => {
        if (healthRefreshInterval) {
            clearInterval(healthRefreshInterval);
        }
    });
    
    // Helper function to get profile setting value by key
    function getProfileSetting(key: string, defaultValue: string = '-'): string {
        const settings = data.deviceProfile?.settings;
        if (!settings || !Array.isArray(settings)) return defaultValue;
        
        const setting = settings.find((s: any) => s.key === key);
        if (!setting || setting.value === null || setting.value === undefined || setting.value === '') {
            return defaultValue;
        }
        
        // Handle boolean values
        if (setting.dataType === 'boolean') {
            return setting.value === 'true' || setting.value === true ? 'Enable' : 'Disable';
        }
        
        return String(setting.value);
    }

    // Mock data function for UI testing - remove when ClickHouse is configured
    function getMockApps(): DeviceApp[] {
        return [
            {
                device_id: device?.id || '',
                account_id: '',
                app_name: '<App Name>',
                package_name: 'com.example.app',
                version: '4.1.2',
                app_type: 'Normal',
                last_modified: '2024-12-21T15:21:00Z',
                install_date: '2024-12-21T15:21:00Z',
                size_bytes: 30 * 1024 * 1024,
                is_pinned: true,
                is_system_app: false
            },
            {
                device_id: device?.id || '',
                account_id: '',
                app_name: 'MDM Agent',
                package_name: 'com.datarealities.mdm',
                version: '3.2.0',
                app_type: 'System',
                last_modified: '2024-12-21T15:21:00Z',
                install_date: '2024-12-21T15:21:00Z',
                size_bytes: 21 * 1024 * 1024,
                is_pinned: false,
                is_system_app: true
            },
            {
                device_id: device?.id || '',
                account_id: '',
                app_name: 'Shift Management',
                package_name: 'com.datarealities.shift',
                version: '2.1.0',
                app_type: 'System',
                last_modified: '2024-12-21T15:21:00Z',
                install_date: '2024-12-21T15:21:00Z',
                size_bytes: 17 * 1024 * 1024,
                is_pinned: false,
                is_system_app: true
            }
        ];
    }

    // Tabs - Updated to match Figma design
    const tabs: TabItem[] = [
        { id: "details", label: "Details" },
        { id: "configuration", label: "Configuration" },
        { id: "apps", label: "Installed Apps" },
        { id: "deployments", label: "Deployments" },
        { id: "activity", label: "Activity Logs" }
    ];

    let activeTab = "details";

    // Initialize tab from URL and keep it in sync
    $: {
        const urlParams = new URLSearchParams($page.url.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && tabs.some(t => t.id === tabParam)) {
            activeTab = tabParam;
        }
    }

    function handleTabChange(e: CustomEvent<string>) {
        activeTab = e.detail;
        const url = new URL($page.url);
        url.searchParams.set('tab', activeTab);
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    // Connection status
    $: isOnline = device?.connected ?? false;
    $: isActive = (device?.status || '').toUpperCase() === 'ACTIVE';

    // Format uptime
    function formatUptime(seconds: number | null): string {
        if (!seconds) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Format percentage with color
    function getUsageColor(usage: number | null): string {
        if (usage === null || usage === undefined) return '#A3A3A3';
        if (usage < 50) return '#039855'; // Green
        if (usage < 80) return '#DC6803'; // Orange/Warning
        return '#D92D20'; // Red/Error
    }

    // Format date
    function formatLastSeen(date: string | Date | null): string {
        if (!date) return 'N/A';
        const d = new Date(date);
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${month} ${day}, ${year} ${hours}:${minutes}`;
    }

    // Action handlers
    async function handleRefresh() {
        await invalidate('app:device');
    }

    async function handleSnapshot() {
        try {
            toast.info('Capturing screenshot...');
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'screenshot' })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to capture screenshot');
            }
            
            toast.success('Screenshot captured successfully!');
        } catch (error) {
            console.error('Screenshot failed:', error);
            toast.error('Unable to capture screenshot. Please try again!');
        }
    }

    function handleControl() {
        // TODO: Implement control/RDP
        goto(`/user/iot/devices/${device?.id}/rdp`);
    }

    function handleTerminal() {
        goto(`/user/iot/devices/${device?.id}/terminal`);
    }

    function handlePushFile() {
        pushFileDestinationPath = "";
        pushFileSearchTerm = "";
        pushFileSelectedResourceId = null;
        pushFileCurrentPage = 1;
        showPushFileModal = true;
        loadPushFileResources();
    }

    function handlePullFile() {
        pullFileSourcePath = "";
        showPullFileModal = true;
    }

    function handleUpdate() {
        updateFirmwareSearch = "";
        updateFirmwareSelected = null;
        updateFirmwarePage = 1;
        showUpdateFirmwareModal = true;
        loadFirmwareOptions();
    }

    // Pull File action
    async function executePullFile() {
        if (!pullFileSourcePath.trim()) {
            toast.error('Please enter a source file path');
            return;
        }
        
        pullFileLoading = true;
        try {
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'pullFile',
                    sourcePath: pullFileSourcePath.trim()
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to pull file');
            }
            
            toast.success('File pulled successfully!');
            showPullFileModal = false;
        } catch (error) {
            console.error('Pull file failed:', error);
            toast.error('Unable to pull file. Please try again!');
        } finally {
            pullFileLoading = false;
        }
    }

    // Load resources for Push File modal
    // Uses the same API as the old app (/api/resources/files)
    async function loadPushFileResources() {
        pushFileResourcesLoading = true;
        try {
            const params = new URLSearchParams({
                page: String(pushFileCurrentPage),
                pageSize: String(pushFilePageSize),
                ...(pushFileSearchTerm ? { search: pushFileSearchTerm } : {})
            });
            
            // Use the same API as the old app for consistency
            const res = await fetch(`/api/resources/files?${params}`);
            if (!res.ok) throw new Error('Failed to load resources');
            
            const data = await res.json();
            pushFileResources = data.items || [];
            pushFileTotalCount = data.meta?.totalCount || 0;
            pushFileTotalPages = data.meta?.totalPages || 1;
        } catch (error) {
            console.error('Failed to load resources:', error);
            pushFileResources = [];
        } finally {
            pushFileResourcesLoading = false;
        }
    }

    // Push File action
    async function executePushFile() {
        if (!pushFileSelectedResourceId) {
            toast.error('Please select a file to push');
            return;
        }
        if (!pushFileDestinationPath.trim()) {
            toast.error('Please enter a destination path');
            return;
        }
        
        const selectedResource = pushFileResources.find(r => r.id === pushFileSelectedResourceId);
        if (!selectedResource) {
            toast.error('Selected resource not found');
            return;
        }
        
        pushFileLoading = true;
        try {
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'pushFile',
                    resourceId: pushFileSelectedResourceId,
                    destinationPath: pushFileDestinationPath.trim()
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to push file');
            }
            
            toast.success('File push initiated!');
            showPushFileModal = false;
        } catch (error) {
            console.error('Push file failed:', error);
            toast.error('Unable to push file. Please try again!');
        } finally {
            pushFileLoading = false;
        }
    }

    // Load firmware options for Update Firmware modal
    async function loadFirmwareOptions() {
        updateFirmwareOptionsLoading = true;
        try {
            const res = await fetch(`/api/user/resources/firmware?pageSize=100`);
            if (!res.ok) throw new Error('Failed to load firmware');
            
            const data = await res.json();
            updateFirmwareOptions = (data.items || []).map((item: any) => ({
                id: item.id,
                name: item.name || 'Unknown',
                packageName: item.packageName || '-',
                version: item.version || '-',
                size: formatFileSize(item.size),
                createdOn: formatInstallDate(item.createdAt)
            }));
        } catch (error) {
            console.error('Failed to load firmware:', error);
            updateFirmwareOptions = [];
        } finally {
            updateFirmwareOptionsLoading = false;
        }
    }

    function selectFirmware(firmwareId: string) {
        updateFirmwareSelected = firmwareId;
    }

    // Update Firmware action
    async function confirmUpdateFirmware() {
        if (!updateFirmwareSelected) {
            toast.error('Please select a firmware to update');
            return;
        }
        
        updateFirmwareLoading = true;
        try {
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'pushFile',
                    resourceId: updateFirmwareSelected,
                    destinationPath: '/tmp/firmware_update'
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Failed to update firmware');
            }
            
            toast.success('Firmware updated successfully!');
            showUpdateFirmwareModal = false;
        } catch (error) {
            console.error('Firmware update failed:', error);
            toast.error('Unable to update Firmware. Please try again!');
        } finally {
            updateFirmwareLoading = false;
        }
    }

    // Format file size
    function formatFileSize(bytes: number | null): string {
        if (bytes === null || bytes === undefined) return 'N/A';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    async function handleReboot() {
        if (!confirm('Are you sure you want to reboot this device?')) return;
        try {
            const res = await fetch(`/api/devices/${device?.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'reboot' })
            });
            if (!res.ok) throw new Error('Failed to reboot');
            toast.success('Device rebooted successfully!');
        } catch (error) {
            console.error('Reboot failed:', error);
            toast.error('Unable to reboot device. Please try again!');
        }
    }

    function handleEditDevice() {
        if (!device) return;
        
        editActiveTab = "details";
        editDeviceError = null;
        
        // Populate Details tab
        editDeviceName = device.name || "";
        editDeviceActive = device.status === 'ACTIVE';
        editDeviceTags = device.tags?.map((t: { id: string }) => t.id) || [];
        editDeviceDescription = (device as any).description || "";
        
        // Populate Configuration tab (with defaults - actual values would come from device data)
        editAssignedProfile = (device as any).profileId || "";
        editKioskLockMode = (device as any).kioskLockMode || false;
        editExitLockdownPassword = "";
        editShowPassword = false;
        editKioskApplication = (device as any).kioskApplication || "";
        editDisplayResolution = (device as any).displayResolution || "1920x1080";
        editScreenOrientation = (device as any).screenOrientation || "Portrait";
        editBrightnessLevel = (device as any).brightnessLevel ?? 100;
        editAudioEnabled = (device as any).audioEnabled ?? true;
        editAudioVolume = (device as any).audioVolume ?? 100;
        editTimezone = (device as any).timezone || "Asia/Ho_Chi_Minh";
        editHomeLauncher = (device as any).homeLauncher || "";
        editPowerManagementSchedule = (device as any).powerManagementSchedule || false;
        editRebootSchedule = (device as any).rebootSchedule || false;
        editDownloadSchedule = (device as any).downloadSchedule || false;
        
        showEditDeviceModal = true;
    }

    async function saveEditDevice() {
        if (!device) return;
        
        editDeviceLoading = true;
        editDeviceError = null;
        
        try {
            const fd = new FormData();
            fd.set('id', device.id);
            fd.set('name', editDeviceName);
            fd.set('status', editDeviceActive ? 'ACTIVE' : 'INACTIVE');
            fd.set('description', editDeviceDescription);
            fd.set('tags', JSON.stringify(editDeviceTags));
            
            // Configuration fields
            fd.set('profileId', editAssignedProfile);
            fd.set('kioskLockMode', String(editKioskLockMode));
            if (editExitLockdownPassword) {
                fd.set('exitLockdownPassword', editExitLockdownPassword);
            }
            fd.set('kioskApplication', editKioskApplication);
            fd.set('displayResolution', editDisplayResolution);
            fd.set('screenOrientation', editScreenOrientation);
            fd.set('brightnessLevel', String(editBrightnessLevel));
            fd.set('audioEnabled', String(editAudioEnabled));
            fd.set('audioVolume', String(editAudioVolume));
            fd.set('timezone', editTimezone);
            fd.set('homeLauncher', editHomeLauncher);
            fd.set('powerManagementSchedule', String(editPowerManagementSchedule));
            fd.set('rebootSchedule', String(editRebootSchedule));
            fd.set('downloadSchedule', String(editDownloadSchedule));
            
            const res = await fetch('?/updateDevice', { method: 'POST', body: fd });
            
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || res.statusText);
            }
            
            toast.success('Device saved successfully!');
            showEditDeviceModal = false;
            await invalidate('app:device');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            editDeviceError = errorMsg;
            toast.error('Unable to save device. Please try again!');
        } finally {
            editDeviceLoading = false;
        }
    }

    function closeEditDeviceModal() {
        showEditDeviceModal = false;
        editDeviceError = null;
    }

    // Copy API Key to clipboard
    async function copyApiKey() {
        if (!device?.apiKey) return;
        try {
            await navigator.clipboard.writeText(device.apiKey);
            toast.success('API Key copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy API Key');
        }
    }

    // Toggle API Key visibility
    function toggleApiKeyVisibility() {
        showApiKey = !showApiKey;
    }

    // Generate new API Key
    let isGeneratingKey = false;
    async function handleGenerateApiKey() {
        if (!confirm('Are you sure you want to generate a new API Key? The old key will be invalidated.')) return;
        isGeneratingKey = true;
        try {
            const formData = new FormData();
            formData.append('deviceId', device?.id || '');
            
            const res = await fetch(`?/generateApiKey`, {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) throw new Error('Failed to generate API Key');
            
            toast.success('New API Key generated successfully!');
            await invalidate('app:device');
        } catch (error) {
            console.error('Generate API Key failed:', error);
            toast.error('Failed to generate new API Key');
        } finally {
            isGeneratingKey = false;
        }
    }

    // Format API Key for display
    function formatApiKey(key: string | null | undefined): string {
        if (!key) return 'N/A';
        if (showApiKey) return key;
        if (key.length <= 8) return '••••••••';
        return `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`;
    }
</script>

<!-- Main wrap -->
<div class="device-details-page">
    <!-- Edit Device Button - Top Right -->
    <div class="edit-button-wrapper">
        <button class="edit-device-btn" on:click={handleEditDevice}>
            <PenLine size={20} />
            <span>Edit Device</span>
        </button>
    </div>

    <!-- Header Section: Device Health + General -->
    <div class="header-section">
        <!-- Device Health Card -->
        <div class="device-health-card">
            <!-- Header -->
            <div class="card-header">
                <div class="icon-button">
                    <ScanFace size={20} color="#A3A3A3" />
                </div>
                <div class="content-wrap">
                    <h3 class="card-title">Device Health</h3>
                    <p class="card-subtitle">Real-time CPU, memory, storage, and network status.</p>
                </div>
            </div>

            <!-- Metrics Row -->
            <div class="details-wrap">
                <div class="metric-item">
                    <span class="metric-label">Device Uptime</span>
                    <span class="metric-value" style="color: #6941C6;">
                        {formatUptime(deviceInfo?.system_uptime_seconds ?? null)}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">CPU</span>
                    <span class="metric-value" style="color: {getUsageColor(deviceInfo?.cpu_usage ?? null)};">
                        {deviceInfo?.cpu_usage !== null && deviceInfo?.cpu_usage !== undefined ? `${Math.round(deviceInfo.cpu_usage)} %` : 'N/A'}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">MEM</span>
                    <span class="metric-value" style="color: {getUsageColor(deviceInfo?.ram_usage ?? null)};">
                        {deviceInfo?.ram_usage != null ? `${Math.round(deviceInfo.ram_usage)} %` : 'N/A'}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">DSK</span>
                    <span class="metric-value" style="color: {getUsageColor(deviceInfo?.disk_usage ?? null)};">
                        {deviceInfo?.disk_usage !== null && deviceInfo?.disk_usage !== undefined ? `${Math.round(deviceInfo.disk_usage)} %` : 'N/A'}
                    </span>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
                <button class="action-btn" on:click={handleRefresh}>
                    <RefreshCw size={20} />
                    <span>Refresh</span>
                </button>
                <button class="action-btn" on:click={handleSnapshot}>
                    <Camera size={20} />
                    <span>Snapshot</span>
                </button>
                <button class="action-btn" on:click={handleControl}>
                    <Airplay size={20} />
                    <span>Control</span>
                </button>
                <button class="action-btn" on:click={handleTerminal}>
                    <TerminalIcon size={20} />
                    <span>Terminal</span>
                </button>
                <button class="action-btn" on:click={handlePushFile}>
                    <Upload size={20} />
                    <span>Push File</span>
                </button>
                <button class="action-btn" on:click={handlePullFile}>
                    <Download size={20} />
                    <span>Pull File</span>
                </button>
                <button class="action-btn" on:click={handleUpdate}>
                    <BookUp2 size={20} />
                    <span>Update</span>
                </button>
                <button class="action-btn destructive" on:click={handleReboot}>
                    <Power size={20} />
                    <span>Reboot</span>
                </button>
            </div>
        </div>

        <!-- General Card -->
        <div class="general-card">
            <!-- Header -->
            <div class="card-header">
                <div class="icon-button">
                    <Airplay size={20} color="#A3A3A3" />
                </div>
                <div class="content-wrap">
                    <h3 class="card-title">General</h3>
                    <p class="card-subtitle">General information details</p>
                </div>
            </div>

            <!-- Content -->
            <div class="general-content">
                <div class="info-row">
                    <span class="info-label">Connection Status</span>
                    <div class="info-value">
                        <Badge 
                            label={isOnline ? 'Online' : 'Offline'} 
                            color={isOnline ? 'success' : 'gray'} 
                            variant="filled" 
                            size="sm" 
                        />
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Last Seen</span>
                    <span class="info-value-text">{formatLastSeen(device?.disconnectedAt || device?.connectedAt)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Public IP</span>
                    <span class="info-value-text">{deviceInfo?.public_ip || device?.ipAddress || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">LAN MAC</span>
                    <span class="info-value-text">{deviceInfo?.mac_lan || device?.lanMac || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Wi-Fi MAC</span>
                    <span class="info-value-text">{deviceInfo?.mac_wifi || device?.wifiMac || 'N/A'}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-wrapper">
        <TabGroup
            {tabs}
            activeTab={activeTab}
            type="underline"
            size="md"
            fullWidth={false}
            on:change={handleTabChange}
        />
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
        {#if activeTab === 'details'}
            <div class="details-grid">
                <!-- Left Column -->
                <div class="details-column">
                    <!-- Device Information Card -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <div class="icon-wrap">
                                <Info size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Device Information</h4>
                                <p>General details and identification information.</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">Device State</span>
                                <Badge 
                                    label={isActive ? 'Active' : 'Inactive'} 
                                    color={isActive ? 'success' : 'gray'} 
                                    variant="filled" 
                                    size="sm"
                                    showDot={true}
                                />
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Device Name</span>
                                <span class="value">{device?.name || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Assigned Profile</span>
                                {#if data.deviceProfile?.name}
                                    <a href="/user/iot/profiles/{data.deviceProfile.id}" class="value link">{data.deviceProfile.name}</a>
                                {:else}
                                    <span class="value">None</span>
                                {/if}
                            </div>
                            <div class="info-row-detail description">
                                <span class="label">Description</span>
                                <p class="description-text">{device?.description || 'No description provided.'}</p>
                            </div>
                            {#if device?.tags && device.tags.length > 0}
                                <div class="tags-row">
                                    {#each device.tags as tag}
                                        <Tag label={tag.name || tag} size="sm" />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Technical Details Card -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <div class="icon-wrap">
                                <Cpu size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Technical Details</h4>
                                <p>Hardware, OS and firmware information</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">OS Version</span>
                                <span class="value">{deviceInfo?.os_version || device?.osVersion || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Firmware</span>
                                <span class="value">{deviceInfo?.firmware || device?.firmwareVersion || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Model</span>
                                <span class="value">{deviceInfo?.model || device?.model || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Operating System</span>
                                <span class="value">{device?.deviceType || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Manufacturer</span>
                                <span class="value">{device?.manufacturer || '-'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Hardware ID</span>
                                <span class="value">{device?.hardwareId || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="details-column">
                    <!-- Network Information Card -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <div class="icon-wrap">
                                <Wifi size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Network Information</h4>
                                <p>Connection, signal strength, and IP details</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">Connection Status</span>
                                <Badge 
                                    label={isOnline ? 'Online' : 'Offline'} 
                                    color={isOnline ? 'success' : 'gray'}
                                    size="sm"
                                    showDot={true}
                                />
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Last Seen</span>
                                <span class="value">{formatLastSeen(device?.disconnectedAt || device?.connectedAt)}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Network Interface</span>
                                <span class="value">{deviceInfo?.network_interface || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Wi-Fi SSID</span>
                                <span class="value">{deviceInfo?.wifi_ssid || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Signal Strength</span>
                                <span class="value">{deviceInfo?.signal_strength_dbm ? `${deviceInfo.signal_strength_dbm} dBm` : 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Public IP</span>
                                <span class="value">{deviceInfo?.public_ip || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Private IP</span>
                                <span class="value">{deviceInfo?.private_ip || device?.ipAddress || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">LAN MAC</span>
                                <span class="value">{deviceInfo?.mac_lan || device?.lanMac || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Wi-Fi MAC</span>
                                <span class="value">{deviceInfo?.mac_wifi || device?.wifiMac || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Primary MAC</span>
                                <span class="value">{device?.macAddress || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Security Card -->
                    <div class="info-card security-card">
                        <div class="info-card-header">
                            <div class="icon-wrap">
                                <Shield size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Security</h4>
                                <p>API keys, licenses, and security settings</p>
                            </div>
                            <button class="generate-key-btn" on:click={handleGenerateApiKey} disabled={isGeneratingKey}>
                                <RefreshCw size={16} class={isGeneratingKey ? 'animate-spin' : ''} />
                                <span>{isGeneratingKey ? 'Generating...' : 'Generate New Key'}</span>
                            </button>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">API Key</span>
                                <div class="api-key-value">
                                    <span class="api-key-text">{formatApiKey(device?.apiKey)}</span>
                                    {#if device?.apiKey}
                                        <button class="icon-btn" on:click={copyApiKey} title="Copy API Key">
                                            <Copy size={16} />
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        {:else if activeTab === 'configuration'}
            <div class="config-card">
                <!-- Header -->
                <div class="config-header">
                    <div class="icon-wrap">
                        <Settings2 size={20} color="#A3A3A3" />
                    </div>
                    <div class="header-text">
                        <h4>Device Configuration</h4>
                        <p>Configuration setup of this device</p>
                    </div>
                </div>

                <!-- Kiosk Settings Section -->
                <div class="config-table-wrap">
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Kiosk Lock Mode</span>
                                <span class="cell-desc">Enable kiosk mode to lock the device interface</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('kiosk_lock_mode', 'Disable')}</span>
                        </div>
                    </div>
                    <div class="config-row last">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Kiosk Application</span>
                                <span class="cell-desc">Application to run in kiosk mode</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <div class="cell-content">
                                <span class="cell-value">{getProfileSetting('kiosk_app_name', '-')}</span>
                                <span class="cell-desc">{getProfileSetting('kiosk_app_package', '-')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Display Settings Section -->
                <div class="config-table-wrap">
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Display Resolution</span>
                                <span class="cell-desc">Screen resolution for device</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('display_resolution', deviceInfo?.resolution || '-')}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Screen Orientation</span>
                                <span class="cell-desc">Screen orientation preference</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('screen_orientation', deviceInfo?.orientation || '-')}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Brightness Level</span>
                                <span class="cell-desc">Screen brightness level (0-100%)</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('brightness', '-')}{getProfileSetting('brightness', '') ? '%' : ''}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Audio</span>
                                <span class="cell-desc">Enable or disable audio output</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('audio_enabled', '-')}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Audio Volume</span>
                                <span class="cell-desc">Audio volume level (0-100%)</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('volume', '-')}{getProfileSetting('volume', '') ? '%' : ''}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Timezone</span>
                                <span class="cell-desc">Device timezone settings</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{getProfileSetting('timezone', deviceInfo?.timezone || '-')}</span>
                        </div>
                    </div>
                    <div class="config-row last">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Home/ Launcher</span>
                                <span class="cell-desc">Default home screen launcher</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <div class="launcher-value">
                                <span class="cell-value">{getProfileSetting('launcher_package', '-')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Schedule Settings Section -->
                <div class="config-table-wrap">
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Power Management Schedule</span>
                                <span class="cell-desc">Enable scheduled power on/off times</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{data.deviceProfile?.powerScheduleEnabled ? 'Enable' : 'Disable'}</span>
                        </div>
                    </div>
                    <div class="config-row">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Reboot Schedule</span>
                                <span class="cell-desc">Enable scheduled device reboots</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{data.deviceProfile?.rebootScheduleEnabled ? 'Enable' : 'Disable'}</span>
                        </div>
                    </div>
                    <div class="config-row last">
                        <div class="config-cell label-cell">
                            <div class="cell-content">
                                <span class="cell-title">Download Schedule</span>
                                <span class="cell-desc">Enable scheduled content downloads</span>
                            </div>
                        </div>
                        <div class="config-cell value-cell">
                            <span class="cell-value">{data.deviceProfile?.downloadScheduleEnabled ? 'Enable' : 'Disable'}</span>
                        </div>
                    </div>
                </div>
            </div>

        {:else if activeTab === 'apps'}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="apps-card" on:click={handleClickOutside}>
                <div class="apps-header">
                    <div class="apps-icon-wrap">
                        <Server size={20} color="#A3A3A3" />
                    </div>
                    <div class="apps-header-text">
                        <h4>Installed Apps</h4>
                        <p>List of installed apps. Pinned apps are shown first.</p>
                    </div>
                    <button class="install-app-btn" on:click={() => toast.info('Install New App feature coming soon')}>
                        <Plus size={20} color="#026AA2" />
                        <span>Install New App</span>
                    </button>
                </div>
                
                {#if appsLoading}
                    <div class="apps-loading">
                        <div class="loading-spinner"></div>
                        <span>Loading apps...</span>
                    </div>
                {:else if appsError}
                    <div class="apps-error">
                        <p>{appsError}</p>
                        <Button variant="filled" color="danger" size="sm" on:click={loadApps}>Retry</Button>
                    </div>
                {:else if apps.length === 0}
                    <div class="apps-empty">
                        <Package size={48} color="#D6D6D6" />
                        <p>No apps installed on this device</p>
                    </div>
                {:else}
                    <div class="apps-table-wrap">
                        <table class="apps-table">
                            <thead>
                                <tr>
                                    <th class="col-pin"></th>
                                    <th class="col-company">Company</th>
                                    <th class="col-type">Type</th>
                                    <th class="col-version">Version</th>
                                    <th class="col-size">Size</th>
                                    <th class="col-installed">Installed On</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each apps as app (app.package_name)}
                                    <tr>
                                        <td class="col-pin">
                                            <button 
                                                class="pin-btn" 
                                                class:pinned={app.is_pinned}
                                                on:click={() => togglePinApp(app)}
                                                title={app.is_pinned ? 'Remove pinned app' : 'Pinup app'}
                                            >
                                                {#if app.is_pinned}
                                                    <Pin size={20} fill="#424242" color="#424242" />
                                                {:else}
                                                    <Pin size={20} color="#737373" />
                                                {/if}
                                            </button>
                                        </td>
                                        <td class="col-company">
                                            <div class="app-details">
                                                <span class="app-name">{app.app_name}</span>
                                                <span class="app-package">{app.package_name}</span>
                                            </div>
                                        </td>
                                        <td class="col-type">{app.app_type}</td>
                                        <td class="col-version">{app.version}</td>
                                        <td class="col-size">{formatBytes(app.size_bytes)}</td>
                                        <td class="col-installed">{formatInstallDate(app.install_date || app.last_modified)}</td>
                                        <td class="col-actions">
                                            <div class="actions-wrapper">
                                                <button 
                                                    class="action-menu-btn"
                                                    on:click|stopPropagation={() => toggleAppMenu(app.package_name)}
                                                >
                                                    <MoreVertical size={20} color="#292929" />
                                                </button>
                                                {#if activeAppMenu === app.package_name}
                                                    <div class="app-actions-menu">
                                                        <button on:click={() => handleRestartApp(app)}>
                                                            <RotateCcw size={16} />
                                                            Restart App
                                                        </button>
                                                        <button on:click={() => handleAppSettings(app)}>
                                                            <Settings size={16} />
                                                            App Settings
                                                        </button>
                                                        <button 
                                                            class="uninstall-btn"
                                                            on:click={() => handleUninstallApp(app)}
                                                            disabled={app.is_system_app}
                                                        >
                                                            <Trash2 size={16} />
                                                            Uninstall App
                                                        </button>
                                                    </div>
                                                {/if}
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Pagination -->
                    <div class="apps-pagination">
                        <span class="pagination-info">
                            {((appsCurrentPage - 1) * appsPageSize) + 1} - {Math.min(appsCurrentPage * appsPageSize, appsTotalCount)} of {appsTotalCount}
                        </span>
                        <div class="pagination-controls">
                            <button 
                                class="pagination-btn"
                                disabled={appsCurrentPage === 1}
                                on:click={() => { appsCurrentPage--; loadApps(); }}
                            >
                                <ChevronLeft size={20} color="#292929" />
                            </button>
                            <span class="page-number">{appsCurrentPage}</span>
                            <button 
                                class="pagination-btn"
                                disabled={appsCurrentPage >= appsTotalPages}
                                on:click={() => { appsCurrentPage++; loadApps(); }}
                            >
                                <ChevronRight size={20} color="#292929" />
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

        {:else if activeTab === 'deployments'}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="deployments-card" on:click={() => activeDeploymentMenu = null}>
                <div class="deployments-header">
                    <div class="deployments-icon-wrap">
                        <GitFork size={20} color="#A3A3A3" />
                    </div>
                    <div class="deployments-header-text">
                        <h4>Bulk Deployments</h4>
                        <p>Configuration setup of this device</p>
                    </div>
                </div>
                
                {#if deploymentsLoading}
                    <div class="deployments-loading">
                        <div class="loading-spinner"></div>
                        <span>Loading deployments...</span>
                    </div>
                {:else if deployments.length === 0}
                    <div class="deployments-empty">
                        <GitFork size={48} color="#D6D6D6" />
                        <p>No deployments found for this device</p>
                    </div>
                {:else}
                    <div class="deployments-table-wrap">
                        <table class="deployments-table">
                            <thead>
                                <tr>
                                    <th class="dep-col-name">Deployment Name</th>
                                    <th class="dep-col-version">Version</th>
                                    <th class="dep-col-started">Started On</th>
                                    <th class="dep-col-ended">Ended On</th>
                                    <th class="dep-col-status">Status</th>
                                    <th class="dep-col-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each deployments as deployment (deployment.id)}
                                    <tr>
                                        <td class="dep-col-name">{deployment.name}</td>
                                        <td class="dep-col-version">{deployment.version}</td>
                                        <td class="dep-col-started">{formatDeploymentDate(deployment.startedOn)}</td>
                                        <td class="dep-col-ended">{formatDeploymentDate(deployment.endedOn)}</td>
                                        <td class="dep-col-status">
                                            <span 
                                                class="status-badge"
                                                style="background: {getDeploymentStatusColor(deployment.status).bg};"
                                            >
                                                <span 
                                                    class="status-dot"
                                                    style="background: {getDeploymentStatusColor(deployment.status).dot};"
                                                ></span>
                                                <span style="color: {getDeploymentStatusColor(deployment.status).text};">
                                                    {deployment.status}
                                                </span>
                                            </span>
                                        </td>
                                        <td class="dep-col-action">
                                            <div class="dep-actions-wrapper">
                                                <button 
                                                    class="dep-action-menu-btn"
                                                    on:click|stopPropagation={() => toggleDeploymentMenu(deployment.id)}
                                                >
                                                    <MoreVertical size={20} color="#292929" />
                                                </button>
                                                {#if activeDeploymentMenu === deployment.id}
                                                    <div class="dep-actions-menu">
                                                        {#each getDeploymentActions(deployment.status) as actionItem}
                                                            <button 
                                                                style={actionItem.color ? `color: ${actionItem.color}` : ''}
                                                                on:click={() => handleDeploymentAction(deployment, actionItem.action)}
                                                            >
                                                                {actionItem.label}
                                                            </button>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Pagination -->
                    <div class="deployments-pagination">
                        <span class="dep-pagination-info">
                            {((deploymentsCurrentPage - 1) * deploymentsPageSize) + 1} - {Math.min(deploymentsCurrentPage * deploymentsPageSize, deploymentsTotalCount)} of {deploymentsTotalCount}
                        </span>
                        <div class="dep-pagination-controls">
                            <button 
                                class="dep-pagination-btn"
                                disabled={deploymentsCurrentPage === 1}
                                on:click={() => { deploymentsCurrentPage = 1; loadDeployments(); }}
                            >
                                <ChevronsLeft size={20} color="#292929" />
                            </button>
                            <button 
                                class="dep-pagination-btn"
                                disabled={deploymentsCurrentPage === 1}
                                on:click={() => { deploymentsCurrentPage--; loadDeployments(); }}
                            >
                                <ChevronLeft size={20} color="#292929" />
                            </button>
                            <div class="dep-page-numbers">
                                <span class="dep-page-number active">1</span>
                                <span class="dep-page-number">2</span>
                                <span class="dep-page-ellipsis">...</span>
                                <span class="dep-page-number">9</span>
                                <span class="dep-page-number">10</span>
                            </div>
                            <button 
                                class="dep-pagination-btn"
                                disabled={deploymentsCurrentPage >= deploymentsTotalPages}
                                on:click={() => { deploymentsCurrentPage++; loadDeployments(); }}
                            >
                                <ChevronRight size={20} color="#292929" />
                            </button>
                            <button 
                                class="dep-pagination-btn"
                                disabled={deploymentsCurrentPage >= deploymentsTotalPages}
                                on:click={() => { deploymentsCurrentPage = deploymentsTotalPages; loadDeployments(); }}
                            >
                                <ChevronsRight size={20} color="#292929" />
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

        {:else if activeTab === 'activity'}
            <div class="activity-card">
                <div class="info-card-header">
                    <div class="icon-wrap">
                        <History size={20} color="#A3A3A3" />
                    </div>
                    <div class="header-text">
                        <h4>Activity Logs</h4>
                        <p>History of all actions performed on this device.</p>
                    </div>
                </div>
                <div class="activity-body">
                    {#if activityLogsLoading}
                        <div class="loading-state">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p>Loading activity logs...</p>
                        </div>
                    {:else if activityLogs.length === 0}
                        <div class="empty-state">
                            <History size={48} color="#D6D6D6" />
                            <p>No activity logs found for this device.</p>
                        </div>
                    {:else}
                        <div class="activity-table-wrap">
                            <!-- Table Header -->
                            <div class="activity-table-header">
                                <div class="activity-header-cell activity-col-expand">
                                    <ChevronRight size={20} color="#525252" />
                                </div>
                                <div class="activity-header-cell activity-col-event">
                                    <span class="header-text">Date & Time</span>
                                </div>
                                <div class="activity-header-cell activity-col-description">
                                    <span class="header-text">Action Type</span>
                                </div>
                                <div class="activity-header-cell activity-col-status">
                                    <span class="header-text">Status</span>
                                </div>
                            </div>
                            
                            <!-- Table Body -->
                            {#each activityLogs as log (log.id)}
                                <!-- Main Row -->
                                <div class="activity-row" class:expanded={log.expanded}>
                                    <div class="activity-cell activity-col-expand">
                                        <button 
                                            class="expand-btn"
                                            on:click={() => toggleActivityLogExpansion(log.id)}
                                            disabled={!log.details || log.details.length === 0}
                                        >
                                            {#if log.expanded}
                                                <ChevronDown size={20} color="#737373" />
                                            {:else}
                                                <ChevronRight size={20} color="#737373" />
                                            {/if}
                                        </button>
                                    </div>
                                    <div class="activity-cell activity-col-event">
                                        <span class="event-name">{log.eventName}</span>
                                    </div>
                                    <div class="activity-cell activity-col-description">
                                        <span class="description-text">{log.description}</span>
                                    </div>
                                    <div class="activity-cell activity-col-status">
                                        {#if true}
                                            {@const statusColor = getActivityLogStatusColor(log.status)}
                                            <div class="status-badge" style="background: {statusColor.bg};">
                                                <span class="status-dot" style="background: {statusColor.dot};"></span>
                                                <span class="status-text" style="color: {statusColor.text};">{log.status}</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                
                                <!-- Expanded Details -->
                                {#if log.expanded && log.details && log.details.length > 0}
                                    <div class="activity-details-row">
                                        <div class="activity-details-spacer"></div>
                                        <div class="activity-details-divider">
                                            <div class="divider-line"></div>
                                        </div>
                                        <div class="activity-details-content">
                                            {#each log.details as detail}
                                                <div class="detail-item">
                                                    <span class="detail-label">{detail.label}</span>
                                                    {#if detail.oldValue}
                                                        <span class="detail-old-value">{detail.oldValue}</span>
                                                    {/if}
                                                    <ArrowRight size={20} color="#292929" />
                                                    {#if detail.tags && detail.tags.length > 0}
                                                        <div class="detail-tags">
                                                            {#each detail.tags as tag}
                                                                <span class="detail-tag">{tag}</span>
                                                            {/each}
                                                        </div>
                                                    {:else}
                                                        <span class="detail-new-value">{detail.newValue}</span>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                        
                        <!-- Pagination -->
                        <div class="activity-pagination">
                            <span class="pagination-details">{((activityLogsCurrentPage - 1) * activityLogsPageSize) + 1} - {Math.min(activityLogsCurrentPage * activityLogsPageSize, activityLogsTotalCount)} of {activityLogsTotalCount}</span>
                            <div class="pagination-controls">
                                <button 
                                    class="pagination-btn"
                                    on:click={() => { activityLogsCurrentPage = Math.max(1, activityLogsCurrentPage - 1); loadActivityLogs(); }} 
                                    disabled={activityLogsCurrentPage === 1}
                                >
                                    <ChevronLeft size={20} color="#292929" />
                                </button>
                                <div class="page-number">{activityLogsCurrentPage}</div>
                                <button 
                                    class="pagination-btn"
                                    on:click={() => { activityLogsCurrentPage = Math.min(activityLogsTotalPages, activityLogsCurrentPage + 1); loadActivityLogs(); }} 
                                    disabled={activityLogsCurrentPage === activityLogsTotalPages}
                                >
                                    <ChevronRight size={20} color="#292929" />
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Edit Device Modal (Figma) -->
<Modal
    open={showEditDeviceModal}
    title="Edit Device"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={false}
    closeOnEscape={true}
    showFooter={true}
    on:close={closeEditDeviceModal}
>
    <!-- Device Name Row with Active Toggle aligned to input -->
    <div class="w-full" style="margin-bottom: 24px;">
        <label 
            for="edit-device-name"
            style="display: block; font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #344054; margin-bottom: 6px;"
        >
            Device Name
        </label>
        <div class="flex items-center gap-4">
            <div class="flex-1">
                <input
                    id="edit-device-name"
                    type="text"
                    placeholder="Enter device name"
                    bind:value={editDeviceName}
                    style="
                        box-sizing: border-box;
                        width: 100%;
                        padding: 10px 14px;
                        height: 44px;
                        background: #FFFFFF;
                        border: 1px solid {editDeviceError ? '#FDA29B' : '#D0D5DD'};
                        border-radius: 8px;
                        font-family: var(--ds-font-family-primary);
                        font-size: 16px;
                        line-height: 24px;
                        color: #101828;
                        outline: none;
                    "
                    on:focus={(e) => e.currentTarget.style.borderColor = '#0086C9'}
                    on:blur={(e) => e.currentTarget.style.borderColor = editDeviceError ? '#FDA29B' : '#D0D5DD'}
                />
            </div>
            <div class="flex items-center gap-2">
                <Toggle
                    bind:checked={editDeviceActive}
                    size="sm"
                />
                <span style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929;">
                    Active
                </span>
            </div>
        </div>
    </div>

    <!-- Tabs -->
    <div style="margin-bottom: 24px; width: 100%;">
        <TabGroup
            tabs={editDeviceTabs}
            bind:activeTab={editActiveTab}
            type="underline"
            size="sm"
        />
    </div>

    <!-- Tab Content -->
    {#if editActiveTab === 'details'}
        <!-- Details Tab -->
        <div class="flex flex-col" style="width: 100%; gap: 24px;">
            <!-- Tag Dropdown -->
            <Dropdown
                label="Tag"
                placeholder="Select tags"
                multiple={true}
                searchable={true}
                options={editTagOptions}
                value={editDeviceTags}
                on:change={(e) => editDeviceTags = Array.isArray(e.detail) ? e.detail : [e.detail]}
            />

            <!-- Description -->
            <TextareaField
                label="Description"
                placeholder="Enter device description"
                bind:value={editDeviceDescription}
                rows={4}
            />
        </div>
    {:else}
        <!-- Configuration Tab -->
        <div class="flex flex-col gap-4" style="width: 100%; max-height: 500px; overflow-y: auto;">
            
            <!-- Assigned Profile Dropdown (standalone) -->
            <Dropdown
                label="Assigned Profile"
                placeholder="Select"
                options={[
                    { id: 'profile1', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile2', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile3', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile4', label: '<Value>', supportingText: '<Value>' }
                ]}
                value={editAssignedProfile}
                on:change={(e) => editAssignedProfile = String(e.detail)}
            />

            <!-- Block 1: Kiosk Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Kiosk Lock Mode -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Kiosk Lock Mode
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable kiosk mode to lock the device interface
                        </p>
                    </div>
                    <Toggle bind:checked={editKioskLockMode} size="sm" />
                </div>

                <!-- Exit Lockdown Password -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Exit Lockdown Password
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Password required to exit kiosk mode
                        </p>
                    </div>
                    <div class="relative" style="width: 200px;">
                        {#if editShowPassword}
                            <input
                                type="text"
                                bind:value={editExitLockdownPassword}
                                placeholder="******"
                                class="w-full"
                                style="
                                    box-sizing: border-box;
                                    padding: 10px 40px 10px 14px;
                                    height: 44px;
                                    background: #FFFFFF;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 8px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    outline: none;
                                "
                            />
                        {:else}
                            <input
                                type="password"
                                bind:value={editExitLockdownPassword}
                                placeholder="******"
                                class="w-full"
                                style="
                                    box-sizing: border-box;
                                    padding: 10px 40px 10px 14px;
                                    height: 44px;
                                    background: #FFFFFF;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 8px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    outline: none;
                                "
                            />
                        {/if}
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2"
                            on:click={() => editShowPassword = !editShowPassword}
                            style="background: none; border: none; cursor: pointer; padding: 0;"
                        >
                            {#if editShowPassword}
                                <EyeOff size={20} color="#737373" />
                            {:else}
                                <Eye size={20} color="#737373" />
                            {/if}
                        </button>
                    </div>
                </div>

                <!-- Kiosk Application -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Kiosk Application
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Application to run in kiosk mode
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="<App Name>"
                            options={[
                                { id: 'app1', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app2', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app3', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app4', label: '<Value>', supportingText: '<Value>' }
                            ]}
                            value={editKioskApplication}
                            on:change={(e) => editKioskApplication = String(e.detail)}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 2: Display Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Display Resolution -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Display Resolution
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen resolution for device
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: '640x480', label: '640x480' },
                                { id: '800x600', label: '800x600' },
                                { id: '1024x768', label: '1024x768' },
                                { id: '1152x864', label: '1152x864' }
                            ]}
                            value={editDisplayResolution}
                            on:change={(e) => editDisplayResolution = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Screen Orientation -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Screen Orientation
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen orientation preference
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: 'Portrait', label: 'Portrait' },
                                { id: 'Landscape', label: 'Landscape' }
                            ]}
                            value={editScreenOrientation}
                            on:change={(e) => editScreenOrientation = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Brightness Level -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Brightness Level
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen brightness level (0-100%)
                        </p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editBrightnessLevel}
                            class="config-slider"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #344054 0%, #344054 {editBrightnessLevel}%, #E5E5E5 {editBrightnessLevel}%, #E5E5E5 100%); border-radius: 4px; outline: none;"
                        />
                        <div class="flex items-center gap-1" style="min-width: 70px;">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editBrightnessLevel}
                                style="
                                    width: 50px;
                                    padding: 6px 8px;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 6px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    text-align: center;
                                    background: #FFFFFF;
                                "
                            />
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #737373;">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 3: Audio Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Audio -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Audio
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable or disable audio output
                        </p>
                    </div>
                    <Toggle bind:checked={editAudioEnabled} size="sm" />
                </div>

                <!-- Audio Volume -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Audio Volume
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Audio volume level (0-100%)
                        </p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editAudioVolume}
                            class="config-slider"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #344054 0%, #344054 {editAudioVolume}%, #E5E5E5 {editAudioVolume}%, #E5E5E5 100%); border-radius: 4px; outline: none;"
                        />
                        <div class="flex items-center gap-1" style="min-width: 70px;">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editAudioVolume}
                                style="
                                    width: 50px;
                                    padding: 6px 8px;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 6px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    text-align: center;
                                    background: #FFFFFF;
                                "
                            />
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #737373;">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 4: System Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Timezone -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Timezone
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Device timezone settings
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: 'Asia/Ho_Chi_Minh', label: '<Value>', supportingText: '<Value>' },
                                { id: 'Asia/Bangkok', label: '<Value>', supportingText: '<Value>' },
                                { id: 'Asia/Singapore', label: '<Value>', supportingText: '<Value>' },
                                { id: 'UTC', label: '<Value>', supportingText: '<Value>' }
                            ]}
                            value={editTimezone}
                            on:change={(e) => editTimezone = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Home/Launcher -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Home/ Launcher
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Default home screen launcher
                        </p>
                    </div>
                    <div style="width: 64px; height: 64px; background: #FFFFFF; border: 1px solid #EAECF0; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        {#if editHomeLauncher}
                            <img src={editHomeLauncher} alt="Launcher" style="width: 100%; height: 100%; object-fit: cover;" />
                        {:else}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#98A2B3" stroke-width="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5" fill="#98A2B3"/>
                                <path d="M21 15L16 10L5 21" stroke="#98A2B3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Block 5: Schedule Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Power Management Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Power Management Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled power on/off times
                        </p>
                    </div>
                    <Toggle bind:checked={editPowerManagementSchedule} size="sm" />
                </div>

                <!-- Reboot Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Reboot Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled device reboots
                        </p>
                    </div>
                    <Toggle bind:checked={editRebootSchedule} size="sm" />
                </div>

                <!-- Download Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Download Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled content downloads
                        </p>
                    </div>
                    <Toggle bind:checked={editDownloadSchedule} size="sm" />
                </div>
            </div>
        </div>
    {/if}

    <!-- Error Message -->
    {#if editDeviceError}
        <div style="margin-top: 16px;">
            <Alert severity="error" variant="outline" message={editDeviceError} />
        </div>
    {/if}

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px;"
            on:click={closeEditDeviceModal}
            disabled={editDeviceLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={saveEditDevice}
            disabled={editDeviceLoading || !editDeviceName.trim()}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {editDeviceLoading ? 'Saving…' : 'Save'}
        </Button>
    </div>
</Modal>

<!-- Pull File Modal -->
<Modal
    open={showPullFileModal}
    title="Pull File"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => showPullFileModal = false}
>
    <!-- Source File Path Input - Using InputField from design-system -->
    <div class="flex flex-col gap-4 w-full">
        <InputField
            id="pull-file-source"
            label="Source File Path on Device"
            placeholder="eg: /home/user/documents/file.txt"
            bind:value={pullFileSourcePath}
            required={true}
        />

        <!-- Info Box - Styled to match design-system -->
        <div class="pull-file-info-box">
            <div class="pull-file-info-header">
                <Info size={20} color="#525252" />
                <span class="pull-file-info-title">File Transfer Information</span>
            </div>
            <ul class="pull-file-info-list">
                <li>The file will be streamed from the device to the server</li>
                <li>Large files may take several minutes to transfer</li>
                <li>You can monitor progress in the action logs</li>
                <li>The file will be saved to the server's resource storage</li>
            </ul>
        </div>
    </div>

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            on:click={() => showPullFileModal = false}
            disabled={pullFileLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={executePullFile}
            disabled={pullFileLoading || !pullFileSourcePath.trim()}
            loading={pullFileLoading}
        >
            {pullFileLoading ? 'Pulling…' : 'Pull File'}
        </Button>
    </div>
</Modal>

<!-- Push File Modal -->
<Modal
    open={showPushFileModal}
    title="Push File"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={false}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => showPushFileModal = false}
>
    <div class="flex flex-col gap-4 w-full">
        <!-- Destination Path Input - Using InputField from design-system -->
        <InputField
            id="push-file-destination"
            label="Destination Path on Device"
            placeholder="eg: /home/user/downloads/"
            bind:value={pushFileDestinationPath}
            required={true}
        />

        <!-- Search Input - Using InputField with suffix icon -->
        <InputField
            id="push-file-search"
            type="search"
            placeholder="Search files"
            bind:value={pushFileSearchTerm}
            suffixIcon={true}
            on:input={() => { pushFileCurrentPage = 1; loadPushFileResources(); }}
        >
            <Search slot="suffix-icon" size={22} color="#292929" />
        </InputField>

        <!-- File List - Using Radio from design-system -->
        <div class="flex flex-col gap-2" style="max-height: 300px; overflow-y: auto;">
            {#if pushFileResourcesLoading}
                <div class="flex items-center justify-center py-8">
                    <span style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; color: #737373;">Loading files...</span>
                </div>
            {:else if pushFileResources.length === 0}
                <div class="flex items-center justify-center py-8">
                    <span style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; color: #737373;">No files found</span>
                </div>
            {:else}
                {#each pushFileResources as resource}
                    <button
                        type="button"
                        class="push-file-item"
                        class:selected={pushFileSelectedResourceId === resource.id}
                        on:click={() => pushFileSelectedResourceId = resource.id}
                    >
                        <div class="push-file-item-content">
                            <!-- Radio indicator -->
                            <div class="push-file-radio" class:checked={pushFileSelectedResourceId === resource.id}>
                                {#if pushFileSelectedResourceId === resource.id}
                                    <div class="push-file-radio-dot"></div>
                                {/if}
                            </div>
                            
                            <!-- File info -->
                            <div class="push-file-info">
                                <span class="push-file-name">{resource.name}</span>
                                <span class="push-file-package">{resource.packageName || '-'}</span>
                            </div>
                            
                            <!-- Meta info -->
                            <div class="push-file-meta">
                                <div class="push-file-meta-item">
                                    <span class="push-file-meta-label">Version</span>
                                    <span class="push-file-meta-value">{resource.version || '-'}</span>
                                </div>
                                <div class="push-file-meta-item">
                                    <span class="push-file-meta-label">Size</span>
                                    <span class="push-file-meta-value">{formatFileSize(resource.size)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="push-file-created">
                            Created On: {formatInstallDate(resource.createdAt)}
                        </div>
                    </button>
                {/each}
            {/if}
        </div>

        <!-- Pagination -->
        {#if pushFileTotalPages > 1}
            <div class="push-file-pagination">
                <span class="push-file-pagination-text">
                    {(pushFileCurrentPage - 1) * pushFilePageSize + 1} - {Math.min(pushFileCurrentPage * pushFilePageSize, pushFileTotalCount)} of {pushFileTotalCount}
                </span>
                <div class="push-file-pagination-controls">
                    <button
                        type="button"
                        class="push-file-pagination-btn"
                        disabled={pushFileCurrentPage === 1}
                        on:click={() => { pushFileCurrentPage = 1; loadPushFileResources(); }}
                    >
                        <ChevronsLeft size={20} color={pushFileCurrentPage === 1 ? '#A3A3A3' : '#292929'} />
                    </button>
                    <button
                        type="button"
                        class="push-file-pagination-btn"
                        disabled={pushFileCurrentPage === 1}
                        on:click={() => { pushFileCurrentPage--; loadPushFileResources(); }}
                    >
                        <ChevronLeft size={20} color={pushFileCurrentPage === 1 ? '#A3A3A3' : '#292929'} />
                    </button>
                    <div class="push-file-pagination-current">
                        <span>{pushFileCurrentPage}</span>
                    </div>
                    <button
                        type="button"
                        class="push-file-pagination-btn"
                        disabled={pushFileCurrentPage === pushFileTotalPages}
                        on:click={() => { pushFileCurrentPage++; loadPushFileResources(); }}
                    >
                        <ChevronRight size={20} color={pushFileCurrentPage === pushFileTotalPages ? '#A3A3A3' : '#292929'} />
                    </button>
                    <button
                        type="button"
                        class="push-file-pagination-btn"
                        disabled={pushFileCurrentPage === pushFileTotalPages}
                        on:click={() => { pushFileCurrentPage = pushFileTotalPages; loadPushFileResources(); }}
                    >
                        <ChevronsRight size={20} color={pushFileCurrentPage === pushFileTotalPages ? '#A3A3A3' : '#292929'} />
                    </button>
                </div>
            </div>
        {/if}
    </div>

    <!-- Footer - Using Modal's default footer slot -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            on:click={() => showPushFileModal = false}
            disabled={pushFileLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={executePushFile}
            disabled={pushFileLoading || !pushFileSelectedResourceId || !pushFileDestinationPath.trim()}
            loading={pushFileLoading}
        >
            {pushFileLoading ? 'Pushing…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<!-- Update Firmware Modal (Figma - 880px width, matching listing page) -->
<Modal
    open={showUpdateFirmwareModal}
    title="Update Firmware"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.05)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showUpdateFirmwareModal = false)}
>
    <!-- Search Input -->
    <div class="w-full" style="margin-bottom: 16px;">
        <div 
            class="flex items-center"
            style="
                box-sizing: border-box;
                width: 100%;
                height: 48px;
                padding: 12px 14px;
                background: #FEFEFE;
                border: 1px solid #D6D6D6;
                border-radius: 8px;
                gap: 12px;
            "
        >
            <input
                type="text"
                placeholder="Search and select firmware"
                bind:value={updateFirmwareSearch}
                on:input={() => updateFirmwarePage = 1}
                class="flex-1"
                style="
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: var(--ds-font-family-primary);
                    font-size: 16px;
                    line-height: 24px;
                    color: #292929;
                "
            />
            <Search size={22} color="#292929" />
        </div>
    </div>

    <!-- Firmware List with Radio Buttons -->
    <div class="w-full flex flex-col" style="gap: 8px; max-height: 350px; overflow-y: auto;">
        {#if updateFirmwareOptionsLoading}
            <div class="px-4 py-8 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; background: #FAFAFA; border-radius: 6px;">
                Loading firmware...
            </div>
        {:else}
            {#each updateFirmwarePaginatedOptions as firmware (firmware.id)}
                {@const isSelected = updateFirmwareSelected === firmware.id}
                <button
                    type="button"
                    class="w-full flex flex-col hover:opacity-90 transition-opacity"
                    style="
                        padding: 12px 16px;
                        border: {isSelected ? '2px solid #0BA5EC' : 'none'};
                        background: #FAFAFA;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        gap: 4px;
                    "
                    on:click={() => selectFirmware(firmware.id)}
                >
                    <!-- Main Row: Radio + Name/Package + Version + Size -->
                    <div class="flex items-start w-full">
                        <!-- Radio Button -->
                        <div 
                            class="flex items-center justify-center flex-shrink-0"
                            style="
                                width: 20px;
                                height: 20px;
                                border-radius: 50%;
                                border: 1px solid {isSelected ? '#141414' : '#D6D6D6'};
                                background: #FFFFFF;
                                margin-right: 12px;
                                margin-top: 2px;
                            "
                        >
                            {#if isSelected}
                                <div style="width: 10px; height: 10px; border-radius: 50%; background: #141414;"></div>
                            {/if}
                        </div>
                        
                        <!-- Name + Package Name (flex: 1) -->
                        <div class="flex flex-col" style="flex: 1; min-width: 0; gap: 2px;">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 16px; line-height: 24px; font-weight: 500; color: #292929;">
                                {firmware.name}
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                                {firmware.packageName}
                            </span>
                        </div>
                        
                        <!-- Version Column (fixed width) -->
                        <div class="flex flex-col flex-shrink-0" style="width: 120px; padding-left: 16px;">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                                Version
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #141414;">
                                {firmware.version}
                            </span>
                        </div>
                        
                        <!-- Size Column (fixed width) -->
                        <div class="flex flex-col flex-shrink-0" style="width: 100px; padding-left: 16px;">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                                Size
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #141414;">
                                {firmware.size}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Created On Row -->
                    <div class="flex items-center" style="padding-left: 32px;">
                        <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; letter-spacing: 0.01em; color: #667085;">
                            Created On: {firmware.createdOn}
                        </span>
                    </div>
                </button>
            {/each}
            {#if updateFirmwarePaginatedOptions.length === 0}
                <div class="px-4 py-8 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; background: #FAFAFA; border-radius: 6px;">
                    No firmware found
                </div>
            {/if}
        {/if}
    </div>

    <!-- Pagination -->
    {#if updateFirmwareFilteredOptions.length > 0}
        <div 
            class="flex items-center justify-end w-full" 
            style="
                padding: 8px 0;
                gap: 8px;
                border-top: 1px solid #EAECF0;
                margin-top: 16px;
            "
        >
            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #525252;">
                {(updateFirmwarePage - 1) * updateFirmwarePerPage + 1} - {Math.min(updateFirmwarePage * updateFirmwarePerPage, updateFirmwareFilteredOptions.length)} of {updateFirmwareFilteredOptions.length}
            </span>
            <div class="flex items-center" style="gap: 2px;">
                <!-- First Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = 1}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage === 1 ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 14L7 10L11 6" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M15 14L11 10L15 6" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Previous Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = Math.max(1, updateFirmwarePage - 1)}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage === 1 ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 15L7.5 10L12.5 5" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Current Page -->
                <div 
                    class="flex items-center justify-center"
                    style="
                        width: 40px;
                        height: 40px;
                        background: #F9FAFB;
                        border-radius: 8px;
                    "
                >
                    <span style="font-family: var(--ds-font-family-primary); font-size: 14px; font-weight: 500; line-height: 20px; color: #1D2939;">
                        {updateFirmwarePage}
                    </span>
                </div>
                <!-- Next Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = Math.min(updateFirmwareTotalPages, updateFirmwarePage + 1)}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage >= updateFirmwareTotalPages ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 15L12.5 10L7.5 5" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Last Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = updateFirmwareTotalPages}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage >= updateFirmwareTotalPages ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 14L13 10L9 6" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5 14L9 10L5 6" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    {/if}

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px; background: #FFFFFF; border: 1px solid #0BA5EC; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
            on:click={() => (showUpdateFirmwareModal = false)}
            disabled={updateFirmwareLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmUpdateFirmware}
            disabled={updateFirmwareLoading || !updateFirmwareSelected}
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {updateFirmwareLoading ? 'Updating…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<style>
    .device-details-page {
        display: flex;
        flex-direction: column;
        padding: 24px;
        gap: 16px;
        font-family: var(--ds-font-family-primary);
        background: #F9FAFB;
        min-height: 100%;
    }

    /* Edit Button */
    .edit-button-wrapper {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 8px;
    }

    .edit-device-btn {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        height: 40px;
        background: #0086C9;
        border: 1px solid #0086C9;
        border-radius: 8px;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .edit-device-btn:hover {
        background: #0077B3;
        border-color: #0077B3;
    }

    .edit-device-btn :global(svg) {
        color: #FFFFFF;
    }

    .edit-device-btn span {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #FFFFFF;
    }

    /* Header Section */
    .header-section {
        display: flex;
        flex-direction: row;
        gap: 16px;
        width: 100%;
    }

    /* Device Health Card */
    .device-health-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
        flex: 1;
        min-width: 0;
    }

    .card-header {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 8px;
        border-bottom: 1px solid #E5E5E5;
    }

    .icon-button {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 12px;
        width: 44px;
        height: 44px;
        border-radius: 8px;
    }

    .content-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
    }

    .card-title {
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }

    .card-subtitle {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }

    /* Metrics Row */
    .details-wrap {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 16px;
    }

    .metric-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
    }

    .metric-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .metric-value {
        font-weight: 600;
        font-size: 26px;
        line-height: 32px;
        letter-spacing: -0.005em;
    }

    /* Quick Actions */
    .quick-actions {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: 16px;
        gap: 16px;
        border-top: 1px solid #E5E5E5;
    }

    .action-btn {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        gap: 8px;
        min-width: 100px;
        height: 40px;
        background: #FFFFFF;
        border: 1px solid #D6D6D6;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .action-btn:hover {
        background: #F5F5F5;
        border-color: #A3A3A3;
    }

    .action-btn span {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #424242;
    }

    .action-btn :global(svg) {
        color: #424242;
    }

    .action-btn.destructive {
        border: 1px solid #FDA29B;
    }

    .action-btn.destructive span {
        color: #B42318;
    }

    .action-btn.destructive :global(svg) {
        color: #B42318;
    }

    .action-btn.destructive:hover {
        background: #FEF3F2;
    }

    /* General Card */
    .general-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
        width: 426px;
        flex-shrink: 0;
    }

    .general-content {
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
    }

    .info-row {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }

    .info-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .info-value {
        display: flex;
        align-items: center;
    }

    .info-value-text {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        text-align: right;
    }

    /* Tabs Wrapper */
    .tabs-wrapper {
        margin-top: 8px;
    }

    /* Tab Content */
    .tab-content {
        margin-top: 16px;
    }

    /* Details Grid - 2 columns layout */
    .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .details-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* Info Card */
    .info-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
    }

    .info-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 12px;
        border-bottom: 1px solid #E5E5E5;
    }

    .icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
    }

    .header-text {
        flex: 1;
        min-width: 0;
    }

    .header-text h4 {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }

    .header-text p {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }

    .info-card-body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }

    .info-row-detail {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        min-height: 44px;
    }

    .info-row-detail .label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .info-row-detail .value {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        text-align: right;
    }

    .info-row-detail .value.link {
        color: #0086C9;
        text-decoration: none;
    }

    .info-row-detail .value.link:hover {
        text-decoration: underline;
    }

    /* Connection Status Text Style (used in Action History) */
    .status-text {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
    }

    .info-row-detail.description {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 16px;
    }

    .description-text {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        margin: 0;
    }

    .tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 16px 16px;
    }

    /* Security Card */
    .security-card .info-card-header {
        flex-wrap: wrap;
    }

    .generate-key-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: #0086C9;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        border-radius: 6px;
    }

    .generate-key-btn:hover {
        background: #F0F9FF;
    }

    .api-key-value {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .api-key-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
    }

    .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: transparent;
        border: none;
        color: #A3A3A3;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.15s ease;
    }

    .icon-btn:hover {
        background: #F5F5F5;
        color: #424242;
    }

    .generate-key-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .generate-key-btn :global(.animate-spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* Configuration Card */
    .config-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        gap: 16px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
    }

    .config-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 0;
        gap: 8px;
        width: 100%;
    }

    .config-table-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        background: #FAFAFA;
        border-radius: 8px;
    }

    .config-row {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: 0;
        width: 100%;
    }

    .config-row:not(.last) .config-cell {
        border-bottom: 1px solid #EAECF0;
    }

    .config-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 16px;
        min-height: 72px;
    }

    .config-cell.label-cell {
        flex: 1;
        min-width: 0;
    }

    .config-cell.value-cell {
        width: 400px;
        flex-shrink: 0;
    }

    .config-cell .cell-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0;
    }

    .config-cell .cell-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
    }

    .config-cell .cell-desc {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #737373;
    }

    .config-cell .cell-value {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
    }

    .launcher-value {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
    }

    .launcher-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
    }

    .launcher-link {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #004EEB;
        text-decoration: none;
    }

    .launcher-link:hover {
        text-decoration: underline;
    }

    /* Apps Card */
    .apps-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
    }
    
    .apps-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 0;
        gap: 8px;
    }
    
    .apps-icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 12px;
        width: 44px;
        height: 44px;
        border-radius: 8px;
    }
    
    .apps-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
    }
    
    .apps-header-text h4 {
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    
    .apps-header-text p {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    
    .install-app-btn {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        gap: 8px;
        min-width: 100px;
        height: 40px;
        background: #FFFFFF;
        border: 1px solid #0BA5EC;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .install-app-btn:hover {
        background: #F0F9FF;
    }
    
    .install-app-btn span {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #026AA2;
    }
    
    .apps-loading,
    .apps-error,
    .apps-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        gap: 16px;
    }
    
    .apps-loading span,
    .apps-error p,
    .apps-empty p {
        font-size: 14px;
        color: #737373;
        margin: 0;
    }
    
    .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #E5E5E5;
        border-top-color: #0086C9;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .apps-table-wrap {
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border-radius: 9px;
        overflow: hidden;
    }
    
    .apps-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .apps-table thead {
        background: #F5F5F5;
    }
    
    .apps-table th {
        padding: 12px 16px;
        text-align: left;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        border-bottom: 1px solid #EAECF0;
    }
    
    .apps-table td {
        padding: 16px;
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        border-bottom: 1px solid #EAECF0;
        vertical-align: middle;
        background: #FFFFFF;
    }
    
    .apps-table tbody tr:last-child td {
        border-bottom: 1px solid #EAECF0;
    }
    
    .col-pin {
        width: 52px;
        padding: 16px !important;
    }
    
    .col-pin.apps-table th {
        padding: 12px 24px !important;
    }
    
    .col-company {
        min-width: 400px;
    }
    
    .col-type {
        width: 150px;
    }
    
    .col-version {
        width: 100px;
    }
    
    .col-size {
        width: 100px;
    }
    
    .col-installed {
        width: 200px;
    }
    
    .col-actions {
        width: 78px;
        text-align: center;
    }
    
    .pin-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .pin-btn:hover {
        opacity: 0.7;
    }
    
    .app-details {
        display: flex;
        flex-direction: column;
        gap: 0;
    }
    
    .app-name {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
    }
    
    .app-package {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #737373;
    }
    
    .actions-wrapper {
        position: relative;
        display: flex;
        justify-content: center;
    }
    
    .action-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .action-menu-btn:hover {
        background: #F5F5F5;
    }
    
    .app-actions-menu {
        position: absolute;
        top: 100%;
        right: 0;
        z-index: 50;
        min-width: 160px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 8px;
        box-shadow: 0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08);
        padding: 4px 0;
    }
    
    .app-actions-menu button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 14px;
        background: transparent;
        border: none;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-700);
        cursor: pointer;
        transition: background 0.15s ease;
    }
    
    .app-actions-menu button:hover {
        background: #F9FAFB;
    }
    
    .app-actions-menu button.uninstall-btn {
        color: #B42318;
    }
    
    .app-actions-menu button.uninstall-btn:hover {
        background: #FEF3F2;
    }
    
    .app-actions-menu button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* Pagination */
    .apps-pagination {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        padding: 8px 24px;
        gap: 8px;
        border-top: 1px solid #EAECF0;
    }
    
    .pagination-info {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    
    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    
    .pagination-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .pagination-btn:hover:not(:disabled) {
        background: #F5F5F5;
    }
    
    .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .page-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--ds-color-gray-50);
        border-radius: var(--ds-radius-lg);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        text-align: center;
        color: var(--ds-color-gray-800);
    }
    
    /* Deployments Card */
    .deployments-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
    }
    
    .deployments-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 0;
        gap: 8px;
    }
    
    .deployments-icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 12px;
        width: 44px;
        height: 44px;
        border-radius: 8px;
    }
    
    .deployments-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
    }
    
    .deployments-header-text h4 {
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    
    .deployments-header-text p {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    
    .deployments-loading,
    .deployments-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        gap: 16px;
    }
    
    .deployments-loading span,
    .deployments-empty p {
        font-size: 14px;
        color: #737373;
        margin: 0;
    }
    
    .deployments-table-wrap {
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border-radius: 9px;
        overflow: hidden;
    }
    
    .deployments-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .deployments-table thead {
        background: #F5F5F5;
    }
    
    .deployments-table th {
        padding: 12px 16px;
        text-align: left;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        border-bottom: 1px solid #EAECF0;
    }
    
    .deployments-table td {
        padding: 16px;
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        border-bottom: 1px solid #EAECF0;
        vertical-align: middle;
        background: #FFFFFF;
        min-height: 52px;
    }
    
    .dep-col-name {
        min-width: 400px;
    }
    
    .dep-col-version {
        width: 100px;
    }
    
    .dep-col-started {
        width: 200px;
    }
    
    .dep-col-ended {
        width: 200px;
    }
    
    .dep-col-status {
        width: 140px;
    }
    
    .dep-col-action {
        width: 85px;
        text-align: center;
    }
    
    .status-badge {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        padding: 4px 8px;
        gap: 4px;
        border-radius: 16px;
    }
    
    .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }
    
    .status-badge span:last-child {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
    }
    
    .dep-actions-wrapper {
        position: relative;
        display: flex;
        justify-content: center;
    }
    
    .dep-action-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .dep-action-menu-btn:hover {
        background: #F5F5F5;
    }
    
    .dep-actions-menu {
        position: absolute;
        top: 100%;
        right: 0;
        z-index: 50;
        min-width: 140px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 8px;
        box-shadow: 0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08);
        padding: 4px 0;
    }
    
    .dep-actions-menu button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 14px;
        background: transparent;
        border: none;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-700);
        cursor: pointer;
        transition: background 0.15s ease;
    }
    
    .dep-actions-menu button:hover {
        background: #F9FAFB;
    }
    
    /* Deployments Pagination */
    .deployments-pagination {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        padding: 8px 24px;
        gap: 8px;
        border-top: 1px solid #EAECF0;
    }
    
    .dep-pagination-info {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    
    .dep-pagination-controls {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    
    .dep-pagination-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .dep-pagination-btn:hover:not(:disabled) {
        background: #F5F5F5;
    }
    
    .dep-pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .dep-page-numbers {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    
    .dep-page-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: #475467;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    
    .dep-page-number:hover {
        background: #F5F5F5;
    }
    
    .dep-page-number.active {
        background: #F9FAFB;
        color: #1D2939;
    }
    
    .dep-page-ellipsis {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
    }

    /* Activity Card */
    .activity-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
    }

    .activity-body {
        padding: 0;
    }

    .empty-state {
        padding: 48px;
        text-align: center;
        color: #737373;
        font-size: 14px;
    }

    /* Activity Table */
    .activity-table-wrap {
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border-radius: 9px;
    }

    .activity-table-header {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: #F5F5F5;
        border-bottom: 1px solid #EAECF0;
    }

    .activity-header-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 12px 16px;
        gap: 12px;
        height: 44px;
    }

    .activity-header-cell .header-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
    }

    .activity-col-expand {
        width: 60px;
        flex-shrink: 0;
    }

    .activity-col-event {
        width: 240px;
        flex-shrink: 0;
    }

    .activity-col-description {
        flex: 1;
        min-width: 0;
    }

    .activity-col-status {
        width: 150px;
        flex-shrink: 0;
    }

    /* Activity Row */
    .activity-row {
        display: flex;
        flex-direction: row;
        align-items: stretch; /* Stretch all cells to same height */
        background: #FFFFFF;
        border-bottom: 1px solid #EAECF0;
    }

    .activity-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 16px;
        min-height: 52px;
        /* Remove individual border - use row border instead */
    }

    .expand-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
    }

    .expand-btn:disabled {
        opacity: 0.3;
        cursor: default;
    }

    .event-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    .description-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    /* Status Badge */
    .status-badge {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 4px 8px;
        gap: 4px;
        border-radius: 16px;
    }

    .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .status-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        text-align: center;
        letter-spacing: 0.01em;
    }

    /* Activity Details Row */
    .activity-details-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: #FFFFFF;
        border-bottom: 1px solid #EAECF0;
        min-height: 60px;
    }

    .activity-details-spacer {
        width: 60px; /* Match expand column width */
        flex-shrink: 0;
        display: flex;
        justify-content: center;
    }

    .activity-details-divider {
        display: flex;
        flex-direction: column;
        justify-content: stretch;
        align-items: center;
        width: 20px;
        flex-shrink: 0;
        padding: 0;
    }

    .divider-line {
        width: 1px;
        background: #E5E5E5;
        flex: 1;
        min-height: 100%;
    }

    .activity-details-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 16px 16px 16px 12px;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .detail-item {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    .detail-old-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: #DD2590; /* Pink/600 */
    }

    .detail-new-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
        flex: 1;
    }

    /* Detail Tags */
    .detail-tags {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-tag {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 4px 6px;
        gap: 6px;
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-md);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        text-align: center;
        color: var(--ds-color-gray-700);
    }

    /* Activity Pagination */
    .activity-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 24px;
        gap: 8px;
        border-top: 1px solid #EAECF0;
    }

    .activity-pagination .pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    .activity-pagination .pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
    }

    .activity-pagination .pagination-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .activity-pagination .pagination-btn:hover:not(:disabled) {
        background: #F5F5F5;
    }

    .activity-pagination .pagination-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .activity-pagination .page-number {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: #F9FAFB;
        border-radius: 8px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #1D2939;
    }

    /* Responsive */
    @media (max-width: 1200px) {
        .header-section {
            flex-direction: column;
        }

        .general-card {
            width: 100%;
        }

        .quick-actions {
            grid-template-columns: repeat(4, 1fr);
        }
    }

    @media (max-width: 1024px) {
        .details-grid {
            grid-template-columns: 1fr;
        }

        .details-column {
            width: 100%;
        }
    }

    @media (max-width: 900px) {
        .quick-actions {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 500px) {
        .quick-actions {
            grid-template-columns: 1fr;
        }
    }

    /* ========================================
       Push File Modal Styles (Design System)
       ======================================== */
    
    /* File List Item */
    .push-file-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        text-align: left;
        background: #FAFAFA;
        border-radius: 8px;
        padding: 12px 16px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .push-file-item:hover {
        background: #F5F5F5;
    }

    .push-file-item.selected {
        background: #E0F2FE;
        border-color: #0086C9;
    }

    .push-file-item-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
        width: 100%;
    }

    /* Radio indicator - matches design-system Radio.svelte */
    .push-file-radio {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #D6D6D6;
        background: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s ease;
    }

    .push-file-radio.checked {
        border-color: #141414;
        background: #FCFCFC;
    }

    .push-file-radio-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #141414;
    }

    /* File info */
    .push-file-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    .push-file-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .push-file-package {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Meta info */
    .push-file-meta {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;
    }

    .push-file-meta-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .push-file-meta-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-600);
    }

    .push-file-meta-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    /* Created date */
    .push-file-created {
        padding-left: 28px;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    /* Pagination */
    .push-file-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid #EAECF0;
    }

    .push-file-pagination-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    .push-file-pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
    }

    .push-file-pagination-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .push-file-pagination-btn:hover:not(:disabled) {
        background: #F2F4F7;
    }

    .push-file-pagination-btn:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .push-file-pagination-current {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: #F9FAFB;
        border-radius: 8px;
    }

    .push-file-pagination-current span {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    /* ========================================
       Pull File Modal Styles (Design System)
       ======================================== */
    
    .pull-file-info-box {
        background: #FAFAFA;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pull-file-info-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }

    .pull-file-info-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    .pull-file-info-list {
        margin: 0;
        padding-left: 20px;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .pull-file-info-list li {
        margin-bottom: 4px;
    }

    .pull-file-info-list li:last-child {
        margin-bottom: 0;
    }
</style>
