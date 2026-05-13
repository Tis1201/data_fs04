<script lang="ts">
    import { ArrowLeft } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import AppSelector from "$lib/components/bundles_ui/app_select/AppSelector.svelte";
    import DeviceSelector from "$lib/components/bundles_ui/device_select/DeviceSelector.svelte";
    import * as Select from "$lib/components/ui/select";
    import { Plus } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { PIN_RULE_NAME_MAX, PIN_RULE_DESCRIPTION_MAX } from '$lib/constants/pinRule';
    import CharacterCount from '$lib/components/ui_components_sveltekit/form/CharacterCount.svelte';

    /**
     * Props for PinRuleCreatePage component
     */
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string; // "/admin" or "/user"
    export let apiPrefix: string; // "/api/v2"
    export let context: 'admin' | 'user' = 'admin';
    export let ruleType: 'admin_custom' | 'user_custom' = 'admin_custom';

    let formData = {
        name: '',
        description: '',
        apps: '',
        targetType: 'all',
        isActive: true
    };

    let isSubmitting = false;
    let appPickerOpen = false;
    let devicePickerOpen = false;
    let selectedApps = new Set<string>();
    let selectedDevices: { id: string; name: string }[] = [];

    function syncAppsToForm() {
        formData.apps = Array.from(selectedApps).join(', ');
    }

    function handleAppsSelected(e: CustomEvent<{ id: string; name: string; packageName?: string | null; autoOpen: boolean }[]>) {
        const pkgs = e.detail.map(x => x.packageName || x.name).filter(Boolean) as string[];
        selectedApps = new Set([...Array.from(selectedApps), ...pkgs]);
        syncAppsToForm();
        appPickerOpen = false;
    }

    function removeDevice(deviceId: string) {
        selectedDevices = selectedDevices.filter(d => d.id !== deviceId);
    }

    function handleDevicesSelected(e: CustomEvent<{ id: string; name: string }[]>) {
        selectedDevices = [...selectedDevices, ...e.detail];
        devicePickerOpen = false;
    }

    async function handleSubmit() {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (formData.name.trim().length > PIN_RULE_NAME_MAX) {
            toast.error(`Name must be at most ${PIN_RULE_NAME_MAX} characters`);
            return;
        }
        const descVal = formData.description?.trim() || '';
        if (descVal.length > PIN_RULE_DESCRIPTION_MAX) {
            toast.error(`Description must be at most ${PIN_RULE_DESCRIPTION_MAX} characters`);
            return;
        }

        if (!formData.apps.trim()) {
            toast.error('At least one app is required');
            return;
        }

        if (formData.targetType === 'specific' && selectedDevices.length === 0) {
            toast.error('Please select at least one device for specific targeting');
            return;
        }

        isSubmitting = true;

        try {
            const response = await fetch('/api/v2/pin-rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    apps: Array.from(selectedApps),
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'specific' ? selectedDevices.map(d => d.id) : [],
                    isActive: formData.isActive,
                    ruleType
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.success('Pin rule created successfully');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                toast.error('Failed to create pin rule', {
                    description: result?.error?.message || result?.message || 'Unknown error'
                });
            }
        } catch (error) {
            toast.error('Failed to create pin rule', {
                description: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>Create Pin Rule{context === 'admin' ? ' - Admin Panel' : ''}</title>
    <meta name="description" content="Create a new pin rule for device apps" />
</svelte:head>

<AdminPageLayout
    {title}
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: "Back to Pin Rules",
            icon: ArrowLeft,
            onClick: () => goto(`${basePath}/iot/pin-rules`)
        }
    ]}
>
    <div class="max-w-5xl mx-auto">
        <Card>
            <CardHeader class="text-center">
                <CardTitle>Create New Pin Rule</CardTitle>
                <CardDescription>
                    Create a new pin rule to manage app pinning on devices
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
                <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                    <!-- Name -->
                    <div class="space-y-2">
                        <Label for="name">Name <span class="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            bind:value={formData.name}
                            placeholder="Enter rule name"
                            required
                            maxlength={PIN_RULE_NAME_MAX}
                        />
                        <CharacterCount current={formData.name.length} max={PIN_RULE_NAME_MAX} />
                    </div>

                    <!-- Description -->
                    <div class="space-y-2">
                        <Label for="description">Description</Label>
                        <Textarea
                            id="description"
                            bind:value={formData.description}
                            placeholder="Enter rule description (optional)"
                            rows={3}
                            maxlength={PIN_RULE_DESCRIPTION_MAX}
                        />
                        <CharacterCount current={formData.description.length} max={PIN_RULE_DESCRIPTION_MAX} />
                    </div>

                    <!-- Apps (multi-select picker with search) -->
                    <div class="space-y-2">
                        <Label>Apps <span class="text-red-500">*</span></Label>
                        {#if selectedApps.size > 0}
                            <div class="border rounded-md bg-muted/30 p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="font-medium text-sm">Selected Apps <span class="text-muted-foreground">({selectedApps.size})</span></h4>
                                    <Button type="button" variant="ghost" size="sm" on:click={() => { selectedApps = new Set(); syncAppsToForm(); }}>Clear</Button>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    {#each Array.from(selectedApps) as pkg}
                                        <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                            <span>{pkg}</span>
                                            <button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => { selectedApps.delete(pkg); selectedApps = new Set(selectedApps); syncAppsToForm(); }}>✕</button>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                        <div>
                            <Button type="button" variant="outline" class="flex items-center gap-2" on:click={() => appPickerOpen = true}>
                                <Plus class="w-4 h-4" /> Select Apps
                            </Button>
                            <AppSelector 
                                bind:open={appPickerOpen}
                                bundleId={''}
                                {apiPrefix}
                                resourceMode={true}
                                resourcesEndpoint={'/api/v2/resources/apps'}
                                resourceExcludePackages={Array.from(selectedApps)}
                                on:select={handleAppsSelected}
                                on:close={() => (appPickerOpen = false)}
                            />
                        </div>
                        <input type="hidden" name="apps" value={formData.apps} />
                    </div>

                    <!-- Target Devices -->
                    <div class="space-y-2">
                        <Label for="targetType">Target Devices <span class="text-red-500">*</span></Label>
                                <Select.Root 
                                    onSelectedChange={(selected) => { 
                                formData.targetType = selected?.value ?? 'all';
                            }}
                            selected={{ 
                                value: formData.targetType, 
                                label: formData.targetType === 'all' ? 'All Devices' : 'Specific Devices' 
                            }}
                        >
                            <Select.Trigger class="w-full">
                                <Select.Value placeholder="Select target type" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="all">All Devices</Select.Item>
                                <Select.Item value="specific">Specific Devices</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <!-- Specific Devices Selection (shown when targetType is 'specific') -->
                    {#if formData.targetType === 'specific'}
                        <div class="space-y-2">
                            <Label>Selected Devices</Label>
                            {#if selectedDevices.length > 0}
                                <div class="border rounded-md bg-muted/30 p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <h4 class="font-medium text-sm">Selected Devices <span class="text-muted-foreground">({selectedDevices.length})</span></h4>
                                        <Button type="button" variant="ghost" size="sm" on:click={() => { selectedDevices = []; }}>Clear</Button>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        {#each selectedDevices as device}
                                            <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                                <span>{device.name || device.id}</span>
                                                <button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => removeDevice(device.id)}>✕</button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                            <div>
                                <Button type="button" variant="outline" class="flex items-center gap-2" on:click={() => devicePickerOpen = true}>
                                    <Plus class="w-4 h-4" /> Select Devices
                                </Button>
                                <DeviceSelector 
                                    bind:open={devicePickerOpen}
                                    bundleId=""
                                    {apiPrefix}
                                    devicesEndpoint="/api/v2/devices/select"
                                    excludeDeviceIds={selectedDevices.map(d => d.id)}
                                    on:select={handleDevicesSelected}
                                    on:close={() => (devicePickerOpen = false)}
                                />
                            </div>
                        </div>
                    {/if}

                    <!-- Active Status -->
                    <div class="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            bind:checked={formData.isActive}
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label for="isActive">Active</Label>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex justify-end space-x-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            on:click={() => goto(`${basePath}/iot/pin-rules`)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {#if isSubmitting}
                                <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            {/if}
                            {isSubmitting ? 'Creating...' : 'Create Rule'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
</AdminPageLayout>

<style>

</style>

