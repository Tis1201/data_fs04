<script lang="ts">
    import { ArrowLeft, Plus } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
    import AppSelector from '$lib/components/ui_components_sveltekit/bundles/app_select/AppSelector.svelte';
    import DeviceSelector from '$lib/components/ui_components_sveltekit/bundles/device_select/DeviceSelector.svelte';
    import { toast } from 'svelte-sonner';
    import { onMount } from 'svelte';

    export let rule: any;
    export let basePath: string;
    export let apiPrefix: string;

    let formData = {
        name: '',
        description: '',
        targetType: 'all',
        isActive: true
    };

    let isSubmitting = false;
    let appPickerOpen = false;
    let devicePickerOpen = false;

    let selectedApps = new Set<string>();
    let selectedDevices = new Map<string, string>(); // id -> name

    let initialized = false;
    $: if (rule && !initialized) {
        // Initialize form from rule once; do not overwrite user edits
        formData.name = rule.name || '';
        formData.description = rule.description || '';
        formData.targetType = (rule.targetType === 'specific' || (rule.targetValue && rule.targetValue.length > 0)) ? 'specific' : 'all';
        formData.isActive = rule.isActive ?? true;
        selectedApps = new Set<string>(rule.apps || []);
        initialized = true;
    }

    onMount(() => {
        if (rule?.targetType === 'specific' && rule?.targetValue?.length) {
            loadSelectedDevices();
        }
    });

    async function loadSelectedDevices() {
        if (!rule?.targetValue?.length) return;
        try {
            const res = await fetch(`${apiPrefix}/devices/select?includeDeviceIds=${rule.targetValue.join(',')}`);
            if (res.ok) {
                const data = await res.json();
                const devices = data?.data?.devices ?? data?.devices ?? [];
                selectedDevices = new Map(devices.map((d: any) => [d.id, d.name || d.id]));
            }
        } catch {
            selectedDevices = new Map();
        }
    }

    function syncDevicesToForm() {
        // Kept for consistency with Add; Edit submits selectedDevices directly
    }

    function handleAppsSelected(e: CustomEvent<{ id: string; name: string; packageName?: string | null; autoOpen: boolean }[]>) {
        const pkgs = e.detail.map((x) => x.packageName || x.name).filter(Boolean) as string[];
        selectedApps = new Set([...Array.from(selectedApps), ...pkgs]);
        appPickerOpen = false;
    }

    function handleDevicesSelected(e: CustomEvent<{ id: string; name: string }[]>) {
        for (const d of e.detail) {
            selectedDevices.set(d.id, d.name);
        }
        selectedDevices = new Map(selectedDevices);
        devicePickerOpen = false;
    }

    async function handleSubmit() {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (selectedApps.size === 0) {
            toast.error('At least one app is required');
            return;
        }
        if (formData.targetType === 'specific' && selectedDevices.size === 0) {
            toast.error('Please select at least one device for specific targeting');
            return;
        }
        isSubmitting = true;
        try {
            const response = await fetch(`${apiPrefix}/pin-rules/${rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description?.trim() || null,
                    apps: Array.from(selectedApps),
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'specific' ? Array.from(selectedDevices.keys()) : [],
                    isActive: formData.isActive
                })
            });
            const result = await response.json();
            if (result.success) {
                toast.success('Pin rule updated successfully');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                toast.error(result.message || 'Failed to update pin rule');
            }
        } catch {
            toast.error('Failed to update pin rule');
        } finally {
            isSubmitting = false;
        }
    }

    const pageCrumbs: [string, string][] = [
        ['Admin', '/admin'],
        ['IoT', '/admin/iot'],
        ['Pin Rules', `${basePath}/iot/pin-rules`]
    ];
</script>

<svelte:head>
    <title>Edit Pin Rule - Admin Panel</title>
    <meta name="description" content="Edit pin rule for device apps" />
</svelte:head>

<AdminPageLayout
    title="Edit Pin Rule"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: 'Back to Pin Rules',
            icon: ArrowLeft,
            onClick: () => goto(`${basePath}/iot/pin-rules`)
        }
    ]}
>
    <div class="max-w-5xl mx-auto">
        <Card>
            <CardHeader class="text-center">
                <CardTitle>Edit Pin Rule</CardTitle>
                <CardDescription>
                    Update pin rule to manage app pinning on devices
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
                <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                    <!-- Name -->
                    <div class="space-y-2">
                        <Label for="name">Name *</Label>
                        <Input
                            id="name"
                            bind:value={formData.name}
                            placeholder="Enter rule name"
                            required
                        />
                    </div>

                    <!-- Description -->
                    <div class="space-y-2">
                        <Label for="description">Description</Label>
                        <Textarea
                            id="description"
                            bind:value={formData.description}
                            placeholder="Enter rule description (optional)"
                            rows={3}
                        />
                    </div>

                    <!-- Apps (multi-select picker) -->
                    <div class="space-y-2">
                        <Label>Apps *</Label>
                        {#if selectedApps.size > 0}
                            <div class="border rounded-md bg-muted/30 p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="font-medium text-sm">Selected Apps <span class="text-muted-foreground">({selectedApps.size})</span></h4>
                                    <Button type="button" variant="ghost" size="sm" on:click={() => { selectedApps = new Set(); }}>Clear</Button>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    {#each Array.from(selectedApps) as pkg}
                                        <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                            <span>{pkg}</span>
                                            <button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => { selectedApps.delete(pkg); selectedApps = new Set(selectedApps); }}>✕</button>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                        <div>
                            <Button type="button" variant="outline" class="flex items-center gap-2" on:click={() => appPickerOpen = true}>
                                <Plus class="w-4 h-4" /> Select Apps
                            </Button>
                            {#if appPickerOpen}
                            <AppSelector
                                open={true}
                                bundleId={''}
                                apiPrefix={apiPrefix}
                                resourceMode={true}
                                resourcesEndpoint={`${apiPrefix}/resources/apps`}
                                resourceExcludePackages={Array.from(selectedApps)}
                                on:select={handleAppsSelected}
                                on:close={() => (appPickerOpen = false)}
                            />
                            {/if}
                        </div>
                        <p class="text-sm text-gray-500">Choose one or more apps to pin on devices.</p>
                    </div>

                    <!-- Target Type -->
                    <div class="space-y-2">
                        <Label for="targetType">Target Type</Label>
                        <select
                            id="targetType"
                            bind:value={formData.targetType}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Devices</option>
                            <option value="specific">Specific Devices</option>
                        </select>
                    </div>

                    <!-- Specific Devices -->
                    {#if formData.targetType === 'specific'}
                        <div class="space-y-2">
                            <Label>Specific Devices</Label>
                            {#if selectedDevices.size > 0}
                                <div class="border rounded-md bg-muted/30 p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <h4 class="font-medium text-sm">Selected Devices <span class="text-muted-foreground">({selectedDevices.size})</span></h4>
                                        <Button type="button" variant="ghost" size="sm" on:click={() => { selectedDevices = new Map(); }}>Clear</Button>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        {#each Array.from(selectedDevices.entries()) as [devId, devName]}
                                            <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                                <span>{devName || devId}</span>
                                                <button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => { selectedDevices.delete(devId); selectedDevices = new Map(selectedDevices); }}>✕</button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                            <div class="flex items-center gap-2">
                                <Button type="button" variant="outline" on:click={() => devicePickerOpen = true}>Select Devices</Button>
                            </div>
                            {#if devicePickerOpen}
                                <DeviceSelector
                                    open={true}
                                    bundleId={''}
                                    apiPrefix={apiPrefix}
                                    devicesEndpoint={`${apiPrefix}/devices/select`}
                                    excludeDeviceIds={Array.from(selectedDevices.keys())}
                                    on:select={(e) => {
                                        for (const d of e.detail) {
                                            selectedDevices.set(d.id, d.name);
                                        }
                                        selectedDevices = new Map(selectedDevices);
                                        devicePickerOpen = false;
                                    }}
                                    on:close={() => (devicePickerOpen = false)}
                                />
                            {/if}
                            <p class="text-sm text-gray-500">Select specific devices this rule applies to.</p>
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

                    <!-- Submit -->
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
                            {isSubmitting ? 'Updating...' : 'Update Rule'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
</AdminPageLayout>
