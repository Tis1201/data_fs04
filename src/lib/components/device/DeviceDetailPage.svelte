<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { writable } from "svelte/store";
    import { Settings, Edit } from "lucide-svelte";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import DeviceActions from "$lib/components/ui_components_sveltekit/devices/DeviceActions.svelte";
    import FirmwareModal from "$lib/components/ui_components_sveltekit/devices/FirmwareModal.svelte";
    import InstallAppModal from "$lib/components/ui_components_sveltekit/devices/InstallAppModal.svelte";
    import PullFileModal from "$lib/components/ui_components_sveltekit/devices/PullFileModal.svelte";
    import PushFileModal from "$lib/components/ui_components_sveltekit/devices/PushFileModal.svelte";
    import StatusBanner from "$lib/components/ui_components_sveltekit/devices/StatusBanner.svelte";
    import ScreenshotModal from "$lib/components/ui_components_sveltekit/devices/ScreenshotModal.svelte";
    import DeviceDetailTabs from "$lib/components/device/DeviceDetailTabs.svelte";
    import { sseStore } from "$lib/stores/sse-store";
    import { onMount, onDestroy } from 'svelte';
    import { useDeviceDetail } from "$lib/composables/useDeviceDetail";
    import { browser } from "$app/environment";

    interface Props {
        // Data from server
        device: any;
        licenses: any[];
        deviceActionLogs: any[];
        deviceInformation: any;
        deviceProfile: any;
        deviceProfileForm: any;
        form: any; // API key form
        
        // Configuration
        title: string;
        pageCrumbs: [string, string][];
        basePath: '/admin' | '/user';
        resourceApiPath: '/api/admin/resources' | '/api/user/resources';
    }

    export let device: Props['device'];
    export let licenses: Props['licenses'];
    export let deviceActionLogs: Props['deviceActionLogs'];
    export let deviceInformation: Props['deviceInformation'];
    export let deviceProfile: Props['deviceProfile'];
    export let deviceProfileForm: Props['deviceProfileForm'];
    export let form: Props['form'];
    export let title: Props['title'];
    export let pageCrumbs: Props['pageCrumbs'];
    export let basePath: Props['basePath'];
    export let resourceApiPath: Props['resourceApiPath'];

    const MAX_ACTION_LOGS = 15;
    let actionLogs: any[] = Array.isArray(deviceActionLogs) ? [...deviceActionLogs].slice(0, MAX_ACTION_LOGS) : [];
    
    // Track temporary optimistic log rows
    let pendingFirmwareTempId: string | null = null;
    let pendingInstallAppTempId: string | null = null;

    // State management
    const isLoading = writable(false);
    const actionStatus = writable({ action: "", status: "", message: "" });
    let screenshotOpen = false;
    let screenshotData: string | null = null;
    let screenshotFormat: string = 'jpeg';

    // Modal states
    let showInstallAppModal = false;
    let installAppItems: any[] = [];
    let selectedInstallAppId: string | null = null;
    let selectedInstallApp: any = null;
    let loadingInstallApp = false;
    let installAppPage = 1;
    let installAppTotalPages = 1;
    let installAppSearch = '';

    let showPullFileModal = false;
    let pullFileItems: any[] = [];
    let selectedPullFileId: string | null = null;
    let selectedPullFile: any = null;
    let loadingPullFile = false;
    let pullFilePage = 1;
    let pullFileTotalPages = 1;
    let pullFileSearch = '';
    let pullFileDestinationPath = '';

    let showPushFileModal = false;
    let pushFileSourcePath = '';
    let pushFileProgress = 0;
    let pushFileStatusMessage = '';

    let showFirmwareModal = false;
    let firmwareItems: any[] = [];
    let selectedFirmwareId: string | null = null;
    let selectedFirmware: any = null;
    let loadingFirmware = false;
    let firmwarePage = 1;
    let firmwareTotalPages = 1;
    let firmwareSearch = '';

    // Setup the form for API key generation
    const {
        form: apiKeyForm,
        enhance: apiKeyEnhance,
        submitting: apiKeySubmitting,
    } = superForm(form, {
        id: "api-key-form",
        resetForm: false,
        taintedMessage: null,
        onSubmit: ({ action }: { action: URL } | any) => {
            const actionStr = typeof action === 'string' ? action : (action as URL)?.toString();
            if (actionStr !== "?/generateApiKey") {
                return;
            }
        },
        onResult: ({ result }) => {
            if (result.type === "success") {
                const data = result.data as any;
                const message = data?.message || "API key generated successfully";
                toast.success(message);
                goto(`${basePath}/iot/devices/${device.id}`, {
                    invalidateAll: true,
                });
            } else if (result.type === "failure") {
                const error = result.data?.error || "Failed to generate API key";
                toast.error(error);
            }
        },
        onError: () => {
            toast.error("An error occurred while generating API key");
        },
    });

    // Initialize composable with state wrappers
    const deviceDetail = useDeviceDetail({
        deviceId: device.id,
        basePath,
        resourceApiPath,
        device: { get: () => device, set: (v) => { device = v; } },
        deviceInformation: { get: () => deviceInformation, set: (v) => { deviceInformation = v; } },
        actionLogs: { get: () => actionLogs, set: (v) => { actionLogs = v; } },
        isLoading,
        actionStatus,
        screenshotOpen: { get: () => screenshotOpen, set: (v) => { screenshotOpen = v; } },
        screenshotData: { get: () => screenshotData, set: (v) => { screenshotData = v; } },
        screenshotFormat: { get: () => screenshotFormat, set: (v) => { screenshotFormat = v; } },
        showInstallAppModal: { get: () => showInstallAppModal, set: (v) => { showInstallAppModal = v; } },
        installAppItems: { get: () => installAppItems, set: (v) => { installAppItems = v; } },
        selectedInstallAppId: { get: () => selectedInstallAppId, set: (v) => { selectedInstallAppId = v; } },
        selectedInstallApp: { get: () => selectedInstallApp, set: (v) => { selectedInstallApp = v; } },
        loadingInstallApp: { get: () => loadingInstallApp, set: (v) => { loadingInstallApp = v; } },
        installAppPage: { get: () => installAppPage, set: (v) => { installAppPage = v; } },
        installAppTotalPages: { get: () => installAppTotalPages, set: (v) => { installAppTotalPages = v; } },
        installAppSearch: { get: () => installAppSearch, set: (v) => { installAppSearch = v; } },
        showPullFileModal: { get: () => showPullFileModal, set: (v) => { showPullFileModal = v; } },
        pullFileItems: { get: () => pullFileItems, set: (v) => { pullFileItems = v; } },
        selectedPullFileId: { get: () => selectedPullFileId, set: (v) => { selectedPullFileId = v; } },
        selectedPullFile: { get: () => selectedPullFile, set: (v) => { selectedPullFile = v; } },
        loadingPullFile: { get: () => loadingPullFile, set: (v) => { loadingPullFile = v; } },
        pullFilePage: { get: () => pullFilePage, set: (v) => { pullFilePage = v; } },
        pullFileTotalPages: { get: () => pullFileTotalPages, set: (v) => { pullFileTotalPages = v; } },
        pullFileSearch: { get: () => pullFileSearch, set: (v) => { pullFileSearch = v; } },
        pullFileDestinationPath: { get: () => pullFileDestinationPath, set: (v) => { pullFileDestinationPath = v; } },
        showPushFileModal: { get: () => showPushFileModal, set: (v) => { showPushFileModal = v; } },
        pushFileSourcePath: { get: () => pushFileSourcePath, set: (v) => { pushFileSourcePath = v; } },
        pushFileProgress: { get: () => pushFileProgress, set: (v) => { pushFileProgress = v; } },
        pushFileStatusMessage: { get: () => pushFileStatusMessage, set: (v) => { pushFileStatusMessage = v; } },
        showFirmwareModal: { get: () => showFirmwareModal, set: (v) => { showFirmwareModal = v; } },
        firmwareItems: { get: () => firmwareItems, set: (v) => { firmwareItems = v; } },
        selectedFirmwareId: { get: () => selectedFirmwareId, set: (v) => { selectedFirmwareId = v; } },
        selectedFirmware: { get: () => selectedFirmware, set: (v) => { selectedFirmware = v; } },
        loadingFirmware: { get: () => loadingFirmware, set: (v) => { loadingFirmware = v; } },
        firmwarePage: { get: () => firmwarePage, set: (v) => { firmwarePage = v; } },
        firmwareTotalPages: { get: () => firmwareTotalPages, set: (v) => { firmwareTotalPages = v; } },
        firmwareSearch: { get: () => firmwareSearch, set: (v) => { firmwareSearch = v; } },
        pendingFirmwareTempId: { get: () => pendingFirmwareTempId, set: (v) => { pendingFirmwareTempId = v; } },
        pendingInstallAppTempId: { get: () => pendingInstallAppTempId, set: (v) => { pendingInstallAppTempId = v; } }
    });

    // Use composable functions
    const {
        loadFirmwareResources,
        loadInstallAppResources,
        loadPullFileResources,
        openFirmwareModal,
        onSelectFirmware,
        confirmFirmwareUpdate,
        openInstallAppModal,
        onSelectInstallApp,
        confirmInstallApp,
        openPullFileModal,
        onSelectPullFile,
        confirmPullFile,
        openPushFileModal,
        confirmPushFile,
        accessRemoteTerminal,
        retrieveSnapshot,
        restartDevice,
        rebootDevice,
        viewLogs,
        navigateToEdit,
        addActionLogRow,
        updateTempActionLog,
        downloadPushFile,
        setupSSEHandlers,
        cleanup: cleanupDeviceDetail
    } = deviceDetail;

    // Wrapper functions for modal components
    function handleModalSearch(search: string) {
        firmwareSearch = search;
        loadFirmwareResources();
    }

    function handleModalSelect(id: string) {
        onSelectFirmware(id);
    }

    function onInstallAppSearch(search: string) {
        installAppSearch = search;
        loadInstallAppResources();
    }

    function onSelectInstallAppFromList(id: string) {
        onSelectInstallApp(id);
    }

    function onPullFileSearch(search: string) {
        pullFileSearch = search;
        loadPullFileResources();
    }

    function onSelectPullFileFromList(id: string) {
        onSelectPullFile(id);
    }

    // SSE subscription management
    let unsubConnectionLight: (() => void) | null = null;
    let lastSubscribedConnectionId: string | null = null;

    // Function to subscribe to device channel
    async function subscribeToDeviceChannel(connId: string) {
        if (connId === lastSubscribedConnectionId) {
            return;
        }
        
        try {
            const response = await fetch(`/api/sse/subscribe/device/${device.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connectionId: connId })
            });
            
            if (response.ok) {
                lastSubscribedConnectionId = connId;
            }
        } catch (err) {
            console.warn('[DeviceDetailPage] Subscribe failed:', err);
        }
    }

    onMount(() => {
        if (!browser) return;

        // Check if SSE is already connected and subscribe immediately
        if (sseStore.connectionId && sseStore.isConnected) {
            subscribeToDeviceChannel(sseStore.connectionId);
        }
        
        // Listen for future connection events
        sseStore.on('connected', (msg: any) => {
            const connId = msg?.data?.connectionId;
            if (connId) {
                subscribeToDeviceChannel(connId);
            }
        });

        // Setup SSE handlers using composable
        setupSSEHandlers();

        // Lightweight connection status updates
        unsubConnectionLight = sseStore.on('*', (msg: any) => {
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // Handle data updates
                if (evtType === 'device:dataUpdate') {
                    const updatedData = evt.payload?.updatedData;
                    if (updatedData && updatedData.deviceInfo) {
                        deviceInformation = updatedData.deviceInfo;
                    }
                }
                
                // Normalize payloads
                let normalized;
                if (evt?.payload?.action === 'device:connection' || evt?.payload?.action === 'device:disconnection') {
                    normalized = { ...evt.payload, type: evt.payload.action };
                } else if (evt?.type === 'device:connection' || evt?.type === 'device:disconnection') {
                    normalized = {
                        type: evt.type,
                        deviceId: evt.payload?.deviceId,
                        connected: evt.payload?.connected,
                        connectedAt: evt.payload?.connectedAt,
                        disconnectedAt: evt.payload?.disconnectedAt,
                        timestamp: evt.payload?.timestamp,
                        reason: evt.payload?.reason
                    };
                } else {
                    normalized = evt;
                }

                const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
                const isDisconnectionEvent = (evtType === 'device:disconnection') || (normalized?.type === 'device:disconnection');
                
                if (!isConnectionEvent && !isDisconnectionEvent) {
                    return;
                }

                const c = normalized;
                const cDeviceId = c?.deviceId;
                
                if (!cDeviceId || cDeviceId !== device.id) {
                    return;
                }

                const connected = c?.connected ?? false;
                const connectedAt = c?.connectedAt;
                const disconnectedAt = c?.disconnectedAt;
                
                // Reassign the whole object to trigger reactive updates
                device = {
                    ...device,
                    connected: !!connected,
                    connectedAt: connected ? (connectedAt ?? device.connectedAt) : device.connectedAt,
                    disconnectedAt: !connected ? (disconnectedAt ?? device.disconnectedAt) : device.disconnectedAt
                };
            } catch (e) {
                console.warn('[DeviceDetailPage:SSE] Error processing message', e);
            }
        });
    });

    onDestroy(() => {
        cleanupDeviceDetail();
        
        if (unsubConnectionLight) {
            try { unsubConnectionLight(); } catch {}
            unsubConnectionLight = null;
        }
        
        // Unsubscribe from device channel
        if (browser && sseStore.connectionId) {
            fetch(`/api/sse/unsubscribe/device/${device.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connectionId: sseStore.connectionId })
            }).catch(err => console.warn('Unsubscribe failed:', err));
        }
    });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionLabel="Edit"
    actionIcon={Edit}
    actionOnClick={navigateToEdit}
    compact={true}
    contentSpacing="space-y-4"
