<script lang="ts">
    import { ArrowLeft, Save, Plus, Trash2 } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Switch } from "$lib/components/ui/switch";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import DeviceProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/DeviceProfileSettingsEditor.svelte';
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    
    export let data;
    const title = "Create Device Profile";
    
    // Breadcrumbs for navigation
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Device Profiles", "/admin/iot/device-profiles"],
        ["New Profile", "/admin/iot/device-profiles/new"]
    ];
    
    // Initialize form handler
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/iot/device-profiles',
        validateOnInput: false, // Don't validate on input to avoid showing errors immediately
        // dataType: 'json', // Temporarily remove to test if this is causing the issue
        onSuccess: () => {
            toast.success('Device profile created successfully');
        }
    });

    // Debug logging
    $: console.log('Form data:', $form);
    $: console.log('Form errors:', $errors);
    $: console.log('Form valid:', $form.valid);
    $: console.log('Form posted:', $form.posted);
    $: console.log('Form constraints:', $constraints);

    // Local state for settings management - parse from JSON string
    let localSettings = [];
    
    // Parse settings from form data
    try {
        localSettings = JSON.parse($form.settings || '[]');
    } catch (e) {
        console.error('Error parsing settings:', e);
        localSettings = [];
    }
    
    // Watch for form changes and update local settings
    $: if ($form.settings) {
        try {
            localSettings = JSON.parse($form.settings || '[]');
        } catch (e) {
            console.error('Error parsing settings:', e);
            localSettings = [];
        }
    }


    // Data type options
    const dataTypes = [
        { value: 'string', label: 'Text' },
        { value: 'number', label: 'Number' },
        { value: 'boolean', label: 'Boolean (Yes/No)' },
        { value: 'select', label: 'Select (Dropdown)' },
        { value: 'password', label: 'Password' },
        { value: 'time', label: 'Time' }
    ];

    // Category options
    const categories = [
        'General',
        'Security',
        'Display',
        'Audio',
        'Power',
        'Maintenance',
        'Network',
        'Storage'
    ];

    // Predefined setting definitions
    const availableSettings = [
        {
            key: 'kiosk_lock_mode',
            label: 'Kiosk Lock Mode',
            dataType: 'select',
            category: 'Security',
            defaultValue: 'disabled'
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
            defaultValue: '1920x1080'
        },
        {
            key: 'screen_orientation',
            label: 'Screen Orientation',
            dataType: 'select',
            category: 'Display',
            defaultValue: 'landscape'
        },
        {
            key: 'enable_audio',
            label: 'Enable Audio',
            dataType: 'select',
            category: 'Audio',
            defaultValue: 'enabled'
        },
        {
            key: 'volume_level',
            label: 'Volume Level',
            dataType: 'number',
            category: 'Audio',
            defaultValue: '50'
        },
        {
            key: 'power_management_schedule',
            label: 'Power Management Schedule',
            dataType: 'select',
            category: 'Power',
            defaultValue: 'disabled'
        },
        {
            key: 'reboot_schedule',
            label: 'Reboot Schedule',
            dataType: 'select',
            category: 'Maintenance',
            defaultValue: 'disabled'
        },
        {
            key: 'download_schedule',
            label: 'Download Schedule',
            dataType: 'select',
            category: 'Maintenance',
            defaultValue: 'disabled'
        }
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/iot/device-profiles'),
            variant: "outline"
        },
        {
            label: "Save Changes",
            icon: Save,
            onClick: () => {
                const formElement = document.querySelector('form[action="?/create"]');
                if (formElement && 'requestSubmit' in formElement) {
                    formElement.requestSubmit();
                }
            }
        }
    ]}
    compact={true}
>
            <FormContainer
                method="POST"
                action="?/create"
                {enhance}
                errorMessage={$errorMessage}
            >

            <!-- Basic Profile Information -->
            <Card class="mb-6">
                    <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-4">
                    <FormRow>
                        <FormField id="profile-name" label="Profile Name" required error={$errors.name?.toString()}>
                                <Input 
                                    name="name" 
                                    bind:value={$form.name}
                                    placeholder="Enter profile name"
                                class={$errors.name ? 'border-red-500' : ''}
                                />
                            </FormField>
                    </FormRow>
                    
                    <FormRow>
                        <FormField id="profile-description" label="Description" error={$errors.description?.toString()}>
                                <Textarea 
                                    name="description"
                                    bind:value={$form.description} 
                                    placeholder="Enter profile description"
                                rows="3"
                                class={$errors.description ? 'border-red-500' : ''}
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
</AdminPageLayout>