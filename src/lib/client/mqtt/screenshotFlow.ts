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
        // Fetch URL (may be ?format=json which returns { url, downloadAuth } for browser-direct CDN)
        const metaResponse = await fetch(downloadUrl, { credentials: 'include' });
        const metaContentType = metaResponse.headers.get('Content-Type') ?? '';
        console.log('[MQTT ScreenshotFlow] Meta response', {
          metaUrl: downloadUrl,
          status: metaResponse.status,
          contentType: metaContentType,
          ok: metaResponse.ok
        });

        if (!metaResponse.ok) {
          const body = await metaResponse.text();
          console.error('[MQTT ScreenshotFlow] Meta fetch failed', {
            status: metaResponse.status,
            body: body.slice(0, 200)
          });
          throw new Error(`Failed to get screenshot URL: ${metaResponse.status}`);
        }

        const contentType = metaContentType;
        let blob: Blob;

        if (contentType.includes('application/json')) {
          // Browser-direct: server returned { url, downloadAuth }, fetch CDN with HMAC headers
          const meta = await metaResponse.json();
          const hasAuth = !!(meta?.downloadAuth && meta?.url);
          console.log('[MQTT ScreenshotFlow] Meta JSON parsed', {
            hasUrl: !!meta?.url,
            hasDownloadAuth: !!meta?.downloadAuth,
            cdnUrl: meta?.url ? meta.url.slice(0, 80) + '...' : undefined,
            willFetchCdnDirectly: hasAuth
          });

          if (meta.downloadAuth && meta.url) {
            console.log('[MQTT ScreenshotFlow] Fetching CDN directly (browser CORS)', {
              cdnUrl: meta.url,
              hasTimestamp: !!meta.downloadAuth.timestamp,
              hasMac: !!meta.downloadAuth.mac
            });
            const imageResponse = await fetch(meta.url, {
              method: 'GET',
              headers: {
                'x-timestamp': meta.downloadAuth.timestamp,
                'x-mac': meta.downloadAuth.mac
              }
            });
            // Log CDN response (only if we got one - CORS blocks access on fail)
            console.log('[MQTT ScreenshotFlow] CDN response', {
              status: imageResponse.status,
              ok: imageResponse.ok,
              corsHeaders: {
                'Access-Control-Allow-Origin': imageResponse.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Headers': imageResponse.headers.get('Access-Control-Allow-Headers')
              }
            });
            if (!imageResponse.ok) {
              const cdnBody = await imageResponse.text();
              console.error('[MQTT ScreenshotFlow] CDN fetch failed', {
                status: imageResponse.status,
                bodyPreview: cdnBody.slice(0, 300),
                isCloudflareBlock: cdnBody.includes('<!DOCTYPE html') && cdnBody.includes('Cloudflare')
              });
              throw new Error(`Failed to download screenshot from CDN: ${imageResponse.status}`);
            }
            blob = await imageResponse.blob();
          } else {
            // Fallback: url is proxy or direct, fetch it
            const imageResponse = await fetch(meta.url || downloadUrl, { credentials: 'include' });
            if (!imageResponse.ok) throw new Error(`Failed to download screenshot: ${imageResponse.status}`);
            blob = await imageResponse.blob();
          }
        } else {
          blob = await metaResponse.blob();
        }
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
        const err = error as Error;
        const isCorsLike =
          err.message === 'Failed to fetch' ||
          (err.name === 'TypeError' && err.message.includes('fetch'));
        console.error('[MQTT ScreenshotFlow] Error fetching screenshot', {
          error: err.message,
          name: err.name,
          likelyCors: isCorsLike,
          hint: isCorsLike
            ? 'Browser blocked: No Access-Control-Allow-Origin. Cloudflare WAF/Bot may block OPTIONS or GET before Worker. Check Security → WAF, add rule to allow cdn-dev.datarealities.com.'
            : undefined
        });
        reject(error);
      }
    });
  });
}
