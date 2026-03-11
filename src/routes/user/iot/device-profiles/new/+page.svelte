<script lang="ts">
    import { ArrowLeft, Save, Settings } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import * as Tabs from "$lib/components/ui/tabs";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import ProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/ProfileSettingsEditor.svelte';
    import CharacterCount from "$lib/components/ui_components_sveltekit/form/CharacterCount.svelte";
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { goto } from "$app/navigation";
    import { DESCRIPTION_MAX } from "$lib/constants/description";
    import { toast } from "svelte-sonner";
    
    export let data;
    const title = "Create Device Profile";
    
    // Breadcrumbs for navigation
    const pageCrumbs: [string, string][] = [
        ["User", "/user"],
        ["IOT", ""],
        ["Device Profiles", "/user/iot/device-profiles"],
        ["New Profile", "/user/iot/device-profiles/new"]
    ];
    
    // Initialize form handler
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/user/iot/device-profiles',
        validateOnInput: true,
        onSuccess: () => {
            toast.success('Device profile created successfully');
        }
    });

    // Local state for settings management
    let localSettings: any[] = [];
    
    // Parse settings from form data
    try {
        localSettings = JSON.parse($form.settings || '[]');
    } catch (e) {
        console.error('Error parsing settings:', e);
        localSettings = [];
    }
    
    let activeTab = "settings";
    
    // Update form settings when localSettings changes
    $: $form.settings = JSON.stringify(localSettings);
    
    // Reference to ProfileSettingsEditor component for validation
    let profileSettingsEditor: any;
</script>

<UserPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/user/iot/device-profiles'),
            variant: "outline"
        },
        {
            label: "Create Profile",
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
                
                const formElement = document.querySelector('form[action="?/create"]');
                if (formElement) {
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
        <!-- Single Settings Tab -->
        <Tabs.Root bind:value={activeTab} class="space-y-6">
            <Tabs.List class="grid w-full grid-cols-1 bg-slate-100 p-1 rounded-lg">
                <Tabs.Trigger value="settings" class="flex items-center gap-2">
                    <Settings class="w-4 h-4" />
                    Settings
                </Tabs.Trigger>
            </Tabs.List>
            
            <!-- Settings Tab -->
            <Tabs.Content value="settings" class="space-y-6">
                <FormContainer
                    method="POST"
                    action="?/create"
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
                                        selected={{ 
                                            value: $form.isActive, 
                                            label: $form.isActive === 'true' ? 'Active' : 'Inactive' 
                                        }}
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
                                        maxlength={DESCRIPTION_MAX}
                                    />
                                    <CharacterCount current={$form.description?.length ?? 0} max={DESCRIPTION_MAX} />
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
        </Tabs.Root>
    </div>
</UserPageLayout>
