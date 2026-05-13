import type { InMessage } from '../../interfaces/message';
import { logger } from '$lib/server/logger';
import { publisher } from '../../core/publisher';
import { MessageFactory, SystemUser } from '../../interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';

export async function handleProgressUpdate(message: InMessage): Promise<void> {
  const payload = message.payload as any;
  const { logId, action, progress, message: progressMessage } = payload;
  
  // Extract device ID from scope (e.g., "subscription:device:f5b5f4b2-a07f-45e0-b2d1-5f193faa4b35")
  const scope = message.scope || '';
  const deviceIdMatch = scope.match(/subscription:device:(.+)/);
  const deviceId = deviceIdMatch ? deviceIdMatch[1] : null;
  
  if (!deviceId) {
    logger.error(`[ProgressHandler] Could not extract device ID from scope: ${scope}`);
    return;
  }
  
  // DEBUG: Log the complete payload structure (without large data)
  const debugPayload = { ...payload };
  if (debugPayload.data && typeof debugPayload.data === 'string' && debugPayload.data.length > 100) {
    debugPayload.data = `[BASE64_DATA_${debugPayload.data.length}_CHARS]`;
  }
  
  // Use console.log instead of logger for better visibility
  console.log(`[ProgressHandler] RAW DEVICE PAYLOAD:`, JSON.stringify(debugPayload, null, 2));
  console.log(`[ProgressHandler] Device progress update from ${deviceId}:`, { 
    action, 
    logId,
    progress,
    scope,
    hasFileChunk: payload.type === 'fileChunk',
    payloadKeys: Object.keys(payload),
    dataType: typeof payload.data,
    dataLength: payload.data ? payload.data.length : 0
  });

  try {
    // Update database with progress if logId is provided
    if (logId && progress !== undefined) {
      try {
        await ActionLogger.updateProgress({
          logId,
          progress,
          message: progressMessage,
          status: progress === 100 ? 'success' : 'in_progress'
        });
        console.log(`[ProgressHandler] Updated database progress for logId ${logId}: ${progress}%`);
      } catch (dbError) {
        console.error(`[ProgressHandler] Failed to update database progress: ${dbError}`);
        // Continue with SSE even if DB update fails
      }
    }

    // Forward progress update to frontend via SSE - preserve ALL payload data
    const forwardPayload = {
      ...payload, // Forward the entire payload to preserve file chunk data
      timestamp: new Date().toISOString()
    };
    
    // DEBUG: Log what we're forwarding (without large data)
    const debugForwardPayload = { ...forwardPayload };
    if (debugForwardPayload.data && typeof debugForwardPayload.data === 'string' && debugForwardPayload.data.length > 100) {
      debugForwardPayload.data = `[BASE64_DATA_${debugForwardPayload.data.length}_CHARS]`;
    }
    console.log(`[ProgressHandler] FORWARDING PAYLOAD:`, JSON.stringify(debugForwardPayload, null, 2));
    
    await publishDeviceProgressUpdate(deviceId, forwardPayload);

    logger.info(`[ProgressHandler] Published progress update for device ${deviceId}, action ${action}, progress ${progress}%`);
  } catch (error) {
    logger.error(`[ProgressHandler] Error processing progress update: ${String(error)}`);
  }
}

async function publishDeviceProgressUpdate(deviceId: string, progressData: any): Promise<void> {
  try {
    const routing = MessageFactory.createSystemMessage(
      'device:progressUpdate',
      `subscription:device:${deviceId}`,
      progressData,
      SystemUser,
      { echoToSender: false }
    );
    await publisher.publish(routing);
  } catch (err) {
    logger.error(`[ProgressHandler] Failed to publish device progress update: ${String(err)}`);
  }
}
