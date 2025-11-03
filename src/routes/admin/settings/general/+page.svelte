<script lang="ts">
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import type { PageData } from "./$types";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "$lib/components/ui/dialog";
    import { Badge } from "$lib/components/ui/badge";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { toast } from "svelte-sonner";
    import { enhance } from "$app/forms";
    import { Save, Settings, History, ArrowLeft, ArrowRight, Plus, Minus, Edit } from "lucide-svelte";
    import SettingsForm from "./form.svelte";
    import SettingsTable from "./table.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";
    import EnhancedMenubar from "$lib/components/ui_components_sveltekit/menubar/EnhancedMenubar.svelte";
    import { goto, invalidate } from "$app/navigation";

    export let data: PageData;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["General Settings", ""]
    ];
    
    const title = "General Settings";

    let loading = false;
    let jsonError: string | null = null;
    let activeView = "settings";
    let isSubmitting = false;
    
    // Modal state for viewing changes
    let viewChangesModal = false;
    let selectedSetting: any = null;
    let changeDetails: { added: any[], removed: any[], modified: any[] } = { added: [], removed: [], modified: [] };

    // Define menu items for the SimpleMenubar
    const menuItems = [
        {
            label: "Settings",
            icon: Settings,
            action: () => {
                activeView = "settings";
            }
        },
        {
            label: "History",
            icon: History,
            action: () => {
                activeView = "history";
            }
        }
    ];
    
    // Handle menu selection events
    function handleMenuSelect(event) {
        const item = event.detail;
        if (item.label === "Current Settings") {
            activeView = "settings";
        } else if (item.label === "Settings History") {
            activeView = "history";
        }
    }
    
    // Map view to menu label
    $: activeMenuLabel = activeView === "settings" ? "Settings" : "History";
    
    // Set menu items and active item for the top bar
    $: {
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
    }
    
    onMount(() => {
        // Set again in onMount to ensure it works after client-side navigation
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
        
        // Clean up when component is destroyed
        return () => {
            topMenuItems.set(null);
        };
    });
    
    // Also set on page change
    $: if ($page.url.pathname.includes('/admin/settings/general')) {
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
    }

    function handleRestore(event: CustomEvent<{ setting: any }>) {
        const setting = event.detail.setting;
        if (setting && setting.data) {
            data.form.data.data = setting.data;
            data.form.data.id = data.activeSettings?.id;
            activeView = "settings";
            toast.success("Previous settings loaded. Click Save to apply.");
        }
    }

    function handleView(event: CustomEvent<{ setting: any }>) {
        const setting = event.detail.setting;
        if (setting && setting.data) {
            selectedSetting = setting;
            
            // Find the previous setting to compare
            const allSettings = [
                ...(data.activeSettings ? [data.activeSettings] : []),
                ...(data.settingsHistory || [])
            ];
            
            const currentIndex = allSettings.findIndex(s => s.id === setting.id);
            const previousSetting = currentIndex < allSettings.length - 1 ? allSettings[currentIndex + 1] : null;
            
            // Parse the JSON data
            const oldData = previousSetting ? JSON.parse(previousSetting.data || '{}') : {};
            const newData = JSON.parse(setting.data || '{}');
            
            // Compare settings
            changeDetails = compareSettings(oldData, newData);
            
            viewChangesModal = true;
        }
    }
    
    // Function to deeply compare two values
    function deepEqual(val1: any, val2: any): boolean {
        // Handle primitives and null/undefined
        if (val1 === val2) return true;
        if (val1 == null || val2 == null) return false;
        if (typeof val1 !== typeof val2) return false;
        
        // Handle dates
        if (val1 instanceof Date && val2 instanceof Date) {
            return val1.getTime() === val2.getTime();
        }
        
        // Handle arrays
        if (Array.isArray(val1) && Array.isArray(val2)) {
            if (val1.length !== val2.length) return false;
            for (let i = 0; i < val1.length; i++) {
                if (!deepEqual(val1[i], val2[i])) return false;
            }
            return true;
        }
        
        // Handle objects
        if (typeof val1 === 'object' && typeof val2 === 'object') {
            const keys1 = Object.keys(val1);
            const keys2 = Object.keys(val2);
            if (keys1.length !== keys2.length) return false;
            for (const key of keys1) {
                if (!keys2.includes(key) || !deepEqual(val1[key], val2[key])) {
                    return false;
                }
            }
            return true;
        }
        
        return false;
    }
    
    // Function to recursively flatten nested objects with dot notation
    function flattenObject(obj: any, prefix = ''): Record<string, any> {
        const flattened: Record<string, any> = {};
        
        for (const key in obj) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey));
            } else {
                // Add primitive value
                flattened[newKey] = value;
            }
        }
        
        return flattened;
    }
    
    // Function to compare two settings objects and find differences
    function compareSettings(oldData: any, newData: any) {
        const added: any[] = [];
        const removed: any[] = [];
        const modified: any[] = [];
        
        // Flatten both objects to compare all nested fields
        const flatOld = flattenObject(oldData);
        const flatNew = flattenObject(newData);
        
        // Get all unique keys from both flattened objects
        const allKeys = new Set([...Object.keys(flatOld), ...Object.keys(flatNew)]);
        
        // Check each key
        for (const key of allKeys) {
            const existsInOld = key in flatOld;
            const existsInNew = key in flatNew;
            
            if (!existsInOld && existsInNew) {
                // Field was added
                added.push({ key, newValue: flatNew[key] });
            } else if (existsInOld && !existsInNew) {
                // Field was removed
                removed.push({ key, oldValue: flatOld[key] });
            } else if (existsInOld && existsInNew) {
                // Field exists in both - check if modified using deep equal
                if (!deepEqual(flatOld[key], flatNew[key])) {
                    modified.push({ key, oldValue: flatOld[key], newValue: flatNew[key] });
                }
            }
        }
        
        return { added, removed, modified };
    }
    
    // Map technical keys to human-readable labels
    const fieldLabels: Record<string, string> = {
        // Authentication
        'auth.sessionAuth': 'Session Authentication',
        'auth.oauthAuth': 'OAuth Authentication',
        'auth.sessionTimeout': 'Session Timeout',
        'auth.maxLoginAttempts': 'Max Login Attempts',
        'auth.captchaEnabled': 'CAPTCHA Protection',
        'auth.captchaType': 'CAPTCHA Type',
        'auth.emailProvider': 'Email Provider',
        'auth.emailEnabled': 'Email Notifications',
        'auth.allowRegistration': 'Allow Registration',
        
        // Security
        'security.enforceStrongPasswords': 'Enforce Strong Passwords',
        'security.twoFactorAuth': 'Two-Factor Authentication',
        'security.ipRestriction': 'IP Restriction',
        'security.allowedIPs': 'Allowed IPs',
        
        // System
        'system.debugMode': 'Debug Mode',
        'system.logLevel': 'Log Level',
        'system.maintenanceMode': 'Maintenance Mode',
        'system.allowRegistration': 'Allow Registration',
        
        // Notifications
        'notifications.emailNotifications': 'Email Notifications',
        'notifications.smsNotifications': 'SMS Notifications',
        'notifications.webhookNotifications': 'Webhook Notifications',
        'notifications.webhookUrl': 'Webhook URL',
        
        // Performance
        'performance.cacheEnabled': 'Enable Caching',
        'performance.cacheTTL': 'Cache TTL (seconds)',
        'performance.rateLimitEnabled': 'Rate Limiting',
        'performance.maxRequestsPerMinute': 'Max Requests Per Minute'
    };
    
    // Get human-readable label for a key, with fallback to formatted key
    function getFieldLabel(key: string): string {
        if (fieldLabels[key]) {
            return fieldLabels[key];
        }
        
        // Fallback: convert camelCase to Title Case
        return key
            .split('.')
            .map(part => part.replace(/([A-Z])/g, ' $1').trim())
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' → ');
    }
    
    // Format value for display
    function formatValue(value: any): string {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        return String(value);
    }

    // Handle form submission state
    function handleFormSubmit() {
        isSubmitting = true;
    }

    function handleFormResult(event) {
        isSubmitting = false;
        const { success, result, cancelled } = event.detail;
        
        // Note: Form component already calls invalidate() in its onResult handler
        // so the history will be automatically refreshed
    }

    // Action buttons for the page header
    $: actionButtons = [
        {
            label: "Back to Settings",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings'),
            variant: "outline",
            disabled: isSubmitting
        },
        {
            label: isSubmitting ? "Saving..." : "Save Settings",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/update"]');
                if (form) {
                    handleFormSubmit();
                    form.requestSubmit();
                }
            },
            disabled: isSubmitting,
            loading: isSubmitting
        }
    ];

    onMount(() => {
        // Initialize with any needed setup
    });
