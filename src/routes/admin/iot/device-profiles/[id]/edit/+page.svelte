<script lang="ts">
    import { ArrowLeft, Save, Plus, Trash, Settings, Users, Check, X, ChevronDown, ChevronLeft, ChevronRight, Tag, Monitor } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
    import * as Tabs from "$lib/components/ui/tabs";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import DeviceProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/DeviceProfileSettingsEditor.svelte';
    import DeviceSelector from "$lib/components/ui_components_sveltekit/device_profiles/DeviceSelector.svelte";
    import DeviceList from "$lib/components/ui_components_sveltekit/device_profiles/DeviceList.svelte";
    import SearchableTagSelect from "$lib/components/ui_components_sveltekit/device_profiles/SearchableTagSelect.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";
    
    export let data;
    const title = "Edit Device Profile";
    
    // Breadcrumbs for navigation
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Device Profiles", "/admin/iot/device-profiles"],
        [data.profile.name, `/admin/iot/device-profiles/${data.profile.id}`],
        ["Edit", `/admin/iot/device-profiles/${data.profile.id}/edit`]
    ];
    
    // Initialize form handler
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: `/admin/iot/device-profiles/${data.profile.id}`,
        validateOnInput: true,
        onSuccess: () => {
            toast.success('Device profile updated successfully');
        }
    });

    // Parse settings from JSON string
    let localSettings: any[] = [];
    try {
        localSettings = JSON.parse($form.settings || '[]');
    } catch (e) {
        console.error('Error parsing settings:', e);
        localSettings = [];
    }
    
    // Device assignment state
    let selectedDevices: string[] = [];
    let devices: any[] = [];
    let showDeviceSelector = false;
    let deviceLoading = false;
    let assignedSearchTerm = '';
    let availableSearchTerm = '';
    let assignedTagFilter = '';
    let availableTagFilter = '';
    let assignedPage = 1;
    let availablePage = 1;
    const itemsPerPage = 10;
    let assignedTagPopoverOpen = false;
    let availableTagPopoverOpen = false;
    let activeTab = $page.url.searchParams.get('tab') || "settings";
    
    // Tag assignment modal
    let showTagModal = false;
    let allTags: any[] = [];
    let selectedTagId = '';
    let tagDevices: any[] = [];
    let tagDevicesLoading = false;
    
    // Load all tags for filters
    let allAvailableTags: any[] = [];
    
    
    // Load devices on mount
    onMount(async () => {
        await loadAssignedDevices();
        await loadAvailableDevices();
        await loadAllAvailableTags();
    });

    // Event handlers for search/filter changes
    function handleAssignedSearchChange() {
        loadAssignedDevices();
    }

    function handleAvailableSearchChange() {
        loadAvailableDevices();
    }

    function handleAssignedFilterChange() {
        loadAssignedDevices();
    }

    function handleAvailableFilterChange() {
        loadAvailableDevices();
    }

    function handleAssignedPageChange() {
        loadAssignedDevices();
    }

    function handleAvailablePageChange() {
        loadAvailableDevices();
    }

    // Separate arrays for assigned and available devices
    let assignedDevices: any[] = [];
    let availableDevices: any[] = [];
    let assignedTotal = 0;
    let availableTotal = 0;

    // Get unique tags from all devices (as objects with id, name, color)
    $: assignedTags = assignedDevices.flatMap(d => d.tags || [])
        .reduce((unique: any[], tag: any) => {
            if (tag && tag.id && !unique.find(t => t.id === tag.id)) {
                unique.push({ id: tag.id, name: tag.name, color: tag.color || '#6b7280' });
            }
            return unique;
        }, []);
    
    $: availableTags = availableDevices.flatMap(d => d.tags || [])
        .reduce((unique: any[], tag: any) => {
            if (tag && tag.id && !unique.find(t => t.id === tag.id)) {
                unique.push({ id: tag.id, name: tag.name, color: tag.color || '#6b7280' });
            }
            return unique;
        }, []);

    // Load assigned devices with search and filter
    async function loadAssignedDevices() {
        try {
            const params = new URLSearchParams();
            params.set('status', 'assigned'); // Only get assigned devices
            if (assignedSearchTerm) params.set('search', assignedSearchTerm);
            if (assignedTagFilter) params.set('tagId', assignedTagFilter);
            params.set('limit', itemsPerPage.toString());
            params.set('offset', ((assignedPage - 1) * itemsPerPage).toString());

            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/devices?${params}`);
            if (response.ok) {
                const result = await response.json();
                assignedDevices = result.devices || [];
                assignedTotal = result.total || 0;
                console.log('Assigned devices API response:', { devices: assignedDevices.length, total: assignedTotal, pages: Math.ceil(assignedTotal / itemsPerPage) });
            }
        } catch (error) {
            console.error('Failed to load assigned devices:', error);
        }
    }

    // Load available devices with search and filter
    async function loadAvailableDevices() {
        try {
            const params = new URLSearchParams();
            params.set('status', 'available'); // Only get available devices
            if (availableSearchTerm) params.set('search', availableSearchTerm);
            if (availableTagFilter) params.set('tagId', availableTagFilter);
            params.set('limit', itemsPerPage.toString());
            params.set('offset', ((availablePage - 1) * itemsPerPage).toString());

            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/devices?${params}`);
            if (response.ok) {
                const result = await response.json();
                availableDevices = result.devices || [];
                availableTotal = result.total || 0;
                console.log('Available devices API response:', { devices: availableDevices.length, total: availableTotal, pages: Math.ceil(availableTotal / itemsPerPage) });
            }
        } catch (error) {
            console.error('Failed to load available devices:', error);
        }
    }

    // Reactive pagination calculations
    $: assignedTotalPages = Math.ceil(assignedTotal / itemsPerPage);
    $: availableTotalPages = Math.ceil(availableTotal / itemsPerPage);
    
    // Ensure page numbers stay within bounds
    $: if (assignedPage > assignedTotalPages && assignedTotalPages > 0) {
        assignedPage = assignedTotalPages;
    }
    $: if (availablePage > availableTotalPages && availableTotalPages > 0) {
        availablePage = availableTotalPages;
    }
    
    // Generate page arrays for pagination
    $: assignedPageNumbers = (() => {
        const pages = [];
        const start = Math.max(1, assignedPage - 2);
        const end = Math.min(assignedTotalPages, start + 4);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    })();
    
    $: availablePageNumbers = (() => {
        const pages = [];
        const start = Math.max(1, availablePage - 2);
        const end = Math.min(availableTotalPages, start + 4);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    })();
    
    // Debug logging
    $: console.log('Assigned total pages:', { assignedTotal, itemsPerPage, pages: assignedTotalPages });
    $: console.log('Available total pages:', { availableTotal, itemsPerPage, pages: availableTotalPages });
    
    
    // Handle device selection from modal
    async function handleDeviceSelect(event: CustomEvent<{id: string; name: string}[]>) {
        const selectedDeviceIds = event.detail.map(d => d.id);
        selectedDevices = [...new Set([...selectedDevices, ...selectedDeviceIds])];
        showDeviceSelector = false;
    }
    
    // Toggle device selection
    function toggleDevice(deviceId: string) {
        if (selectedDevices.includes(deviceId)) {
            selectedDevices = selectedDevices.filter(id => id !== deviceId);
        } else {
            selectedDevices = [...selectedDevices, deviceId];
        }
    }
    
    // Handle device assignment
    async function handleAssign() {
        if (selectedDevices.length === 0) {
            toast.error('Please select at least one device');
            return;
        }

        deviceLoading = true;
        try {
            // All selected devices are from available devices, so they need to be assigned
            const devicesToAssign = selectedDevices;

            // Handle assignments
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds: devicesToAssign })
            });
            if (!response.ok) throw new Error('Failed to assign devices');

            // Success message
            const message = `Profile assigned to ${devicesToAssign.length} device(s)`;
            
            toast.success(message);
            selectedDevices = [];
            await loadAssignedDevices();
            await loadAvailableDevices();
        } catch (error) {
            console.error('Error handling assignment:', error);
            toast.error('An error occurred while updating device assignments');
        } finally {
            deviceLoading = false;
        }
    }

    // Handle single device unassignment
    async function handleUnassign(deviceId: string) {
        try {
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/unassign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceIds: [deviceId]
                })
            });

            if (response.ok) {
                toast.success('Device unassigned successfully');
                await loadAssignedDevices();
                await loadAvailableDevices();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to unassign device');
            }
        } catch (error) {
            console.error('Error unassigning device:', error);
            toast.error('Failed to unassign device');
        }
    }
    
    // Handle unassign all assigned devices
    async function handleUnassignAll() {
        if (assignedDevices.length === 0) return;
        
        deviceLoading = true;
        try {
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/unassign-all`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(result.message);
                // Reload both lists
                loadAssignedDevices();
                loadAvailableDevices();
            } else {
                toast.error(result.error || 'Failed to unassign all devices');
            }
        } catch (error) {
            console.error('Failed to unassign all devices:', error);
            toast.error('Failed to unassign all devices');
        } finally {
            deviceLoading = false;
        }
    }
    
    // Handle add all available devices
    async function handleAddAll() {
        if (availableDevices.length === 0) return;
        
        deviceLoading = true;
        try {
            const allAvailableIds = availableDevices.map(device => device.id);
            
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/assign-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds: allAvailableIds })
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(result.message);
                // Reload both lists
                loadAssignedDevices();
                loadAvailableDevices();
            } else {
                toast.error(result.error || 'Failed to assign all devices');
            }
        } catch (error) {
            console.error('Failed to assign all devices:', error);
            toast.error('Failed to assign all devices');
        } finally {
            deviceLoading = false;
        }
    }
    
    // Load all tags for the modal
    async function loadAllTags() {
        try {
            const response = await fetch(`/api/admin/iot/devices/tags`);
            const result = await response.json();
            if (result.success) {
                allTags = result.tags;
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    }
    
    // Load all available tags for filters
    async function loadAllAvailableTags() {
        try {
            console.log('Loading all available tags...');
            const response = await fetch(`/api/admin/iot/devices/tags`);
            console.log('Tags API response status:', response.status);
            const result = await response.json();
            console.log('Tags API result:', result);
            if (result.success) {
                allAvailableTags = result.tags;
                console.log('Loaded tags:', allAvailableTags.length, allAvailableTags);
                console.log('Tag names:', allAvailableTags.map(t => t.name).slice(0, 10)); // Show first 10 tag names
            } else {
                console.error('Tags API returned error:', result.error);
            }
        } catch (error) {
            console.error('Failed to load available tags:', error);
        }
    }
    
    // Load devices for selected tag
    async function loadTagDevices(tagId: string) {
        if (!tagId) return;
        
        tagDevicesLoading = true;
        try {
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/devices-by-tag?tagId=${tagId}`);
            const result = await response.json();
            if (result.success) {
                tagDevices = result.devices;
            }
        } catch (error) {
            console.error('Failed to load tag devices:', error);
            tagDevices = [];
        } finally {
            tagDevicesLoading = false;
        }
    }
    
    // Handle tag selection change
    function handleTagSelectionChange(tagId: string) {
        selectedTagId = tagId;
        loadTagDevices(tagId);
    }
    
    // Handle assign by tag
    async function handleAssignByTag() {
        if (!selectedTagId) return;
        
        deviceLoading = true;
        try {
            const response = await fetch(`/api/admin/iot/device-profiles/${data.profile.id}/assign-by-tag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagId: selectedTagId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(result.message);
                showTagModal = false;
                selectedTagId = '';
                tagDevices = [];
                // Reload both lists
                loadAssignedDevices();
                loadAvailableDevices();
            } else {
                toast.error(result.error || 'Failed to assign devices by tag');
            }
        } catch (error) {
            console.error('Failed to assign devices by tag:', error);
            toast.error('Failed to assign devices by tag');
        } finally {
            deviceLoading = false;
        }
    }
    
    // Computed values
    $: selectedCount = selectedDevices.length;
    
    // Update form settings when localSettings changes
    $: $form.settings = JSON.stringify(localSettings);
    

    // Predefined setting definitions
    const availableSettings: any[] = [
        {
            key: 'kiosk_lock_mode',
            label: 'Kiosk Lock Mode',
            dataType: 'boolean',
            category: 'Security',
            defaultValue: 'enabled'
        },
        {
            key: 'exit_lockdown_password',
            label: 'Exit Lockdown Password',
            dataType: 'password',
            category: 'Security',
            defaultValue: ''
        },
        {
            key: 'display_resolution',
            label: 'Display Resolution',
            dataType: 'select',
            category: 'Display',
            options: [
                { label: '1920×1080 (Full HD)', value: '1920x1080' },
                { label: '1366×768 (HD)', value: '1366x768' },
                { label: '2560×1440 (2K)', value: '2560x1440' }
            ],
            defaultValue: '1920x1080'
        },
        {
            key: 'screen_orientation',
            label: 'Screen Orientation',
            dataType: 'select',
            category: 'Display',
            options: [
                { label: 'Landscape', value: 'landscape' },
                { label: 'Portrait', value: 'portrait' }
            ],
            defaultValue: 'landscape'
        },
        {
            key: 'enable_audio',
            label: 'Enable Audio',
            dataType: 'boolean',
            category: 'Audio',
            defaultValue: 'enabled'
        },
        {
            key: 'volume_level',
            label: 'Volume Level',
            dataType: 'range',
            category: 'Audio',
            min: 0,
            max: 100,
            defaultValue: '75'
        },
        {
            key: 'power_management_schedule',
            label: 'Power Management Schedule',
            dataType: 'boolean',
            category: 'Power',
            defaultValue: 'enabled'
        },
        {
            key: 'power_on_time',
            label: 'Power-On Time',
            dataType: 'time',
            category: 'Power',
            defaultValue: '08:00'
        }
    ];

    // Initialize settings with existing values or defaults
    $: if (!$form.settings || $form.settings.length === 0) {
        const defaultSettings = availableSettings.map((setting, index) => {
            // Find existing setting value
            const existingSetting = data.profile.settings?.find((s) => s.key === setting.key);
            return {
                key: setting.key,
                value: existingSetting?.value || setting.defaultValue,
                dataType: setting.dataType,
                label: setting.label,
                category: setting.category,
                order: index
            };
        });
        $form.settings = JSON.stringify(defaultSettings);
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto(`/admin/iot/device-profiles/${data.profile.id}`),
            variant: "outline"
        },
        {
            label: "Save Changes",
            icon: Save,
            onClick: () => {
                const formElement = document.querySelector('form[action="?/update"]');
                if (formElement) {
                    // Use dispatchEvent to trigger form submission
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    formElement.dispatchEvent(submitEvent);
                }
            }
        }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
        <!-- Tabs for Settings and Devices -->
        <Tabs.Root bind:value={activeTab} class="space-y-6">
            <Tabs.List class="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-lg">
                <Tabs.Trigger 
                    value="settings" 
                    class="flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600 hover:text-slate-900"
                >
                    <Settings class="h-4 w-4" />
                    Profile Settings
                </Tabs.Trigger>
                <Tabs.Trigger 
                    value="devices" 
                    class="flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600 hover:text-slate-900"
                >
                    <Users class="h-4 w-4" />
                    Device Assignment
                </Tabs.Trigger>
            </Tabs.List>
            
            <!-- Settings Tab -->
            <Tabs.Content value="settings" class="space-y-6">
        <FormContainer
            method="POST"
            action="?/update"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <!-- Profile Details Section -->
            <Card>
                <CardHeader>
                    <CardTitle>Profile Details</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <FormRow columns={1}>
                        <FormField id="name" label="Profile Name" error={$errors.name?.toString()}>
                            <Input 
                                bind:value={$form.name} 
                                name="name" 
                                placeholder="Enter profile name"
                                required
                            />
                        </FormField>
                        <FormField id="description" label="Description" error={$errors.description?.toString()}>
                            <Textarea 
                                bind:value={$form.description} 
                                name="description" 
                                placeholder="Enter profile description"
                                rows={3}
                            />
                        </FormField>
                    </FormRow>
                </CardContent>
            </Card>
            
                    <!-- Settings Configuration -->
                    <DeviceProfileSettingsEditor bind:settings={localSettings} {availableSettings} />
                    
                    <!-- Hidden input for settings JSON -->
                    <input type="hidden" name="settings" bind:value={$form.settings} />
                </FormContainer>
            </Tabs.Content>
            
            <!-- Devices Tab -->
            <Tabs.Content value="devices" class="space-y-6">
                <!-- Header with Stats -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card class="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent">
                        <CardContent class="p-4">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-green-100 rounded-lg">
                                    <Users class="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">Assigned Devices</p>
                                    <p class="text-2xl font-bold text-green-700">{assignedTotal}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card class="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent">
                        <CardContent class="p-4">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-blue-100 rounded-lg">
                                    <Check class="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">Selected</p>
                                    <p class="text-2xl font-bold text-blue-700">{selectedCount}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card class="border-l-4 border-l-gray-500 bg-gradient-to-r from-gray-50/50 to-transparent">
                        <CardContent class="p-4">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-gray-100 rounded-lg">
                                    <Settings class="h-5 w-5 text-gray-600" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">Available</p>
                                    <p class="text-2xl font-bold text-gray-700">{availableTotal}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <!-- Selected Devices Summary -->
                <Card class="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent">
                    <CardHeader class="pb-2">
                        <CardTitle class="flex items-center justify-between">
                            <div class="flex items-center gap-2 text-sm">
                                <Check class="h-4 w-4 text-amber-600" />
                                Selected for Assignment ({selectedCount})
                            </div>
                            {#if selectedCount > 0}
                                <Button 
                                    variant="default" 
                                    size="sm"
                                    on:click={handleAssign}
                                    disabled={deviceLoading}
                                    class="bg-amber-600 hover:bg-amber-700 text-xs px-2 py-1"
                                >
                                    <Users class="h-3 w-3 mr-1" />
                                    {deviceLoading ? 'Processing...' : `Apply to ${selectedCount}`}
                                </Button>
                            {:else}
                                <div class="text-xs text-amber-600 font-medium">
                                    Select devices below
                                </div>
                            {/if}
                        </CardTitle>
                </CardHeader>
                <CardContent class="pt-0">
                        <div class="h-20 overflow-y-auto">
                            {#if selectedCount > 0}
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex flex-wrap gap-2 flex-1">
                                        {#each [...assignedDevices, ...availableDevices].filter(d => selectedDevices.includes(d.id)) as device}
                                            {@const isAssignedToThisProfile = device.profileAssignment?.profile?.id === data.profile.id}
                                            <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                                <span class="font-medium">{device.name}</span>
                                                <span class="text-muted-foreground text-xs">MAC: {device.macAddress || 'N/A'}</span>
                                                <button 
                                                    type="button"
                                                    class="text-muted-foreground hover:text-destructive ml-1"
                                                    on:click={() => toggleDevice(device.id)}
                                                    title="Remove device"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        on:click={() => selectedDevices = []}
                                        class="text-xs px-2 py-1 h-6"
                                    >
                                        Remove All
                                    </Button>
                                </div>
                            {:else}
                                <div class="flex items-center justify-center h-full text-center text-amber-600">
                                    <div>
                                        <Check class="h-4 w-4 mx-auto mb-1 opacity-50" />
                                        <p class="text-xs font-medium">No devices selected</p>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </CardContent>
                </Card>

                <!-- Side-by-Side Device Assignment Layout -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Assigned Devices Section (Left) -->
                    <Card class="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent">
                        <CardHeader class="pb-3">
                            <CardTitle class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="p-2 bg-green-100 rounded-lg">
                                        <Users class="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-semibold text-green-800">Assigned Devices</h3>
                                        <p class="text-sm text-green-600">Currently assigned to this profile</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge variant="default" class="bg-green-600 hover:bg-green-700">
                                        {assignedTotal}
                                    </Badge>
                                    {#if assignedDevices.length > 0}
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            on:click={handleUnassignAll}
                                            class="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                                        >
                                            <X class="h-4 w-4 mr-1" />
                                            Unassign All
                                        </Button>
                                    {/if}
                                </div>
                            </CardTitle>
                            <div class="mt-3 space-y-2">
                                <Input
                                    bind:value={assignedSearchTerm}
                                    on:input={handleAssignedSearchChange}
                                    placeholder="Search assigned devices..."
                                    class="w-full"
                                />
                                <SearchableTagSelect
                                    value={assignedTagFilter}
                                    placeholder="Filter by tag..."
                                    options={allAvailableTags}
                                    on:change={(e) => {
                                        assignedTagFilter = e.detail;
                                        handleAssignedFilterChange();
                                    }}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div class="space-y-1">
                                {#if assignedDevices.length > 0}
                                    {#each assignedDevices as device}
                                        <div class="flex items-center justify-between p-2 border rounded bg-green-50 border-green-200">
                                            <div class="flex items-center gap-2 min-w-0 flex-1">
                                                <div class="p-1 bg-green-100 rounded flex-shrink-0">
                                                    <Settings class="h-3 w-3 text-green-600" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <div class="text-sm font-medium text-green-900 truncate">{device.name}</div>
                                                    <div class="text-xs text-green-700">
                                                        {device.deviceType} • {device.status} • MAC: {device.macAddress || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2 flex-shrink-0">
                                                <Badge variant="default" class="bg-green-600 hover:bg-green-700 text-xs font-medium">
                                                    {device.profileAssignment.status}
                                                </Badge>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    on:click={() => handleUnassign(device.id)}
                                                    class="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                                                >
                                                    <X class="h-3 w-3 mr-1" />
                                                    Unassign
                                                </Button>
                                                {#if device.connected}
                                                    <div class="w-2 h-2 bg-green-500 rounded-full shadow-sm" title="Online"></div>
                                                {:else}
                                                    <div class="w-2 h-2 bg-gray-400 rounded-full shadow-sm" title="Offline"></div>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="flex items-center justify-center h-full text-center text-green-600">
                                        <div>
                                            <Users class="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p class="text-sm font-medium">No devices assigned</p>
                                            <p class="text-xs opacity-75">Select devices from the right panel</p>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                            {#if assignedTotalPages > 1}
                                <div class="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
                                    <div class="flex items-center gap-2 text-sm text-gray-600">
                                        <span>Showing {Math.min(((assignedPage - 1) * itemsPerPage) + 1, assignedTotal)} to {Math.min(assignedPage * itemsPerPage, assignedTotal)} of {assignedTotal} devices</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            on:click={() => { assignedPage = Math.max(1, assignedPage - 1); handleAssignedPageChange(); }}
                                            disabled={assignedPage <= 1}
                                            class="h-8 w-8 p-0"
                                        >
                                            <ChevronLeft class="h-4 w-4" />
                                        </Button>
                                        
                                        {#each assignedPageNumbers as pageNum}
                                            <Button
                                                variant={pageNum === assignedPage ? "default" : "outline"}
                                                size="sm"
                                                on:click={() => { assignedPage = pageNum; handleAssignedPageChange(); }}
                                                class="h-8 w-8 p-0"
                                            >
                                                {pageNum}
                                            </Button>
                                        {/each}
                                        
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            on:click={() => { assignedPage = Math.min(assignedTotalPages, assignedPage + 1); handleAssignedPageChange(); }}
                                            disabled={assignedPage >= assignedTotalPages}
                                            class="h-8 w-8 p-0"
                                        >
                                            <ChevronRight class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            {/if}
                        </CardContent>
                    </Card>

                    <!-- Available Devices Section (Right) -->
                    <Card class="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent">
                        <CardHeader class="pb-3">
                            <CardTitle class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="p-2 bg-blue-100 rounded-lg">
                                        <Settings class="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-semibold text-blue-800">Available Devices</h3>
                                        <p class="text-sm text-blue-600">Select devices to assign</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge variant="secondary" class="bg-blue-100 text-blue-700">
                                        {availableTotal}
                                    </Badge>
                        {#if availableDevices.length > 0}
                            <Button
                                variant="outline"
                                size="sm"
                                on:click={handleAddAll}
                                class="text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400"
                            >
                                <Plus class="h-4 w-4 mr-1" />
                                Add All
                            </Button>
                        {/if}
                        <Button
                            variant="outline"
                            size="sm"
                            on:click={async () => {
                                showTagModal = true;
                                await loadAllTags();
                            }}
                            class="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                        >
                            <Tag class="h-4 w-4 mr-1" />
                            Assign by Tag
                        </Button>
                                </div>
                            </CardTitle>
                            <div class="mt-3 space-y-2">
                                <Input
                                    bind:value={availableSearchTerm}
                                    on:input={handleAvailableSearchChange}
                                    placeholder="Search available devices..."
                                    class="w-full"
                                />
                                <SearchableTagSelect
                                    value={availableTagFilter}
                                    placeholder="Filter by tag..."
                                    options={allAvailableTags}
                                    on:change={(e) => {
                                        availableTagFilter = e.detail;
                                        handleAvailableFilterChange();
                                    }}
                                />
                            </div>
                </CardHeader>
                <CardContent>
                            <div class="space-y-1">
                                {#if availableDevices.length > 0}
                                    {#each availableDevices as device}
                                        {@const isSelected = selectedDevices.includes(device.id)}
                                        <div class="flex items-center justify-between p-2 border rounded bg-blue-50 border-blue-200 {isSelected ? 'ring-2 ring-blue-400' : ''}">
                                            <div class="flex items-center gap-2 min-w-0 flex-1">
                                                <Checkbox 
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleDevice(device.id)}
                                                    class="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex-shrink-0"
                                                />
                                                <div class="p-1 bg-blue-100 rounded flex-shrink-0">
                                                    <Settings class="h-3 w-3 text-blue-600" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <div class="text-sm font-medium text-blue-900 truncate">{device.name}</div>
                                                    <div class="text-xs text-blue-700">
                                                        {device.deviceType} • {device.status} • MAC: {device.macAddress || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2 flex-shrink-0">
                                                <Badge variant="secondary" class="bg-blue-100 text-blue-700 text-xs font-medium">
                                                    Available
                                                </Badge>
                                                {#if device.connected}
                                                    <div class="w-2 h-2 bg-green-500 rounded-full shadow-sm" title="Online"></div>
                                                {:else}
                                                    <div class="w-2 h-2 bg-gray-400 rounded-full shadow-sm" title="Offline"></div>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="flex items-center justify-center h-full text-center text-blue-600">
                                        <div>
                                            <Settings class="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p class="text-sm font-medium">No available devices</p>
                                            <p class="text-xs opacity-75">All devices are already assigned</p>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                            {#if availableTotalPages > 1}
                                <div class="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
                                    <div class="flex items-center gap-2 text-sm text-gray-600">
                                        <span>Showing {Math.min(((availablePage - 1) * itemsPerPage) + 1, availableTotal)} to {Math.min(availablePage * itemsPerPage, availableTotal)} of {availableTotal} devices</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            on:click={() => { availablePage = Math.max(1, availablePage - 1); handleAvailablePageChange(); }}
                                            disabled={availablePage <= 1}
                                            class="h-8 w-8 p-0"
                                        >
                                            <ChevronLeft class="h-4 w-4" />
                                        </Button>
                                        
                                        {#each availablePageNumbers as pageNum}
                                            <Button
                                                variant={pageNum === availablePage ? "default" : "outline"}
                                                size="sm"
                                                on:click={() => { availablePage = pageNum; handleAvailablePageChange(); }}
                                                class="h-8 w-8 p-0"
                                            >
                                                {pageNum}
                                            </Button>
                                        {/each}
                                        
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            on:click={() => { availablePage = Math.min(availableTotalPages, availablePage + 1); handleAvailablePageChange(); }}
                                            disabled={availablePage >= availableTotalPages}
                                            class="h-8 w-8 p-0"
                                        >
                                            <ChevronRight class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            {/if}
                </CardContent>
            </Card>
                </div>
            </Tabs.Content>
        </Tabs.Root>
    </div>
</AdminPageLayout>

<!-- Device Selector Modal -->
<DeviceSelector
    bind:open={showDeviceSelector}
    profileId={data.profile.id}
    on:select={handleDeviceSelect}
    on:close={() => showDeviceSelector = false}
/>

<!-- Tag Assignment Modal -->
{#if showTagModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 h-[90vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
                <h2 class="text-lg font-semibold">Assign Devices by Tag</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => {
                        showTagModal = false;
                        selectedTagId = '';
                        tagDevices = [];
                    }}
                >
                    <X class="h-4 w-4" />
                </Button>
            </div>
            
            <div class="p-6 space-y-4 flex-1 overflow-y-auto">
                <div>
                    <label class="block text-sm font-medium mb-2">Select Tag</label>
                    <SearchableTagSelect
                        value={selectedTagId}
                        placeholder="Choose a tag..."
                        options={allTags}
                        on:change={(e) => handleTagSelectionChange(e.detail)}
                    />
                </div>
                
                {#if selectedTagId}
                    <div class="border rounded-lg p-4">
                        <h3 class="font-medium mb-3">Available Devices with this Tag</h3>
                        {#if tagDevicesLoading}
                            <div class="flex items-center justify-center py-8">
                                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        {:else if tagDevices.length === 0}
                            <p class="text-muted-foreground text-center py-4">No available devices with this tag</p>
                        {:else}
                            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
                                {#each tagDevices as device}
                                    <div class="flex items-center justify-between p-3 border rounded-md">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <Monitor class="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p class="font-medium text-sm">{device.name}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {device.deviceType} • {device.macAddress || 'No MAC'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" class="text-xs">
                                            {device.status}
                                        </Badge>
                                    </div>
                                {/each}
                            </div>
                            <div class="mt-4 p-3 bg-blue-50 rounded-md">
                                <p class="text-sm text-blue-700">
                                    <strong>{tagDevices.length}</strong> device{tagDevices.length !== 1 ? 's' : ''} will be assigned to this profile
                                </p>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            
            <div class="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
                <Button
                    variant="outline"
                    on:click={() => {
                        showTagModal = false;
                        selectedTagId = '';
                        tagDevices = [];
                    }}
                >
                    Cancel
                </Button>
                <Button
                    on:click={handleAssignByTag}
                    disabled={!selectedTagId || tagDevices.length === 0 || deviceLoading}
                    class="bg-blue-600 hover:bg-blue-700"
                >
                    {#if deviceLoading}
                        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {/if}
                    Assign {tagDevices.length} Device{tagDevices.length !== 1 ? 's' : ''}
                </Button>
            </div>
        </div>
    </div>
{/if}
