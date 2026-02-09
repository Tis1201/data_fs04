<script lang="ts">
    import { onMount } from 'svelte';
    import { invalidate, goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { writable } from 'svelte/store';
    import type { PageData } from "./$types";
    import BundleDetailPageUser from "$lib/components/bundles/BundleDetailPageUser.svelte";
    import EditDeploymentModal from "../components/EditDeploymentModal.svelte";
    import { Modal } from '$lib/design-system/components';
    import { getBundleDetailBreadcrumbs } from "$lib/utils/navigation";
    import { toast } from '$lib/stores/alertToast';
    import { initializeDeviceRealtime, deviceRealtimeStore } from "$lib/stores/deviceRealtimeStore";

    export let data: PageData;

    const basePath = '/user/iot/bundles';

    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    // Force UI to react when realtime store updates: derived store may not trigger reactivity reliably, so we subscribe and bump a version
    const deviceRealtimeVersion = writable(0);

    onMount(() => {
        if (browser) {
            initializeDeviceRealtime();
            const unsub = deviceRealtimeStore.subscribe((store) => {
                const _ = store.getAllDevices?.() ?? [];
                deviceRealtimeVersion.update((v) => v + 1);
            });
            return () => unsub();
        }
    });

    // Update bundleDevices with real-time connection status (same logic as devices list: use store when known, else server value)
    $: _realtimeVersion = $deviceRealtimeVersion;
    $: bundleDevicesWithRealtime = (() => {
        const store = $deviceRealtimeStore;
        if (!store || !data.bundleDevices) return data.bundleDevices || [];
        return data.bundleDevices.map((bd: any) => {
            const deviceId = bd.device?.id;
            if (!deviceId) return bd;
            const known = store.getDevice(deviceId);
            const connected = known !== null ? store.isDeviceConnected(deviceId) : (bd.device?.connected ?? false);
            return {
                ...bd,
                device: {
                    ...bd.device,
                    connected
                }
            };
        });
    })();

    let showEditModal = false;
    let showDuplicateModal = false;
    let duplicateLoading = false;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getBundleDetailBreadcrumbs('user', bundle?.name);

    async function handleEditSaved() {
        showEditModal = false;
        await invalidate('app:bundle');
    }

    function closeDuplicateModal() {
        showDuplicateModal = false;
    }

    async function confirmDuplicate() {
        if (!bundle?.id) return;
        duplicateLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${bundle.id}/duplicate`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            const newId = json.data?.id || json.id;
            if (json.success && newId) {
                toast.success('Deployment duplicated successfully!');
                closeDuplicateModal();
                await invalidate('app:bundles');
                goto(`${basePath}/${newId}`);
            } else {
                toast.error(json.error?.message || 'Unable to duplicate deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to duplicate deployment. Please try again!');
        } finally {
            duplicateLoading = false;
        }
    }
</script>

<BundleDetailPageUser
    bundle={bundle}
    bundleDevices={bundleDevicesWithRealtime}
    resources={data.resources}
    title={data.meta?.title || `Bundle: ${bundle?.name || bundle?.id || 'Unknown'}`}
    pageCrumbs={breadcrumbs}
    context="user"
    basePath={basePath}
    enableDeviceTracking={false}
    enableStopAllWaves={false}
    onEditRequested={() => (showEditModal = true)}
    onDuplicateRequested={() => (showDuplicateModal = true)}
/>

<EditDeploymentModal
    open={showEditModal}
    bundle={bundle}
    on:close={() => (showEditModal = false)}
    on:saved={handleEditSaved}
/>

<Modal
    open={showDuplicateModal}
    title="Duplicate Deployment"
    type="info"
    size="md"
    cancelText="Cancel"
    confirmText="Duplicate"
    confirmLoading={duplicateLoading}
    confirmDisabled={duplicateLoading}
    on:close={closeDuplicateModal}
    on:confirm={confirmDuplicate}
>
    <p class="modal-action-text">
        Do you want to proceed with the duplicate? The new deployment will use the same title and settings.
    </p>
</Modal>
