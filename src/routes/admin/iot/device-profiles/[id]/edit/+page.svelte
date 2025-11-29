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
    import { superForm } from 'sveltekit-superforms/client';
    import ProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/ProfileSettingsEditor.svelte';
    import DeviceAssignmentManager from '$lib/components/ui_components_sveltekit/form/DeviceAssignmentManager.svelte';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { toast } from "svelte-sonner";
    import { onMount, onDestroy } from "svelte";
    import { sseStore } from "$lib/stores/sse-store";
    import { writable } from 'svelte/store';
    
    export let data;
    const title = "Edit Device Profile";
    
    // Breadcrumbs for navigation
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Device Profiles", "/admin/iot/device-profiles"],
        ["Edit", `/admin/iot/device-profiles/${data.profile.id}/edit`]
    ];
    
    // Initialize form handler using superForm directly
    const errorMessage = writable(null);
    const { form, errors, enhance, submitting, constraints } = superForm(data.form, {
        taintedMessage: false,
        invalidateAll: false, // Prevent automatic page invalidation
        resetForm: false, // Don't reset the form after submission
        delayMs: 300,
        timeoutMs: 8000,
        dataType: 'form',
        
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success('Device profile updated successfully', {
                    description: 'All changes have been saved.',
                    duration: 4000
                });
            } else if (result.type === "failure") {
                toast.error('Validation Error', {
                    description: 'Please check your input and try again.',
                    duration: 6000
                });
            } else if (result.type === "error") {
                toast.error('Server Error', {
                    description: 'An unexpected error occurred. Please try again later.',
                    duration: 6000
                });
            }
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
    
    let activeTab = $page.url.searchParams.get('tab') || "settings";

    // Update form settings when localSettings changes
    $: $form.settings = JSON.stringify(localSettings);

    // Create reactive selected value for the Select component
    let selectedStatus = { value: 'true', label: 'Active' };
    $: selectedStatus = {
        value: $form.isActive,
        label: $form.isActive === 'true' ? 'Active' : 'Inactive'
    };
    
    // Use global SSE store (managed by AuthStateHandler)
    let lastSubscribedConnectionId: string | null = null;
    
    // Reference to ProfileSettingsEditor component for validation
    let profileSettingsEditor: any;
    
    // Function to handle tab changes
    function handleTabChange(tab: string) {
        activeTab = tab;
    }

    // Update URL when tab changes (client-side only)
    $: if (typeof window !== 'undefined' && activeTab && activeTab !== ($page.url.searchParams.get('tab') || "settings")) {
        const url = new URL($page.url);
        url.searchParams.set('tab', activeTab);
        goto(url.pathname + url.search, { replaceState: true });
    }
    
    onMount(() => {
        // Use global SSE connection (managed by AuthStateHandler)
        console.log('[DeviceProfileEdit] Using global SSE connection:', {
            connectionId: sseStore.connectionId,
            isConnected: sseStore.isConnected
        });

        // Function to subscribe to device profile channel
        async function subscribeToDeviceProfileChannel(connId: string) {
            if (connId === lastSubscribedConnectionId) {
                console.debug('[DeviceProfileEdit] Already subscribed for', connId);
                return;
            }
            
            console.log('[DeviceProfileEdit] Subscribing to device profile channel', { 
                profileId: data.profile.id, 
                connId 
            });
            
            try {
                const response = await fetch(`/api/sse/subscribe/device-profile/${data.profile.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ connectionId: connId })
                });
                
                if (response.ok) {
                    lastSubscribedConnectionId = connId;
                    console.log('[DeviceProfileEdit] ✅ Successfully subscribed to device profile channel for', connId);
                } else {
                    console.error('[DeviceProfileEdit] Subscribe failed with status:', response.status);
                    const text = await response.text();
                    console.error('[DeviceProfileEdit] Subscribe error:', text);
                }
            } catch (err) {
                console.warn('[DeviceProfileEdit] Subscribe failed:', err);
            }
        }
        
        // Check if SSE is already connected and subscribe immediately
        if (sseStore.connectionId && sseStore.isConnected) {
            console.log('[DeviceProfileEdit] SSE already connected, subscribing immediately');
            subscribeToDeviceProfileChannel(sseStore.connectionId);
        }

        // Listen for future connection events
        const connectedUnsub = sseStore.on('connected', (msg: any) => {
            console.log('[DeviceProfileEdit] SSE connected event received:', msg);
            const connId = msg?.data?.connectionId;
            if (!connId) {
                console.warn('[DeviceProfileEdit] No connectionId in connected event');
                return;
            }
            
            // Subscribe immediately - the event already indicates connection is ready
            console.log('[DeviceProfileEdit] Connection ready, subscribing to device profile channel');
            subscribeToDeviceProfileChannel(connId);
        });

        return () => {
            connectedUnsub();
        };
    });

    onDestroy(() => {
        // Don't disconnect global SSE - other components/pages may still be using it
        console.log('[DeviceProfileEdit] Keeping global SSE connection active for other components');
    });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto(`/admin/iot/device-profiles`),
            variant: "outline"
        },
        {
            label: "Save Changes",
            icon: Save,
            onClick: () => {
                // Validate settings before submitting
                if (profileSettingsEditor && typeof profileSettingsEditor.validateSettings === 'function') {
                    const isValid = profileSettingsEditor.validateSettings();
                    if (!isValid) {
                        toast.error('Please fix validation errors before saving');
                        // Switch to settings tab if not already there
                        activeTab = 'settings';
                        return;
                    }
                }
                
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
                            <FormRow columns={2}>
                                <FormField id="name" label="Profile Name" error={$errors.name?.toString()}>
                                    <Input 
                                        bind:value={$form.name} 
                                        name="name" 
                                        placeholder="Enter profile name"
                                        required
                                    />
                                </FormField>
                                <FormField id="isActive" label="Status" error={$errors.isActive?.toString()}>
                                    <Select 
                                        selected={selectedStatus}
                                        onSelectedChange={(selected) => {
                                            if (selected?.value !== undefined) {
                                                $form.isActive = selected.value;
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Active</SelectItem>
                                            <SelectItem value="false">Inactive</SelectItem>
                                        </SelectContent>
                                        <input type="hidden" name="isActive" bind:value={$form.isActive} />
                                    </Select>
                                </FormField>
                            </FormRow>
                            <FormRow columns={1}>
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
                    <ProfileSettingsEditor bind:this={profileSettingsEditor} bind:settings={localSettings} {availableSettings} />
                    
                    <!-- Hidden input for settings JSON -->
                    <input type="hidden" name="settings" bind:value={$form.settings} />
                </FormContainer>
            </Tabs.Content>
            
            <!-- Devices Tab -->
            <Tabs.Content value="devices" class="space-y-6">
                <DeviceAssignmentManager 
                    profileId={data.profile.id} 
                    isAdmin={true} 
                    connId={lastSubscribedConnectionId || ''}
                    {sseStore}
                    onTabChange={handleTabChange}
                />
            </Tabs.Content>
        </Tabs.Root>
    </div>
</AdminPageLayout>
