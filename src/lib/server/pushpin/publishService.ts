import { logger } from '$lib/server/logger';

/**
 * PushpinPublishService sends messages directly to Pushpin's control endpoint
 * This allows Pushpin to manage all device connections without maintaining state in the backend
 * 
 * Pushpin Control Endpoint: http://pushpin:5561/publish/
 * 
 * For 100k+ devices, this is the scalable approach:
 * - Backend is stateless
 * - Pushpin holds all connections
 * - Backend just publishes when it has messages
 */
export class PushpinPublishService {
  private pushpinControlUrl: string;

  constructor(pushpinUrl?: string) {
    // Pushpin control endpoint (default port 5561)
    const baseUrl = pushpinUrl || process.env.PUSHPIN_CONTROL_URL || 'http://pushpin:5561';
    this.pushpinControlUrl = `${baseUrl}/publish/`;
    logger.info(`[PushpinPublish] Initialized with control URL: ${this.pushpinControlUrl}`);
  }

  /**
   * Publish a message to a Pushpin channel
   * This sends directly to Pushpin's HTTP control endpoint
   */
  async publishToChannel(channel: string, message: unknown): Promise<void> {
    try {
      // Format message as SSE
      const sseData = `data: ${JSON.stringify(message)}\n\n`;

      // Pushpin publish format
      const publishPayload = {
        items: [
          {
            channel: channel,
            formats: {
              'http-stream': {
                content: sseData
              }
            }
          }
        ]
      };

      const response = await fetch(this.pushpinControlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(publishPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pushpin publish failed: ${response.status} ${errorText}`);
      }

      logger.debug(`[PushpinPublish] Published to channel ${channel}`);
    } catch (error) {
      logger.error('[PushpinPublish] Failed to publish message', {
        error: error instanceof Error ? error.message : String(error),
        channel,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Publish to a device channel
   */
  async publishToDevice(deviceId: string, message: unknown): Promise<void> {
    const channel = `device:${deviceId}`;
    await this.publishToChannel(channel, message);
  }

  /**
   * Publish to multiple channels at once (broadcast)
   */
  async publishToChannels(channels: string[], message: unknown): Promise<void> {
    try {
      const sseData = `data: ${JSON.stringify(message)}\n\n`;

      const publishPayload = {
        items: channels.map(channel => ({
          channel,
          formats: {
            'http-stream': {
              content: sseData
            }
          }
        }))
      };

      const response = await fetch(this.pushpinControlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(publishPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pushpin publish failed: ${response.status} ${errorText}`);
      }

      logger.debug(`[PushpinPublish] Published to ${channels.length} channels`);
    } catch (error) {
      logger.error('[PushpinPublish] Failed to publish to multiple channels', {
        error: error instanceof Error ? error.message : String(error),
        channelCount: channels.length,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Check if Pushpin control endpoint is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.pushpinControlUrl.replace('/publish/', '/'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok || response.status === 404; // 404 is ok, means Pushpin is running
    } catch (error) {
      logger.error('[PushpinPublish] Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

// Singleton instance
let pushpinPublishService: PushpinPublishService | null = null;

export function getPushpinPublishService(): PushpinPublishService {
  if (!pushpinPublishService) {
    pushpinPublishService = new PushpinPublishService();
  }
  return pushpinPublishService;
}

