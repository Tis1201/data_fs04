<script lang="ts">
    import { goto } from '$app/navigation';
    import { toast } from 'svelte-sonner';
    import { ArrowLeft, Save, Trash, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import AppSelector from '$lib/components/ui_components_sveltekit/bundles/app_select/AppSelector.svelte';
    import DeviceSelector from '$lib/components/ui_components_sveltekit/bundles/device_select/DeviceSelector.svelte';
    import * as Dialog from '$lib/components/ui/dialog';

    export let data: PageData;

    let formData = {
        name: data.rule.name,
        description: data.rule.description || '',
        apps: data.rule.apps.join(', '),
        targetType: data.rule.targetType || 'all',
        targetValue: data.rule.targetValue.join(', '),
        isActive: data.rule.isActive
    };

    let saving = false;
    let deleting = false;
    let appPickerOpen = false;
    let devicePickerOpen = false;
    let deleteOpen = false;
    let selectedApps = new Set<string>(data.rule.apps);
    let selectedDevices = new Map<string, string>(data.rule.targetValue.map((id: string) => [id, id]));

    function syncAppsToForm() { formData.apps = Array.from(selectedApps).join(', '); }
    function syncDevicesToForm() { formData.targetValue = Array.from(selectedDevices.keys()).join(', '); }

    async function saveRule() {
        saving = true;
        try {
            const response = await fetch(`/api/pin-rules/${data.rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
            if (result.success) { toast.success('Pin rule updated'); goto('/user/iot/pin-rules'); }
            else throw new Error(result.message || 'Failed to update');
        } catch (e) {
            toast.error('Failed to update pin rule', { description: e instanceof Error ? e.message : 'Unknown error' });
        } finally { saving = false; }
    }

    async function deleteRule() {
        deleting = true;
        try {
            const res = await fetch(`/api/pin-rules/${data.rule.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) { toast.success('Pin rule deleted'); goto('/user/iot/pin-rules'); }
            else throw new Error(result.message || 'Failed to delete');
        } catch (e) {
            toast.error('Failed to delete pin rule', { description: e instanceof Error ? e.message : 'Unknown error' });
        } finally { deleting = false; }
    }
</script>

<svelte:head>
    <title>Edit Pin Rule</title>
    <meta name="description" content="Edit pin rule for device apps" />
</svelte:head>

<div class="p-2">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-xl font-semibold">Edit Pin Rule</h1>
            <p class="text-sm text-gray-600">Modify your device pin rule</p>
        </div>
        <div class="flex items-center space-x-2">
            <button class="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50" on:click={() => goto('/user/iot/pin-rules')}>
                <ArrowLeft class="w-4 h-4" /> Back
            </button>
            {#if data.rule.ruleType === 'user_custom'}
                <button class="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50" on:click={() => (deleteOpen = true)} disabled={deleting}>
                    <Trash class="w-4 h-4" /> Delete
                </button>
            {/if}
            <button class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" on:click={saveRule} disabled={saving}>
                <Save class="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
        </div>
    </div>

    <div class="bg-white rounded-lg shadow p-6">
        <form on:submit|preventDefault={saveRule} class="space-y-6">
            <div>
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                <input id="name" type="text" bind:value={formData.name} required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter rule name" />
            </div>

            <div>
                <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="description" bind:value={formData.description} rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter rule description"></textarea>
            </div>

            <!-- Apps (selector) -->
            <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Apps *</label>
                {#if selectedApps.size > 0}
                    <div class="border rounded-md bg-muted/30 p-3">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-medium text-sm">Selected Apps <span class="text-muted-foreground">({selectedApps.size})</span></h4>
                            <button type="button" class="px-2 py-1 text-sm" on:click={() => { selectedApps = new Set(); syncAppsToForm(); }}>Clear</button>
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
                <button type="button" class="flex items-center gap-2 px-3 py-2 border rounded-md" on:click={() => appPickerOpen = true}><Plus class="w-4 h-4" /> Select Apps</button>
                {#if appPickerOpen}
                    <AppSelector open={true} bundleId={''} apiPrefix={'/api/admin'} resourceMode={true} resourcesEndpoint={'/api/resources/apps'} resourceExcludePackages={Array.from(selectedApps)} on:select={(e) => { for (const r of e.detail) selectedApps.add(r.packageName || r.name); selectedApps = new Set(selectedApps); syncAppsToForm(); appPickerOpen = false; }} on:close={() => appPickerOpen = false} />
                {/if}
                <input type="hidden" name="apps" value={formData.apps} />
            </div>

            <!-- Target Type -->
            <div>
                <label for="targetType" class="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
                <select id="targetType" bind:value={formData.targetType} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All Devices</option>
                    <option value="specific">Specific Devices</option>
                </select>
            </div>

            {#if formData.targetType === 'specific'}
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Specific Devices</label>
                    {#if selectedDevices.size > 0}
                        <div class="border rounded-md bg-muted/30 p-3">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="font-medium text-sm">Selected Devices <span class="text-muted-foreground">({selectedDevices.size})</span></h4>
                                <button type="button" class="px-2 py-1 text-sm" on:click={() => { selectedDevices = new Map(); syncDevicesToForm(); }}>Clear</button>
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
                    <button type="button" class="flex items-center gap-2 px-3 py-2 border rounded-md" on:click={() => devicePickerOpen = true}><Plus class="w-4 h-4" /> Select Devices</button>
                    {#if devicePickerOpen}
                        <DeviceSelector open={true} bundleId={''} apiPrefix={'/api/admin'} devicesEndpoint={'/api/admin/devices/select'} excludeDeviceIds={Array.from(selectedDevices.keys())} on:select={(e) => { for (const d of e.detail) selectedDevices.set(d.id, d.name); syncDevicesToForm(); devicePickerOpen = false; }} on:close={() => (devicePickerOpen = false)} />
                    {/if}
                </div>
            {/if}

            <div class="flex items-center">
                <input id="isActive" type="checkbox" bind:checked={formData.isActive} class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <label for="isActive" class="ml-2 block text-sm text-gray-700">Active</label>
            </div>
        </form>
    </div>
</div>

<!-- Delete confirmation modal -->
{#if data.rule.ruleType === 'user_custom'}
<Dialog.Root bind:open={deleteOpen}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Delete Pin Rule</Dialog.Title>
            <Dialog.Description>Are you sure you want to delete this pin rule? This action cannot be undone.</Dialog.Description>
        </Dialog.Header>
        <div class="flex justify-end gap-2 mt-4">
            <button class="px-4 py-2 border rounded" on:click={() => (deleteOpen = false)}>Cancel</button>
            <button class="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50" on:click={() => { deleteOpen = false; deleteRule(); }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
            </button>
        </div>
    </Dialog.Content>
</Dialog.Root>
{/if}