>
    <!-- Device Action Buttons -->
    <AdminCard
        title="Device Actions"
        description="Manage and interact with this device"
        icon={Settings}
        class_name="mb-4"
        compact={true}
    >
        <DeviceActions
            {device}
            {isLoading}
            {actionStatus}
            onSnapshot={retrieveSnapshot}
            onRestart={restartDevice}
            onReboot={rebootDevice}
            onOpenInstallAppModal={openInstallAppModal}
            onOpenPullFileModal={openPullFileModal}
            onOpenPushFileModal={openPushFileModal}
            onOpenFirmwareModal={openFirmwareModal}
            onViewLogs={viewLogs}
            onTerminal={accessRemoteTerminal}
            onRemoteDesktop={() => { 
                addActionLogRow('remote_desktop', 'Opening remote desktop', 'initiated'); 
                goto(`${basePath}/iot/devices/${device.id}/rdp`); 
            }}
        />

        <!-- Status message for actions -->
        <StatusBanner status={$actionStatus} />
    </AdminCard>

    <InstallAppModal
        show={showInstallAppModal}
        items={installAppItems}
        loading={loadingInstallApp}
        page={installAppPage}
        totalPages={installAppTotalPages}
        search={installAppSearch}
        selectedId={selectedInstallAppId}
        searchFn={onInstallAppSearch}
        selectFn={onSelectInstallAppFromList}
        onClose={() => (showInstallAppModal = false)}
        onConfirm={confirmInstallApp}
    />

    <PullFileModal
        show={showPullFileModal}
        items={pullFileItems}
        loading={loadingPullFile}
        page={pullFilePage}
        totalPages={pullFileTotalPages}
        search={pullFileSearch}
        selectedId={selectedPullFileId}
        bind:destinationPath={pullFileDestinationPath}
        searchFn={onPullFileSearch}
        selectFn={onSelectPullFileFromList}
        onClose={() => (showPullFileModal = false)}
        onConfirm={confirmPullFile}
    />

    <PushFileModal
        show={showPushFileModal}
        bind:sourcePath={pushFileSourcePath}
        loading={$isLoading && $actionStatus.action === 'pushFile'}
        progress={pushFileProgress}
        statusMessage={pushFileStatusMessage}
        onClose={() => (showPushFileModal = false)}
        onConfirm={confirmPushFile}
    />

    <FirmwareModal
        show={showFirmwareModal}
        items={firmwareItems}
        loading={loadingFirmware}
        page={firmwarePage}
        totalPages={firmwareTotalPages}
        search={firmwareSearch}
        selectedId={selectedFirmwareId}
        searchFn={handleModalSearch}
        selectFn={handleModalSelect}
        onClose={() => (showFirmwareModal = false)}
        onConfirm={confirmFirmwareUpdate}
    />

    <ScreenshotModal 
        open={screenshotOpen} 
        imageData={screenshotData} 
        format={screenshotFormat} 
        onClose={() => { 
            screenshotOpen = false; 
            screenshotData = null; 
        }} 
    />

    <!-- Tabbed Device Detail Interface -->
    {#if device?.id}
        <DeviceDetailTabs 
            {device} 
            {actionLogs} 
            {licenses} 
            {apiKeyEnhance} 
            {apiKeySubmitting}
            {isLoading}
            {actionStatus}
            {deviceInformation}
            {deviceProfile}
            {deviceProfileForm}
            {sseStore}
        />
    {:else}
        <div class="text-center py-8">
            <p class="text-gray-500">Loading device information...</p>
        </div>
    {/if}
</AdminPageLayout>

<!-- Terminal Dialog has been replaced with a dedicated terminal page -->

