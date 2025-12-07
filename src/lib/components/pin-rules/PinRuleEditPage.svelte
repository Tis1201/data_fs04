<script lang="ts">
    import { ArrowLeft, Trash } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import AppSelector from "$lib/components/ui_components_sveltekit/bundles/app_select/AppSelector.svelte";
    import DeviceSelector from "$lib/components/ui_components_sveltekit/bundles/device_select/DeviceSelector.svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Plus } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    /**
     * Props for PinRuleEditPage component
     */
    export let rule: any;
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string; // "/admin" or "/user"
    export let apiPrefix: string; // "/api/admin" or "/api/user"
    export let context: 'admin' | 'user' = 'admin';
    export let showDelete: boolean = false; // Show delete button (for user_custom rules)

    // Make rule reactive to server invalidations
    $: rule = rule;

    let formData = {
        name: rule?.name || '',
        description: rule?.description || '',
        apps: (rule?.apps || []).join(', '),
        targetType: rule?.targetType || 'all',
        targetValue: (rule?.targetValue || []).join(', '),
        isActive: rule?.isActive ?? true
    };

    let isSubmitting = false;
    let deleting = false;
    let availableApps: string[] = [];
    let appPickerOpen = false;
    let devicePickerOpen = false;
    let deleteOpen = false;
    let selectedApps = new Set<string>(rule?.apps || []);
    let selectedDevices = new Map<string, string>(); // id -> name

    onMount(async () => {
        if (!browser) return;
        
        // Initialize selected apps from existing rule
        if (rule?.apps) {
            selectedApps = new Set<string>(rule.apps);
        }

        // Initialize selected devices from existing rule
        if (rule?.targetType === 'specific' && rule?.targetValue) {
            const ids = rule.targetValue;
            if (ids.length > 0) {
                try {
                    const params = new URLSearchParams();
                    params.append('includeDeviceIds', ids.join(','));
                    const res = await fetch(`${apiPrefix}/devices/select?${params.toString()}`);
                    const data = await res.json();
                    const map = new Map<string, string>();
                    for (const d of data.devices || []) {
                        map.set(d.id, d.name);
                    }
                    // Fill missing names with ids
                    for (const id of ids) { 
                        if (!map.has(id)) map.set(id, id); 
                    }
                    selectedDevices = map;
                } catch (e) {
                    selectedDevices = new Map(ids.map((id: string) => [id, id]));
                }
            }
        }
    });

    function syncAppsToForm() {
        formData.apps = Array.from(selectedApps).join(', ');
    }

    function handleAppsSelected(e: CustomEvent<{ id: string; name: string; packageName?: string | null; autoOpen: boolean }[]>) {
        const pkgs = e.detail.map(x => x.packageName || x.name).filter(Boolean) as string[];
        selectedApps = new Set([...Array.from(selectedApps), ...pkgs]);
        syncAppsToForm();
        appPickerOpen = false;
    }

    function syncDevicesToForm() {
        formData.targetValue = Array.from(selectedDevices.keys()).join(', ');
    }

    async function handleSubmit() {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        if (!formData.apps.trim()) {
            toast.error('At least one app is required');
            return;
        }

        isSubmitting = true;

        try {
            const response = await fetch(`/api/pin-rules/${rule.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    apps: Array.from(selectedApps),
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'all' ? [] : Array.from(selectedDevices.keys()),
                    isActive: formData.isActive
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.success('Pin rule updated successfully');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                toast.error('Failed to update pin rule', {
                    description: result.message || 'Unknown error'
                });
            }
        } catch (error) {
            toast.error('Failed to update pin rule', {
                description: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDelete() {
        deleting = true;
        try {
            const res = await fetch(`/api/pin-rules/${rule.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                toast.success('Pin rule deleted');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                throw new Error(result.message || 'Failed to delete');
            }
        } catch (e) {
            toast.error('Failed to delete pin rule', {
                description: e instanceof Error ? e.message : 'Unknown error'
            });
        } finally {
            deleting = false;
        }
    }
</script>

<svelte:head>
    <title>Edit Pin Rule{context === 'admin' ? ' - Admin Panel' : ''}</title>
    <meta name="description" content="Edit pin rule for device apps" />
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
                <CardTitle>Edit Pin Rule</CardTitle>
                <CardDescription>
                    Update the pin rule settings
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

                    <!-- Apps (multi-select picker with search) -->
                    <div class="space-y-2">
                        <Label>Apps *</Label>
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
                            {#if appPickerOpen}
                                <AppSelector 
                                    open={true}
                                    bundleId={''}
                                    {apiPrefix}
                                    resourceMode={true}
                                    resourcesEndpoint={'/api/resources/apps'}
                                    resourceRuleId={rule?.id}
                                    resourceExcludePackages={Array.from(selectedApps)}
                                    on:select={handleAppsSelected}
                                    on:close={() => (appPickerOpen = false)}
                                />
                            {/if}
                        </div>
                        <input type="hidden" name="apps" value={formData.apps} />
                        <p class="text-sm text-gray-500">Choose one or more apps. You can also start typing to filter.</p>
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

                    <!-- Target Value (if specific) -->
                    {#if formData.targetType === 'specific'}
                        <div class="space-y-2">
                            <Label>Specific Devices</Label>
                            {#if selectedDevices.size > 0}
                                <div class="border rounded-md bg-muted/30 p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <h4 class="font-medium text-sm">Selected Devices <span class="text-muted-foreground">({selectedDevices.size})</span></h4>
                                        <Button type="button" variant="ghost" size="sm" on:click={() => { selectedDevices = new Map(); syncDevicesToForm(); }}>Clear</Button>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        {#each Array.from(selectedDevices.entries()) as [devId, devName]}
                                            <div class="flex items-center gap-2 bg-background border rounded-md px-3 py-1 text-sm">
                                                <span>{devName || devId}</span>
                                                <button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => { selectedDevices.delete(devId); selectedDevices = new Map(selectedDevices); syncDevicesToForm(); }}>✕</button>
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
                                    {apiPrefix}
                                    devicesEndpoint={`${apiPrefix}/devices/select`}
                                    excludeDeviceIds={Array.from(selectedDevices.keys())}
                                    on:select={(e) => {
                                        for (const d of e.detail) {
                                            selectedDevices.set(d.id, d.name);
                                        }
                                        syncDevicesToForm();
                                        devicePickerOpen = false;
                                    }}
                                    on:close={() => (devicePickerOpen = false)}
                                />
                            {/if}
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
                        {#if showDelete && context === 'user'}
                            <Button
                                type="button"
                                variant="destructive"
                                on:click={() => deleteOpen = true}
                                disabled={deleting}
                            >
                                <Trash class="w-4 h-4 mr-2" />
                                {deleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        {/if}
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

<!-- Delete confirmation modal -->
{#if showDelete && context === 'user'}
    <Dialog.Root bind:open={deleteOpen}>
        <Dialog.Content>
            <Dialog.Header>
                <Dialog.Title>Delete Pin Rule</Dialog.Title>
                <Dialog.Description>Are you sure you want to delete this pin rule? This action cannot be undone.</Dialog.Description>
            </Dialog.Header>
            <div class="flex justify-end gap-2 mt-4">
                <Button variant="outline" on:click={() => (deleteOpen = false)}>Cancel</Button>
                <Button variant="destructive" on:click={() => { deleteOpen = false; handleDelete(); }} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
                </Button>
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}

