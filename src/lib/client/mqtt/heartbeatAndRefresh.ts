/**
 * Heartbeat interval and proactive token-refresh timer for MQTT.
 * Uses getters so the store stays the source of truth.
 */

import type { MqttClient } from 'mqtt';

const HEARTBEAT_INTERVAL_MS = 60000;

export interface HeartbeatAndRefreshOptions {
    getClient: () => MqttClient | null;
    getUsername: () => string | null;
    getJwtExpiry: () => number;
    beforeExpiryMs: number;
    onTokenRefreshDue: () => void;
}

export interface HeartbeatAndRefreshApi {
    startHeartbeat: () => void;
    stopHeartbeat: () => void;
    scheduleTokenRefresh: () => void;
    clearTokenRefreshTimer: () => void;
}

export function createHeartbeatAndRefresh(
    options: HeartbeatAndRefreshOptions
): HeartbeatAndRefreshApi {
    const { getClient, getUsername, getJwtExpiry, beforeExpiryMs, onTokenRefreshDue } = options;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const sendHeartbeat = () => {
        const client = getClient();
        const username = getUsername();
        if (client?.connected && username) {
            const topic = `user/${username}/heartbeat`;
            const payload = JSON.stringify({ timestamp: Date.now() });
            client.publish(topic, payload, { qos: 0 }, (err) => {
                if (err) console.error('[MQTT] Failed to send heartbeat', err);
            });
        }
    };

    const startHeartbeat = () => {
        if (heartbeatTimer) return;
        console.log('[MQTT] Starting heartbeat');
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            console.log('[MQTT] Stopping heartbeat');
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    const clearTokenRefreshTimer = () => {
        if (tokenRefreshTimer) {
            clearTimeout(tokenRefreshTimer);
            tokenRefreshTimer = null;
        }
    };

    const scheduleTokenRefresh = () => {
        clearTokenRefreshTimer();
        const lastJwtExpiry = getJwtExpiry();
        if (!lastJwtExpiry || lastJwtExpiry <= 0) return;
        const now = Date.now();
        const refreshAt = lastJwtExpiry - beforeExpiryMs;
        if (refreshAt <= now) return;
        const delay = refreshAt - now;
        console.log(`[MQTT] Scheduling token refresh in ${Math.round(delay / 1000)}s (before JWT expiry)`);
        tokenRefreshTimer = setTimeout(() => {
            tokenRefreshTimer = null;
            console.log('[MQTT] Proactive token refresh: reconnecting with fresh JWT');
            onTokenRefreshDue();
        }, delay);
    };

    return {
        startHeartbeat,
        stopHeartbeat,
        scheduleTokenRefresh,
        clearTokenRefreshTimer
    };
}
