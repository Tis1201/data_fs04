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
    import { useDeviceMqttStatus } from "$lib/composables/useDeviceMqttStatus";
    import { mqttClient } from "$lib/client/mqtt/mqttClient";
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
    function handleModalSearch(page?: number) {
        if (page !== undefined) {
            firmwarePage = page;
        }
        loadFirmwareResources();
    }

    function handleModalSelect(id: string) {
        onSelectFirmware(id);
    }

    function onInstallAppSearch(page?: number) {
        if (page !== undefined) {
            installAppPage = page;
        }
        loadInstallAppResources();
    }

    function onSelectInstallAppFromList(id: string) {
        onSelectInstallApp(id);
    }

    function onPullFileSearch(page?: number) {
        if (page !== undefined) {
            pullFilePage = page;
        }
        loadPullFileResources();
    }

    function onSelectPullFileFromList(id: string) {
        onSelectPullFile(id);
    }

    // MQTT status subscription
    const { subscribe: subscribeMqttStatus } = useDeviceMqttStatus();
    let mqttStatusUnsubscribe: (() => void) | null = null;

    // Track last status to deduplicate notifications (prevent multiple toasts for same status)
    let lastNotificationStatus: { connected: boolean; timestamp: string } | null = null;

    onMount(() => {
        if (!browser) return;

        // Subscribe to device status updates via MQTT
        // Note: MQTT client connection is handled globally by AuthStateHandler
        mqttStatusUnsubscribe = subscribeMqttStatus((update) => {
                if (update.deviceId !== device.id) {
                    return;
                }

                // Check if this is a duplicate notification (same status and timestamp)
                const isDuplicate = lastNotificationStatus && 
                    lastNotificationStatus.connected === update.connected && 
                    lastNotificationStatus.timestamp === update.timestamp;
                
                if (isDuplicate) {
                    return;
                }

                // Update tracking
                lastNotificationStatus = {
                    connected: update.connected,
                    timestamp: update.timestamp || new Date().toISOString()
                };

                const prev = { connected: !!device.connected };
                
                // Update device state reactively
                device = {
                    ...device,
                    connected: update.connected,
                    connectedAt: update.connected ? (update.timestamp ?? device.connectedAt) : device.connectedAt,
                    disconnectedAt: !update.connected ? (update.timestamp ?? device.disconnectedAt) : device.disconnectedAt
                };

                // Only show toast if the status actually changed from the previous device state
                if (prev.connected !== update.connected) {
                    const statusText = update.connected ? 'connected' : 'disconnected';
                    toast.info(`Device ${statusText}`, {
                        description: update.deviceName || device.name,
                        duration: 3000
                    });
                }
            });

        // Setup SSE handlers for other events (action updates, data updates, etc.)
        // Note: Connection status is now handled via MQTT above
        setupSSEHandlers();
    });

    onDestroy(() => {
        cleanupDeviceDetail();
        
        if (mqttStatusUnsubscribe) {
            try { mqttStatusUnsubscribe(); } catch {}
            mqttStatusUnsubscribe = null;
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

