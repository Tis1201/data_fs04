<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button, Card, InputField, TextareaField, Toggle } from '$lib/design-system/components';
    import { ArrowLeft, Plus, X } from 'lucide-svelte';
    import DeviceSelector from '$lib/components/bundles_ui/device_select/DeviceSelector.svelte';
    import { toast } from 'svelte-sonner';
    import { onMount } from 'svelte';

    export let rule: any;
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string;
    export let apiPrefix: string;
    export let context: 'admin' | 'user' = 'user';

    $: rule = rule;

    let formData = {
        name: '',
        description: '',
        targetType: 'all' as 'all' | 'specific',
        isActive: true
    };

    $: if (rule) {
        formData = {
            name: rule.name || '',
            description: rule.description || '',
            targetType: (rule.targetType === 'specific' ? 'specific' : 'all') as 'all' | 'specific',
            isActive: rule.isActive ?? true
        };
    }

    let isSubmitting = false;
    let devicePickerOpen = false;
    let selectedDevices: { id: string; name: string }[] = [];

    onMount(() => {
        if (rule?.targetType === 'specific' && rule?.targetValue?.length) loadSelectedDevices();
    });

    async function loadSelectedDevices() {
        if (!rule?.targetValue?.length) return;
        try {
            const res = await fetch(`${apiPrefix}/devices/select?includeDeviceIds=${rule.targetValue.join(',')}`);
            if (res.ok) {
                const data = await res.json();
                const devices = data?.data?.devices ?? data?.devices ?? [];
                selectedDevices = devices.map((d: any) => ({ id: d.id, name: d.name || d.id }));
            }
        } catch {
            selectedDevices = [];
        }
    }

    function handleDevicesSelected(e: CustomEvent<{ id: string; name: string }[]>) {
        selectedDevices = [...selectedDevices, ...e.detail];
        devicePickerOpen = false;
    }

    function removeDevice(id: string) {
        selectedDevices = selectedDevices.filter((d) => d.id !== id);
    }

    async function saveRule(asDraft: boolean) {
        if (!formData.name?.trim()) {
            toast.error('Name is required');
            return;
        }
        if (formData.targetType === 'specific' && selectedDevices.length === 0) {
            toast.error('Please select at least one device');
            return;
        }
        isSubmitting = true;
        try {
            const res = await fetch(`${apiPrefix}/pin-rules/${rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description?.trim() || null,
                    apps: rule?.apps ?? [],
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'specific' ? selectedDevices.map((d) => d.id) : [],
                    isActive: asDraft ? false : true
                })
            });
            const data = await res.json();
            if (data?.success) {
                toast.success(asDraft ? 'Rule saved as draft successfully.' : 'Rule updated & published successfully.');
                goto(`${basePath}/iot/pin-rules/${rule.id}`);
            } else {
                toast.error(asDraft ? 'Unable to save as draft. Please try again.' : 'Unable to update & publish Rule. Please try again!');
            }
        } catch {
            toast.error(asDraft ? 'Unable to save as draft. Please try again.' : 'Unable to update & publish Rule. Please try again!');
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>Edit Pin Rule{context === 'admin' ? ' - Admin' : ''}</title>
</svelte:head>

<div class="pin-rule-edit-form" style="padding: var(--ds-space-6); max-width: 800px; margin: 0 auto;">
    <Button variant="text" color="gray" size="lg" on:click={() => goto(`${basePath}/iot/pin-rules/${rule?.id}`)}>
        <ArrowLeft size={20} slot="icon-left" />
        Back
    </Button>

    <Card variant="default" padding="lg" class="pin-rule-edit-card" style="margin-top: var(--ds-space-4);">
        <h2 class="pin-rule-edit-title" style="font-size: var(--ds-text-xl); font-weight: 600; margin: 0 0 var(--ds-space-6) 0;">Edit Rule</h2>

        <div class="pin-rule-edit-fields" style="display: flex; flex-direction: column; gap: var(--ds-space-6);">
            <div>
                <label class="pin-rule-edit-label" for="edit-name" style="display: block; font-weight: 500; margin-bottom: var(--ds-space-2);">Name <span style="color: var(--ds-color-error-500);">*</span></label>
                <InputField
                    id="edit-name"
                    type="text"
                    bind:value={formData.name}
                    placeholder="Rule name"
                />
            </div>
            <div>
                <Toggle
                    bind:checked={formData.isActive}
                    label="Active"
                    labelPosition="right"
                />
            </div>
            <div>
                <label class="pin-rule-edit-label" for="edit-desc" style="display: block; font-weight: 500; margin-bottom: var(--ds-space-2);">Description</label>
                <TextareaField
                    id="edit-desc"
                    bind:value={formData.description}
                    placeholder="Description (optional)"
                    rows={3}
                />
            </div>

            <div>
                <label class="pin-rule-edit-label" style="display: block; font-weight: 500; margin-bottom: var(--ds-space-2);">Apply to <span style="color: var(--ds-color-error-500);">*</span></label>
                <select
                    class="pin-rule-apply-select"
                    style="width: 100%; padding: var(--ds-space-2) var(--ds-space-3); border: 1px solid var(--ds-border-default); border-radius: var(--ds-radius-md); font-size: var(--ds-text-sm);"
                    bind:value={formData.targetType}
                >
                    <option value="all">All Devices</option>
                    <option value="specific">Devices</option>
                </select>
                {#if formData.targetType === 'specific'}
                    <p class="pin-rule-edit-label" style="margin: var(--ds-space-4) 0 var(--ds-space-2) 0;">Search and select</p>
                    <Button variant="outline" color="primary" size="md" on:click={() => (devicePickerOpen = true)}>
                        <Plus size={18} slot="icon-left" />
                        Add Device
                    </Button>
                    <p class="pin-rule-selected-label" style="font-weight: 500; margin: var(--ds-space-4) 0 var(--ds-space-2) 0;">Selected ({selectedDevices.length} items)</p>
                    <div class="pin-rule-selected-list" style="display: flex; flex-direction: column; gap: var(--ds-space-2);">
                        {#each selectedDevices as device}
                            <div class="pin-rule-selected-row" style="display: flex; align-items: center; justify-content: space-between; padding: var(--ds-space-2) 0; border-bottom: 1px solid var(--ds-border-default);">
                                <div>
                                    <span style="font-size: var(--ds-text-sm); font-weight: 500;">{device.name || device.id}</span>
                                    <span style="font-size: var(--ds-text-xs); color: var(--ds-color-gray-500); display: block;">{device.id}</span>
                                </div>
                                <Button variant="text" size="sm" icon={X} iconPosition="only" iconSize={16} on:click={() => removeDevice(device.id)} aria-label="Remove" />
                            </div>
                        {/each}
                        {#if selectedDevices.length === 0}
                            <span style="font-size: var(--ds-text-sm); color: var(--ds-color-gray-500);">No devices selected</span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <div class="pin-rule-edit-actions" style="display: flex; justify-content: flex-end; gap: var(--ds-space-3); margin-top: var(--ds-space-8); padding-top: var(--ds-space-4); border-top: 1px solid var(--ds-border-default);">
            <Button variant="outline" color="primary" size="lg" on:click={() => goto(`${basePath}/iot/pin-rules/${rule?.id}`)}>Cancel</Button>
            <Button variant="outline" color="primary" size="lg" disabled={isSubmitting} on:click={() => saveRule(true)}>Save as Draft</Button>
            <Button variant="filled" color="primary" size="lg" disabled={isSubmitting} on:click={() => saveRule(false)}>Save & Publish</Button>
        </div>
    </Card>
</div>

<DeviceSelector
    bind:open={devicePickerOpen}
    bundleId=""
    {apiPrefix}
    devicesEndpoint="/api/v2/devices/select"
    excludeDeviceIds={selectedDevices.map((d) => d.id)}
    on:select={handleDevicesSelected}
    on:close={() => (devicePickerOpen = false)}
/>
