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
    import ProfileSettingsEditor from '$lib/components/ui_components_sveltekit/form/ProfileSettingsEditor.svelte';
    import DeviceAssignmentManager from '$lib/components/ui_components_sveltekit/form/DeviceAssignmentManager.svelte';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
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
    
    let activeTab = $page.url.searchParams.get('tab') || "settings";

    // Update form settings when localSettings changes
    $: $form.settings = JSON.stringify(localSettings);
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
                    <ProfileSettingsEditor bind:settings={localSettings} {availableSettings} />
                    
                    <!-- Hidden input for settings JSON -->
                    <input type="hidden" name="settings" bind:value={$form.settings} />
                </FormContainer>
            </Tabs.Content>
            
            <!-- Devices Tab -->
            <Tabs.Content value="devices" class="space-y-6">
                <DeviceAssignmentManager profileId={data.profile.id} isAdmin={true} />
            </Tabs.Content>
        </Tabs.Root>
    </div>
</AdminPageLayout>
