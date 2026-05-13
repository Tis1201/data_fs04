/**
 * Pending Reply Waiter
 *
 * Allows RPC handlers (e.g. sensor.config.push) to wait for device replies
 * before returning success to the web client. Prevents "success before device reply" UX bug.
 */

import { logger } from '$lib/server/logger';

export type ReplyWaiterResult = { success: boolean; message?: string };

type WaiterEntry = {
    resolve: (value: ReplyWaiterResult) => void;
    reject: (err: Error) => void;
    timeoutHandle: ReturnType<typeof setTimeout>;
};

const waiters = new Map<string, WaiterEntry>();
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Register a waiter for a given logId. Resolves when device replies or times out.
 */
export function registerReplyWaiter(
    logId: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ReplyWaiterResult> {
    return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
            if (waiters.delete(logId)) {
                logger.warn('[PendingReplyWaiter] Timeout waiting for device reply', { logId, timeoutMs });
                reject(new Error(`Device did not reply within ${timeoutMs}ms`));
            }
        }, timeoutMs);

        waiters.set(logId, { resolve, reject, timeoutHandle });
    });
}

/**
 * Resolve a pending waiter when device reply is received.
 */
export function resolveReplyWaiter(logId: string, success: boolean, message?: string): void {
    const entry = waiters.get(logId);
    if (!entry) return;

    clearTimeout(entry.timeoutHandle);
    waiters.delete(logId);
    entry.resolve({ success, message });
    logger.debug('[PendingReplyWaiter] Resolved waiter', { logId, success });
}

/**
 * Reject a pending waiter (e.g. on processing error).
 */
export function rejectReplyWaiter(logId: string, err: Error): void {
    const entry = waiters.get(logId);
    if (!entry) return;

    clearTimeout(entry.timeoutHandle);
    waiters.delete(logId);
    entry.reject(err);
}