</script>



<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={actionButtons}
    {loading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
        title="Settings Management"
        description="Manage application settings and view settings history"
        icon={Settings}
        compact={true}
    >
        <div class="p-2">
            {#if activeView === "settings"}
                {#if loading}
                    <div class="space-y-2">
                        <Skeleton class="h-8 w-1/3" />
                        <Skeleton class="h-4 w-2/3" />
                        <Skeleton class="h-64 w-full" />
                    </div>
                {:else}
                    <SettingsForm 
                        form={data.form} 
                        {jsonError} 
                        on:submit={handleFormSubmit}
                        on:result={handleFormResult}
                    />
                {/if}
            {:else if activeView === "history"}
                {#if loading}
                    <div class="space-y-2">
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-10 w-full" />
                    </div>
                {:else}
                    <SettingsTable 
                        settings={[
                            ...(data.activeSettings ? [data.activeSettings] : []),
                            ...(data.settingsHistory || [])
                        ]} 
                        on:restore={handleRestore}
                        on:view={handleView}
                    />
                {/if}
            {/if}
        </div>
    </AdminCard>
</AdminPageLayout>

<!-- Changes Modal -->
<Dialog bind:open={viewChangesModal}>
    <DialogContent class="max-w-4xl max-h-[80vh]">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <History class="h-5 w-5" />
                Settings Changes
            </DialogTitle>
            <DialogDescription>
                {#if selectedSetting}
                    Changes made on {new Date(selectedSetting.updatedAt).toLocaleString()}
                    {#if selectedSetting.updatedBy}
                        by {selectedSetting.updatedBy}
                    {/if}
                {/if}
            </DialogDescription>
        </DialogHeader>
        
        <ScrollArea class="max-h-[60vh] pr-4">
            <div class="space-y-6">
                <!-- Modified Fields -->
                {#if changeDetails.modified.length > 0}
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <Edit class="h-4 w-4 text-blue-600" />
                            <h3 class="text-sm font-semibold text-blue-600">Modified Fields ({changeDetails.modified.length})</h3>
                        </div>
                        <div class="space-y-3">
                            {#each changeDetails.modified as change}
                                <Card class="border-blue-200 bg-blue-50/50">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">{getFieldLabel(change.key)}</CardTitle>
                                        <p class="text-xs text-muted-foreground font-mono">{change.key}</p>
                                    </CardHeader>
                                    <CardContent class="space-y-2">
                                        <div class="space-y-1">
                                            <div class="flex items-center gap-2">
                                                <Badge variant="outline" class="bg-red-50 text-red-700 border-red-200 text-xs">
                                                    <Minus class="h-3 w-3 mr-1" />
                                                    Old
                                                </Badge>
                                            </div>
                                            <pre class="text-xs bg-red-50 border border-red-200 rounded p-2 overflow-x-auto"><code>{formatValue(change.oldValue)}</code></pre>
                                        </div>
                                        
                                        <div class="flex items-center justify-center">
                                            <ArrowRight class="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        
                                        <div class="space-y-1">
                                            <div class="flex items-center gap-2">
                                                <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200 text-xs">
                                                    <Plus class="h-3 w-3 mr-1" />
                                                    New
                                                </Badge>
                                            </div>
                                            <pre class="text-xs bg-green-50 border border-green-200 rounded p-2 overflow-x-auto"><code>{formatValue(change.newValue)}</code></pre>
                                        </div>
                                    </CardContent>
                                </Card>
                            {/each}
                        </div>
                    </div>
                {/if}
                
                <!-- Added Fields -->
                {#if changeDetails.added.length > 0}
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <Plus class="h-4 w-4 text-green-600" />
                            <h3 class="text-sm font-semibold text-green-600">Added Fields ({changeDetails.added.length})</h3>
                        </div>
                        <div class="space-y-2">
                            {#each changeDetails.added as change}
                                <Card class="border-green-200 bg-green-50/50">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">{getFieldLabel(change.key)}</CardTitle>
                                        <p class="text-xs text-muted-foreground font-mono">{change.key}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <pre class="text-xs bg-green-50 border border-green-200 rounded p-2 overflow-x-auto"><code>{formatValue(change.newValue)}</code></pre>
                                    </CardContent>
                                </Card>
                            {/each}
                        </div>
                    </div>
                {/if}
                
                <!-- Removed Fields -->
                {#if changeDetails.removed.length > 0}
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <Minus class="h-4 w-4 text-red-600" />
                            <h3 class="text-sm font-semibold text-red-600">Removed Fields ({changeDetails.removed.length})</h3>
                        </div>
                        <div class="space-y-2">
                            {#each changeDetails.removed as change}
                                <Card class="border-red-200 bg-red-50/50">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">{getFieldLabel(change.key)}</CardTitle>
                                        <p class="text-xs text-muted-foreground font-mono">{change.key}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <pre class="text-xs bg-red-50 border border-red-200 rounded p-2 overflow-x-auto"><code>{formatValue(change.oldValue)}</code></pre>
                                    </CardContent>
                                </Card>
                            {/each}
                        </div>
                    </div>
                {/if}
                
                <!-- No Changes -->
                {#if changeDetails.added.length === 0 && changeDetails.removed.length === 0 && changeDetails.modified.length === 0}
                    <div class="text-center py-8">
                        <History class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p class="text-sm text-muted-foreground">No changes detected or this is the first version</p>
                    </div>
                {/if}
            </div>
        </ScrollArea>
    </DialogContent>
</Dialog>
