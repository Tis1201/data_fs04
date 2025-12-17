import { browser } from '$app/environment';
import { mqttClient } from './mqttClient';
import { decodeNotificationJwtPayload } from './notificationUtils';

interface WaitForFlowOptions {
  timeoutMs?: number;
}

interface ScreenshotResult {
  data: string;
  format?: string;
  width?: number;
  height?: number;
}

export async function waitForScreenshotResult(
  flowId: string,
  deviceId: string,
  options: WaitForFlowOptions = {}
): Promise<ScreenshotResult> {
  if (!browser) {
    throw new Error('MQTT screenshot flow is only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 15000;

  // Ensure MQTT client is connected
  if (mqttClient.status !== 'connected') {
    await mqttClient.connect();
  }

  return new Promise<ScreenshotResult>((resolve, reject) => {
    let settled = false;

    console.log('[MQTT ScreenshotFlow] Waiting for screenshot result', {
      flowId,
      deviceId,
      timeoutMs
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      console.warn('[MQTT ScreenshotFlow] Timeout waiting for screenshot result', {
        flowId,
        timeoutMs
      });
      reject(new Error(`Timed out waiting for screenshot result (flowId=${flowId})`));
    }, timeoutMs);

    // Subscribe to device.screenshot notifications
    const unsubscribe = mqttClient.onNotification('device.screenshot', async (payload: any) => {
      console.log('[MQTT ScreenshotFlow] Handler called with payload:', payload);
      
      // mqttClient already decoded the JWT, so payload is the decoded params
      // payload contains: { objectPath, downloadUrl, format, payload: {...}, requestId, scope, ... }
      const downloadUrl = payload?.downloadUrl;

      console.log('[MQTT ScreenshotFlow] Received screenshot notification', {
        expectedFlowId: flowId,
        hasDownloadUrl: !!downloadUrl,
        downloadUrl: downloadUrl ? downloadUrl.substring(0, 100) + '...' : undefined
      });

      if (!downloadUrl) {
        console.warn('[MQTT ScreenshotFlow] No downloadUrl in notification', payload);
        return;
      }

      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();

      console.log('[MQTT ScreenshotFlow] Screenshot URL received, returning directly');

      try {
        // Server already generated the download URL, just use it directly
        // The UI can use this as <img src={downloadUrl} /> or fetch and convert to base64 if needed
        
        // For compatibility with existing UI that expects base64, we'll still fetch and convert
        // But this could be simplified to just return the URL
        const imageResponse = await fetch(downloadUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download screenshot: ${imageResponse.status}`);
        }

        const blob = await imageResponse.blob();
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove data:image/jpeg;base64, prefix if present
          const data = base64data.split(',')[1] || base64data;
          
          console.log('[MQTT ScreenshotFlow] Screenshot downloaded and converted to base64');

      resolve({
        data,
            format: payload?.format || 'jpeg',
            width: payload?.width,
            height: payload?.height,
            downloadUrl // Include URL in case UI wants to use it directly
          });
        };

        reader.onerror = () => {
          reject(new Error('Failed to convert screenshot to base64'));
        };

        reader.readAsDataURL(blob);

      } catch (error) {
        console.error('[MQTT ScreenshotFlow] Error fetching screenshot', error);
        reject(error);
      }
    });
  });
}
