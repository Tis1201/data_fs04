/**
 * MQTT WebRTC Handlers
 * 
 * Handles WebRTC signaling MQTT RPC operations from web clients.
 * Replaces SSE-based WebRTC signaling with MQTT.
 */

import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { sendNotificationWithTicket } from '../../../core/publish';
import { DeviceNotificationType } from '../../../core/publish';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from '../shared/access_checker';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface WebRTCConnectParams {
    deviceId: string;
}

interface WebRTCAnswerParams {
    deviceId: string;
    answer: RTCSessionDescriptionInit;
}

interface WebRTCICECandidateParams {
    deviceId: string;
    candidate: RTCIceCandidateInit;
}

interface WebRTCVideoRequestParams {
    deviceId: string;
}

// ============================================================================
// RPC HANDLERS
// ============================================================================

/**
 * Handle WebRTC connect request
 * Initiates WebRTC connection with the device
 */
/**
 * Handle WebRTC connect request
 * Initiates WebRTC connection with the device
 */
export async function handleWebRTCConnect(
    params: WebRTCConnectParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string; flowId: string; turnCredentials?: any }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRTC] User ${sub} initiating WebRTC connection to device ${deviceId}`);

    // Generate TURN credentials
    const { getTurnCredentialService } = await import('../../../../services/turn-credential.service'); // Dynamic import to avoid cycles
    const turnService = getTurnCredentialService();
    const turnCredentials = await turnService.generateCredentials();

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send notification to device to initiate WebRTC connection
    // Include TURN credentials for the device to use
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.WebRTC,
        flowId,
        params: {
            action: 'webrtc:connect',
            turnCredentials: {
                iceServers: turnCredentials.iceServers,
                expiresAt: turnCredentials.expiresAt
            }
        },
        expiresIn: '30m'
    });

    logger.info(`[WebRTC] Dispatched webrtc:connect for device ${deviceId} (flowId=${flowId})`);

    return {
        flowId,
        result: {
            deviceId,
            flowId,
            turnCredentials // Return credentials to web client in the RPC response
        }
    };
}

/**
 * Handle WebRTC answer
 * Sends SDP answer to device
 */
export async function handleWebRTCAnswer(
    params: WebRTCAnswerParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRTC] User ${sub} sending SDP answer to device ${deviceId}`);

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send SDP answer to device
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.WebRTC,
        flowId,
        params: {
            action: 'webrtc:answer',
            answer: params.answer
        },
        expiresIn: '5m'
    });

    logger.debug(`[WebRTC] Dispatched webrtc:answer for device ${deviceId}`);

    return {
        flowId,
        result: {
            deviceId
        }
    };
}

/**
 * Handle WebRTC ICE candidate
 * Sends ICE candidate to device
 */
export async function handleWebRTCICECandidate(
    params: WebRTCICECandidateParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.debug(`[WebRTC] User ${sub} sending ICE candidate to device ${deviceId}`);

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send ICE candidate to device
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.WebRTC,
        flowId,
        params: {
            action: 'webrtc:ice-candidate',
            candidate: params.candidate
        },
        expiresIn: '5m'
    });

    return {
        flowId,
        result: {
            deviceId
        }
    };
}

/**
 * Handle WebRTC video request
 * Requests video stream from device
 */
export async function handleWebRTCVideoRequest(
    params: WebRTCVideoRequestParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRTC] User ${sub} requesting video from device ${deviceId}`);

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send video request to device
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.WebRTC,
        flowId,
        params: {
            action: 'webrtc:video-request'
        },
        expiresIn: '5m'
    });

    logger.info(`[WebRTC] Dispatched webrtc:video-request for device ${deviceId}`);

    return {
        flowId,
        result: {
            deviceId
        }
    };
}

