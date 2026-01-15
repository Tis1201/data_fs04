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
  downloadUrl?: string;
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

    // Subscribe to device.screenshot notifications (both success and error)
    const unsubscribe = mqttClient.onNotification('device.screenshot', async (payload: any) => {
      console.log('[MQTT ScreenshotFlow] Handler called with payload:', payload);

      // Check for error first
      if (payload?.error || payload?.type === 'screenshot:error') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        
        const errorMessage = payload?.error || 'Screenshot failed';
        const durationMs = payload?.durationMs;
        console.error('[MQTT ScreenshotFlow] Screenshot error received', { errorMessage, durationMs });
        
        // Create error with durationMs attached
        const error = new Error(errorMessage);
        (error as any).durationMs = durationMs;
        reject(error);
        return;
      }

      // mqttClient already decoded the JWT, so payload is the decoded params
      // payload can contain either:
      // - downloadUrl: URL to fetch the screenshot from server storage
      // - data: direct base64 image data from device
      const downloadUrl = payload?.downloadUrl;
      const directData = payload?.data;

      console.log('[MQTT ScreenshotFlow] Received screenshot notification', {
        expectedFlowId: flowId,
        hasDownloadUrl: !!downloadUrl,
        hasDirectData: !!directData,
        downloadUrl: downloadUrl ? downloadUrl.substring(0, 100) + '...' : undefined
      });

      // Handle direct base64 data from device
      if (directData && !downloadUrl) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();

        console.log('[MQTT ScreenshotFlow] Using direct base64 data from device');

        resolve({
          data: directData,
          format: payload?.format || 'jpeg',
          width: payload?.width,
          height: payload?.height
        });
        return;
      }

      if (!downloadUrl) {
        console.warn('[MQTT ScreenshotFlow] No downloadUrl or data in notification', payload);
        return;
      }

      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();

      console.log('[MQTT ScreenshotFlow] Screenshot URL received, fetching from server');

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
