/**
 * Attach WebSocket/stream diagnostics to an MQTT client for logging close and error events.
 * Returns a cleanup function to remove listeners.
 */

import type { MqttClient } from 'mqtt';

export function attachStreamDiagnostics(client: MqttClient): () => void {
    const stream = (client as any)?.stream;
    const cleanupFns: (() => void)[] = [];

    if (!stream) {
        return () => {};
    }

    if (typeof stream.addEventListener === 'function') {
        const handleClose = (event: Event) => {
            const closeEvent = event as CloseEvent;
            console.error('[MQTT] WebSocket close event', {
                code: closeEvent.code,
                reason: closeEvent.reason,
                wasClean: closeEvent.wasClean
            });
        };
        const handleError = (event: Event) => {
            const errorEvent = event as ErrorEvent;
            const message = errorEvent?.message ?? (event as any)?.message ?? event.type ?? 'unknown';
            console.error('[MQTT] WebSocket error event', message, event);
        };

        stream.addEventListener('close', handleClose);
        stream.addEventListener('error', handleError);

        cleanupFns.push(() => {
            stream.removeEventListener('close', handleClose);
            stream.removeEventListener('error', handleError);
        });
    } else if (typeof stream.on === 'function') {
        const handleClose = (code?: number, reason?: Buffer | string) => {
            console.error('[MQTT] Stream close event', {
                code,
                reason: typeof reason === 'string' ? reason : reason?.toString('utf8')
            });
        };
        const handleError = (error: Error) => {
            console.error('[MQTT] Stream error event', error);
        };

        stream.on('close', handleClose);
        stream.on('error', handleError);

        cleanupFns.push(() => {
            if (typeof stream.off === 'function') {
                stream.off('close', handleClose);
                stream.off('error', handleError);
            } else if (typeof stream.removeListener === 'function') {
                stream.removeListener('close', handleClose);
                stream.removeListener('error', handleError);
            }
        });
    }

    return () => {
        cleanupFns.forEach((fn) => {
            try {
                fn();
            } catch (err) {
                console.warn('[MQTT] Failed to remove diagnostics listener', err);
            }
        });
    };
}
