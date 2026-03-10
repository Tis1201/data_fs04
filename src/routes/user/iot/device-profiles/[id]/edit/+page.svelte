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
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import ProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/ProfileSettingsEditor.svelte';
    import DeviceAssignmentManager from '$lib/components/ui_components_sveltekit/form/DeviceAssignmentManager.svelte';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";
    import { DESCRIPTION_MAX } from "$lib/constants/description";
    // MQTT handles profile updates automatically - no import needed
    
    import { getDeviceProfileEditBreadcrumbs } from "$lib/utils/navigation";
    
    export let data;
    const title = "Edit Device Profile";
    
    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getDeviceProfileEditBreadcrumbs('user', data.profile?.name, data.profile?.id);
    
    // Initialize form handler
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        validateOnInput: true,
        onSuccess: (result) => {
            console.log('onSuccess called with result:', result);
            // Use setTimeout to ensure toast renders after DOM updates
            setTimeout(() => {
                toast.success('Device profile updated successfully');
            }, 0);
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
    // Connection ID no longer needed - MQTT handles subscriptions automatically
    
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
        console.log('[AdminDeviceProfileDetail] onMount started for profile:', data.profile.id);

        // Device profile subscriptions now handled via MQTT automatically
        // MQTT client automatically receives profile updates based on user permissions
        console.debug('[DeviceProfileDetail] Profile updates will be received via MQTT', { profileId: data.profile.id });
    });
</script>

<UserPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto(`/user/iot/device-profiles`),
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
                                        maxlength={DESCRIPTION_MAX}
                                    />
                                    <p class="text-xs mt-1" class:text-amber-600={($form.description?.length ?? 0) === DESCRIPTION_MAX} class:text-muted-foreground={($form.description?.length ?? 0) !== DESCRIPTION_MAX}>
                                        {$form.description?.length ?? 0}/{DESCRIPTION_MAX} characters
                                    </p>
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
                    isAdmin={false} 
                    onTabChange={handleTabChange}
                />
            </Tabs.Content>
        </Tabs.Root>
    </div>
</UserPageLayout>
