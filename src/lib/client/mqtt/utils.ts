/**
 * Pure MQTT helpers for the store: topic matching, payload parsing, subscribe-error detection.
 */

import type { MqttClient } from 'mqtt';

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

export function matchesTopic(filter: string, topic: string): boolean {
    if (!filter) return false;
    if (filter === '*' || filter === topic) {
        return true;
    }

    const filterLevels = filter.split('/');
    const topicLevels = topic.split('/');

    for (let i = 0; i < filterLevels.length; i++) {
        const filterLevel = filterLevels[i];
        const topicLevel = topicLevels[i];

        if (filterLevel === '#') {
            return true;
        }

        if (filterLevel === '+') {
            if (topicLevel === undefined) {
                return false;
            }
            continue;
        }

        if (filterLevel !== topicLevel) {
            return false;
        }
    }

    return filterLevels.length === topicLevels.length;
}

export function parsePayload(payload: Uint8Array): { raw: string; parsed: unknown } {
    if (!payload || payload.length === 0) {
        return { raw: '', parsed: null };
    }

    const decoder = textDecoder ?? new TextDecoder();
    const raw = decoder.decode(payload);

    if (!raw) {
        return { raw: '', parsed: null };
    }

    try {
        return { raw, parsed: JSON.parse(raw) };
    } catch {
        return { raw, parsed: raw };
    }
}

export function isSubscribeNotAuthorized(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /not authorized/i.test(msg);
}

/**
 * Subscribe to an MQTT topic with automatic handling of "Not authorized" errors.
 * When the broker rejects the subscription (e.g., expired JWT), calls onAuthError callback.
 * 
 * @param client - The MQTT client
 * @param topic - Topic to subscribe to
 * @param onAuthError - Callback to trigger reconnect with fresh token
 * @returns Promise that resolves when subscribe succeeds or rejects on error
 */
export function subscribeWithAuthRetry(
    client: MqttClient,
    topic: string,
    onAuthError: () => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        client.subscribe(topic, (err: Error | null) => {
            if (err) {
                console.error('[MQTT] Failed to subscribe', topic, err);
                if (isSubscribeNotAuthorized(err)) {
                    console.warn('[MQTT] Subscribe "Not authorized" (likely expired JWT), reconnecting with fresh token');
                    onAuthError();
                }
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
