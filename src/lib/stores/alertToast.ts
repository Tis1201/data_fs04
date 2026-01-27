import { writable } from 'svelte/store';

export type AlertToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AlertToastItem {
    id: number;
    severity: AlertToastSeverity;
    message: string;
    title?: string;
}

export interface ToastOptions {
    title?: string;
    duration?: number;
}

const DEFAULT_DURATION_MS = 5000;

let idCounter = 0;
const timeoutIds = new Map<number, ReturnType<typeof setTimeout>>();

function createAlertToastStore() {
    const { subscribe, set, update } = writable<AlertToastItem[]>([]);

    function add(severity: AlertToastSeverity, message: string, options?: ToastOptions): number {
        const id = ++idCounter;
        const duration = options?.duration ?? DEFAULT_DURATION_MS;

        update((list) => [...list, { id, severity, message, title: options?.title }]);

        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                timeoutIds.delete(id);
                update((list) => list.filter((t) => t.id !== id));
            }, duration);
            timeoutIds.set(id, timeoutId);
        }

        return id;
    }

    function remove(id: number): void {
        const tid = timeoutIds.get(id);
        if (tid) {
            clearTimeout(tid);
            timeoutIds.delete(id);
        }
        update((list) => list.filter((t) => t.id !== id));
    }

    return {
        subscribe,
        add,
        remove
    };
}

export const alertToastStore = createAlertToastStore();

/** Toast API compatible with svelte-sonner usage: toast.success(msg), toast.error(msg), etc. */
export const toast = {
    success: (message: string, options?: ToastOptions) =>
        alertToastStore.add('success', message, options),
    error: (message: string, options?: ToastOptions) =>
        alertToastStore.add('error', message, options),
    info: (message: string, options?: ToastOptions) =>
        alertToastStore.add('info', message, options),
    warning: (message: string, options?: ToastOptions) =>
        alertToastStore.add('warning', message, options)
};
