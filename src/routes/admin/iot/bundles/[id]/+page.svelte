<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { writable } from 'svelte/store';
    import type { PageData } from "./$types";
    import BundleDetailPage from "$lib/components/bundles/BundleDetailPage.svelte";
    import { getBundleDetailBreadcrumbs } from "$lib/utils/navigation";
    import { initializeDeviceRealtime, deviceRealtimeStore } from "$lib/stores/deviceRealtimeStore";

    export let data: PageData;

    // Make bundle reactive to server invalidations
    let bundle = data.bundle;
    $: bundle = data.bundle;

    // Generate breadcrumbs using navigation utility
    $: breadcrumbs = getBundleDetailBreadcrumbs('admin', bundle?.name);

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
        const out = data.bundleDevices.map((bd: any) => {
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
        if (typeof window !== 'undefined') {
            console.log('[AdminBundle] Device realtime updated: version=', $deviceRealtimeVersion, 'devices=', out.map((d: any) => ({ id: d.device?.id, name: d.device?.name, connected: d.device?.connected })));
        }
        return out;
    })();
</script>

<BundleDetailPage
    bundle={bundle}
    bundleDevices={bundleDevicesWithRealtime}
    resources={data.resources}
    title={data.meta?.title || `Bundle: ${bundle?.name || bundle?.id || 'Unknown'}`}
    pageCrumbs={breadcrumbs}
    context="admin"
    basePath="/admin/iot/bundles"
    enableDeviceTracking={true}
    enableStopAllWaves={true}
/>
