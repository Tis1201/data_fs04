import type { Writable } from 'svelte/store';

// Support both Writable stores and objects with get/set methods
type StoreLike<T> = Writable<T> | { get: () => T; set: (value: T) => void };

export interface ModalHandlerOptions {
    deviceId: string;
    showPullFileModal: StoreLike<boolean>;
    showPushFileModal: StoreLike<boolean>;
    showInstallAppModal: StoreLike<boolean>;
    isLoading: StoreLike<boolean>;
}

/**
 * Creates a handler for closing modals when device actions complete.
 * This is a UI-specific handler that closes modals and updates loading states.
 * 
 * @param options - Modal handler configuration
 * @returns Handler function for device:statusUpdate notifications
 */
export function createModalHandler(options: ModalHandlerOptions) {
    const { deviceId, showPullFileModal, showPushFileModal, showInstallAppModal, isLoading } = options;

    return (payload: any) => {
        if (payload.deviceId !== deviceId) return;

        const action = payload.action;
        const status = payload.status;

        // Close modals on success/failure
        // Action logs are updated by ActionHandlerManager (via actionLogHandler.ts)
        if (status === 'success' || status === 'failed' || status === 'complete' || status === 'error') {
            if (action === 'pullFile' || action === 'pull_file') {
                showPullFileModal.set(false);
                isLoading.set(false);
            } else if (action === 'pushFile' || action === 'push_file' || action === 'file_operation') {
                showPushFileModal.set(false);
                isLoading.set(false);
            } else if (action === 'install' || action === 'installApp') {
                showInstallAppModal.set(false);
                isLoading.set(false);
            } else if (action === 'logs' || action === 'getLogs') {
                isLoading.set(false);
            }
        }
    };
}

