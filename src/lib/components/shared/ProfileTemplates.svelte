<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Monitor, Smartphone, Tablet, Camera, Wifi, Settings } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    // Predefined profile templates
    const templates = [
        {
            id: 'retail-kiosk',
            name: 'Retail Kiosk',
            description: 'Standard configuration for retail kiosk devices',
            icon: Monitor,
            category: 'Retail',
            settings: [
                { key: 'kiosk_lock_mode', value: 'enabled', dataType: 'boolean', label: 'Kiosk Lock Mode', category: 'Security', order: 0 },
                { key: 'exit_lockdown_password', value: 'admin123', dataType: 'password', label: 'Exit Lockdown Password', category: 'Security', order: 1 },
                { key: 'display_resolution', value: '1920x1080', dataType: 'select', label: 'Display Resolution', category: 'Display', order: 2 },
                { key: 'screen_orientation', value: 'landscape', dataType: 'select', label: 'Screen Orientation', category: 'Display', order: 3 },
                { key: 'enable_audio', value: 'enabled', dataType: 'boolean', label: 'Enable Audio', category: 'Audio', order: 4 },
                { key: 'volume_level', value: '75', dataType: 'range', label: 'Volume Level', category: 'Audio', order: 5 },
                { key: 'power_management_schedule', value: 'enabled', dataType: 'boolean', label: 'Power Management Schedule', category: 'Power', order: 6 },
                { key: 'power_on_time', value: '08:00', dataType: 'time', label: 'Power-On Time', category: 'Power', order: 7 }
            ]
        },
        {
            id: 'digital-signage',
            name: 'Digital Signage',
            description: 'Configuration for digital signage displays',
            icon: Monitor,
            category: 'Display',
            settings: [
                { key: 'display_resolution', value: '1920x1080', dataType: 'select', label: 'Display Resolution', category: 'Display', order: 0 },
                { key: 'screen_orientation', value: 'landscape', dataType: 'select', label: 'Screen Orientation', category: 'Display', order: 1 },
                { key: 'enable_audio', value: 'disabled', dataType: 'boolean', label: 'Enable Audio', category: 'Audio', order: 2 },
                { key: 'power_management_schedule', value: 'enabled', dataType: 'boolean', label: 'Power Management Schedule', category: 'Power', order: 3 },
                { key: 'power_on_time', value: '06:00', dataType: 'time', label: 'Power-On Time', category: 'Power', order: 4 },
                { key: 'auto_rotate_content', value: 'enabled', dataType: 'boolean', label: 'Auto Rotate Content', category: 'Display', order: 5 }
            ]
        },
        {
            id: 'mobile-kiosk',
            name: 'Mobile Kiosk',
            description: 'Configuration for mobile/tablet kiosks',
            icon: Tablet,
            category: 'Mobile',
            settings: [
                { key: 'kiosk_lock_mode', value: 'enabled', dataType: 'boolean', label: 'Kiosk Lock Mode', category: 'Security', order: 0 },
                { key: 'screen_orientation', value: 'portrait', dataType: 'select', label: 'Screen Orientation', category: 'Display', order: 1 },
                { key: 'enable_audio', value: 'enabled', dataType: 'boolean', label: 'Enable Audio', category: 'Audio', order: 2 },
                { key: 'volume_level', value: '50', dataType: 'range', label: 'Volume Level', category: 'Audio', order: 3 },
                { key: 'battery_optimization', value: 'enabled', dataType: 'boolean', label: 'Battery Optimization', category: 'Power', order: 4 },
                { key: 'auto_lock_timeout', value: '300', dataType: 'number', label: 'Auto Lock Timeout (seconds)', category: 'Security', order: 5 }
            ]
        },
        {
            id: 'security-camera',
            name: 'Security Camera',
            description: 'Configuration for security camera devices',
            icon: Camera,
            category: 'Security',
            settings: [
                { key: 'recording_quality', value: '1080p', dataType: 'select', label: 'Recording Quality', category: 'Video', order: 0 },
                { key: 'motion_detection', value: 'enabled', dataType: 'boolean', label: 'Motion Detection', category: 'Security', order: 1 },
                { key: 'night_vision', value: 'enabled', dataType: 'boolean', label: 'Night Vision', category: 'Video', order: 2 },
                { key: 'audio_recording', value: 'enabled', dataType: 'boolean', label: 'Audio Recording', category: 'Audio', order: 3 },
                { key: 'storage_retention_days', value: '30', dataType: 'number', label: 'Storage Retention (days)', category: 'Storage', order: 4 },
                { key: 'cloud_backup', value: 'enabled', dataType: 'boolean', label: 'Cloud Backup', category: 'Storage', order: 5 }
            ]
        },
        {
            id: 'iot-sensor',
            name: 'IoT Sensor',
            description: 'Configuration for IoT sensor devices',
            icon: Wifi,
            category: 'IoT',
            settings: [
                { key: 'data_collection_interval', value: '60', dataType: 'number', label: 'Data Collection Interval (seconds)', category: 'Data', order: 0 },
                { key: 'battery_optimization', value: 'enabled', dataType: 'boolean', label: 'Battery Optimization', category: 'Power', order: 1 },
                { key: 'wifi_power_save', value: 'enabled', dataType: 'boolean', label: 'WiFi Power Save', category: 'Network', order: 2 },
                { key: 'auto_reconnect', value: 'enabled', dataType: 'boolean', label: 'Auto Reconnect', category: 'Network', order: 3 },
                { key: 'data_compression', value: 'enabled', dataType: 'boolean', label: 'Data Compression', category: 'Data', order: 4 }
            ]
        },
        {
            id: 'custom',
            name: 'Custom Template',
            description: 'Start with a blank template and configure your own settings',
            icon: Settings,
            category: 'Custom',
            settings: []
        }
    ];

    function selectTemplate(template: any) {
        dispatch('templateSelected', template);
    }

    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            'Retail': 'bg-blue-100 text-blue-800',
            'Display': 'bg-green-100 text-green-800',
            'Mobile': 'bg-purple-100 text-purple-800',
            'Security': 'bg-red-100 text-red-800',
            'IoT': 'bg-yellow-100 text-yellow-800',
            'Custom': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || 'bg-gray-100 text-gray-800';
    }
</script>

<div class="space-y-6">
    <div>
        <h3 class="text-lg font-semibold mb-2">Choose a Template</h3>
        <p class="text-sm text-muted-foreground mb-4">
            Select a predefined template to get started quickly, or create a custom profile from scratch.
        </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each templates as template}
            <Card class="cursor-pointer hover:shadow-md transition-shadow" on:click={() => selectTemplate(template)}>
                <CardHeader class="pb-3">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-gray-100 rounded-lg">
                            <svelte:component this={template.icon} class="h-5 w-5 text-gray-600" />
                        </div>
                        <div class="flex-1">
                            <CardTitle class="text-base">{template.name}</CardTitle>
                            <Badge class={getCategoryColor(template.category)}>
                                {template.category}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="pt-0">
                    <p class="text-sm text-muted-foreground mb-3">
                        {template.description}
                    </p>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-muted-foreground">
                            {template.settings.length} setting{template.settings.length !== 1 ? 's' : ''}
                        </span>
                        <Button size="sm" variant="outline">
                            Use Template
                        </Button>
                    </div>
                </CardContent>
            </Card>
        {/each}
    </div>
</div>
