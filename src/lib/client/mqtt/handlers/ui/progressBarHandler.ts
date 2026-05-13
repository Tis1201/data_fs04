import type { Writable } from 'svelte/store';

// Support both Writable stores and objects with get/set methods
type StoreLike<T> = Writable<T> | { get: () => T; set: (value: T) => void };

export interface ProgressBarHandlerOptions {
    deviceId: string;
    pushFileProgress: StoreLike<number>;
    pushFileStatusMessage: StoreLike<string>;
}

/**
 * Creates a handler for updating progress bars during device actions.
 * This is a UI-specific handler that updates progress bars for push file operations.
 * 
 * @param options - Progress bar handler configuration
 * @returns Handler function for device:progressUpdate notifications
 */
export function createProgressBarHandler(options: ProgressBarHandlerOptions) {
    const { deviceId, pushFileProgress, pushFileStatusMessage } = options;

    return (payload: any) => {
        if (payload.deviceId !== deviceId) return;

        const action = payload.action;
        const progress = payload.progress;
        const message = payload.message;

        // Update push file progress
        if (action === 'pushFile' || action === 'push_file' || action === 'file_operation') {
            if (progress !== undefined) {
                pushFileProgress.set(progress);
                // Get current message if store has get() method, otherwise use message from payload
                const currentMessage = 'get' in pushFileStatusMessage && typeof pushFileStatusMessage.get === 'function' 
                    ? pushFileStatusMessage.get() 
                    : '';
                pushFileStatusMessage.set(message || currentMessage);
            }
        }
    };
}

