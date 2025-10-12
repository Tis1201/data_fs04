// src/routes/api/device/pushpin/listen/+server.ts
import type { RequestHandler } from './$types';
import { auth_device } from '$lib/server/device/deviceAuth';
import { PushpinConnection } from '$lib/server/messaging/connections/pushpin_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { getPresenceManager, getMessageRelay } from '$lib/server/pushpin/middleware';
import { getRedisService } from '$lib/server/services/redisService';
import { MessageRelay } from '$lib/server/pushpin/messageRelay';
import { logger } from '$lib/server/logger';
import { json } from '@sveltejs/kit';
import crypto from 'crypto';

/**
 * POST: Step 1 of two-step handshake (optional)
 * Device calls this to get Pushpin connection info and temporary token
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  try {
    // Authenticate device using API key
    const { device, userInfo } = await auth_device(locals, request);
    
    // Generate a temporary connection token (valid for 60 seconds)
    const connectionToken = crypto.randomBytes(32).toString('hex');
    const channel = `device:${device.id}`;
    
    // Store token in Redis with 60 second expiry
    const redisService = getRedisService(locals);
    if (!redisService) {
      logger.error('[Pushpin] Redis service not available');
      return json({
        success: false,
        error: 'Redis service unavailable'
      }, { status: 500 });
    }
    
    const tokenKey = `pushpin:token:${connectionToken}`;
    await redisService.setEx(tokenKey, 60, JSON.stringify({
      deviceId: device.id,
      channel: channel,
      userId: userInfo.id,
      createdAt: Date.now()
    }));
    
    logger.info(`[Pushpin] Generated connection token for device ${device.id}`);
    
    // Get Pushpin URL from environment
    const pushpinUrl = process.env.PUSHPIN_URL || 'http://localhost:7999';
    
    // Return connection info to device
    return json({
      success: true,
      connection: {
        pushpinUrl: pushpinUrl,
        endpoint: '/api/device/pushpin/listen',
        token: connectionToken,
        channel: channel,
        expiresIn: 60
      },
      device: {
        id: device.id,
        name: device.name
      }
    });
    
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('[Pushpin] Connection info request failed', { error: msg });
    return json({
      success: false,
      error: 'Failed to get connection info'
    }, { status: 401 });
  }
};

/**
 * GET: Step 2 of two-step handshake OR direct connection
 * Supports both:
 * 1. Token-based (two-step): ?token=xxx
 * 2. Direct (one-step): X-Api-Key + X-Device-Id headers
 */
export const GET: RequestHandler = async ({ locals, request, url }) => {
  try {
    let device, userInfo, channel;
    
    // Check if using token-based authentication (two-step handshake)
    const token = url.searchParams.get('token') || request.headers.get('x-connection-token');
    
    if (token) {
      // Two-step handshake: Validate token from Redis
      const redisService = getRedisService(locals);
      if (!redisService) {
        logger.error('[Pushpin] Redis service not available');
        return new Response('Redis service unavailable', { status: 500 });
      }
      
      const tokenKey = `pushpin:token:${token}`;
      const tokenData = await redisService.get(tokenKey);
      
      if (!tokenData) {
        logger.error('[Pushpin] Invalid or expired connection token');
        return new Response('Invalid or expired token', { status: 401 });
      }
      
      // Parse token data
      const { deviceId } = JSON.parse(tokenData);
      
      // Delete token (one-time use)
      await redisService.del(tokenKey);
      
      // Get device and user info from database
      device = await locals.prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              systemRole: true
            }
          }
        }
      });
      
      if (!device || !device.user) {
        logger.error('[Pushpin] Device not found or has no user');
        return new Response('Device not found', { status: 404 });
      }
      
      userInfo = {
        id: device.user.id,
        email: device.user.email,
        name: device.user.name,
        systemRole: device.user.systemRole,
        source: 'apiKey' as const
      };
      
      channel = `device:${device.id}`;
      logger.info(`[Pushpin] Device ${device.id} authenticated via token`);
      
    } else {
      // Direct connection: Use API key authentication (existing method)
      const authResult = await auth_device(locals, request);
      device = authResult.device;
      userInfo = authResult.userInfo;
      channel = `device:${device.id}`;
      logger.info(`[Pushpin] Device ${device.id} authenticated via API key`);
    }

    // Best-effort side effects (never fail the stream)
    try { await DeviceStatusManager.setDeviceOnline(device.id, locals, device.id); }
    catch (e) {
      logger.warn('[Pushpin] setDeviceOnline failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    let messageRelay = getMessageRelay();
    if (!messageRelay) {
      try {
        const redisService = getRedisService(locals);
        if (redisService) {
          messageRelay = new MessageRelay(redisService);
          logger.warn('[Pushpin] Created fallback MessageRelay');
        } else {
          logger.warn('[Pushpin] Redis service missing; relay disabled');
        }
      } catch (e) {
        logger.warn('[Pushpin] Relay init failed', {
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    // For SSE streaming, publish directly to Redis channel (not via messageRelay which uses pushpin_publish)
    const publishFn = async (ch: string, msg: unknown) => {
      try {
        const redisService = getRedisService(locals);
        if (redisService) {
          // Publish directly to the channel, not to pushpin_publish relay
          await redisService.publish(ch, JSON.stringify(msg));
          logger.debug(`[Pushpin] Published directly to Redis channel: ${ch}`);
        }
      } catch (e) {
        logger.warn('[Pushpin] Direct publish failed', {
          error: e instanceof Error ? e.message : String(e),
          channel: ch
        });
      }
    };

    try {
      const connection = new PushpinConnection(
        { id: device.id, userInfo, nodeId: 'device-pushpin-listen', protocol: 'pushpin', deviceId: device.id, connectedAt: Date.now() },
        publishFn
      );
      ConnectionManager.registerConnection(connection);
    } catch (e) {
      logger.warn('[Pushpin] Connection registration failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    try {
      await subscriptionRegistry.addSubscription(
        `subscription:device:${device.id}`,
        `subscriber:connection:${device.id}`
      );
    } catch (e) {
      logger.warn('[Pushpin] Subscription setup failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    logger.info(`[Pushpin] Device ${device.id} connected - Starting SSE stream`);

    // Set up Redis subscriber BEFORE creating the stream
    const redisService = getRedisService(locals);
    if (!redisService) {
      logger.error('[Pushpin] Redis service not available for SSE streaming');
      return new Response('Redis service unavailable', { status: 500 });
    }

    const subscriber = redisService.client.duplicate();
    
    // Wait for the 'ready' event which means connection is fully established
    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis subscriber connection timeout after 5s'));
      }, 5000);

      subscriber.on('error', (err: Error) => {
        clearTimeout(timeout);
        logger.error('[Pushpin] Redis subscriber error event', {
          error: err instanceof Error ? err.message : String(err)
        });
        reject(err);
      });

      subscriber.on('ready', () => {
        clearTimeout(timeout);
        logger.info('[Pushpin] Redis subscriber ready');
        resolve();
      });
    });

    try {

      // Start connection
      subscriber.connect().catch((err) => {
        logger.debug('[Pushpin] Redis connect() promise rejected (expected, waiting for ready event)', {
          error: err instanceof Error ? err.message : String(err)
        });
      });

      // Wait for ready event
      await readyPromise;
      logger.info('[Pushpin] Redis subscriber fully connected and ready');
      
    } catch (err) {
      logger.error('[Pushpin] Failed to connect Redis subscriber', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      if (subscriber) {
        await subscriber.quit().catch(() => {});
      }
      return new Response('Failed to setup Redis subscriber', { status: 500 });
    }



      const encoder = new TextEncoder();
    let heartbeatInterval: NodeJS.Timeout;
    
    // Helper to send SSE messages
    const sendMessage = (controller: ReadableStreamDefaultController, data: any) => {
      try {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      } catch (err) {
        logger.error('[Pushpin] Failed to encode message', { 
          error: err instanceof Error ? err.message : String(err) 
        });
      }
    };
    
    // Set up message handler before subscribing
    try {
      await subscriber.subscribe(channel);
      logger.info(`[Pushpin] Subscribed to Redis channel: ${channel}`);
    } catch (err) {
      logger.error('[Pushpin] Failed to subscribe to Redis channel', {
        error: err instanceof Error ? err.message : String(err),
        channel,
        stack: err instanceof Error ? err.stack : undefined
      });
      await subscriber.quit().catch(() => {});
      return new Response('Failed to subscribe to Redis channel', { status: 500 });
    }
    
    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connected message
        sendMessage(controller, {
          type: 'connected',
          deviceId: device.id,
          message: 'Device connected successfully',
          timestamp: new Date().toISOString()
        });
        
        // Listen for Redis messages
        subscriber.on('message', (chan: string, messageStr: string) => {
          if (chan !== channel) return;
          
          try {
            const data = JSON.parse(messageStr);
            // Unwrap Redis envelope if present
            if (data.type === 'channel_message' && data.payload) {
              sendMessage(controller, data.payload);
            } else {
              sendMessage(controller, data);
            }
          } catch (err) {
            logger.error('[Pushpin] Failed to parse Redis message', { 
              error: err instanceof Error ? err.message : String(err) 
            });
          }
        });
        
        // Send heartbeat every 30 seconds
        heartbeatInterval = setInterval(() => {
          sendMessage(controller, {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            status: 200,
            severity: 'info',
            category: 'system',
            message: 'Connection heartbeat',
            meta: {
              connectionId: device.id,
              deviceId: device.id
            },
            event: 'ping'
          });
        }, 30000);
        
        logger.info(`[Pushpin] SSE stream started for device ${device.id}`);
      },
      
      cancel() {
        // Cleanup when stream is cancelled
        logger.info(`[Pushpin] SSE stream cancelled for device ${device.id}`);
        clearInterval(heartbeatInterval);
        subscriber.unsubscribe(channel).catch(err => 
          logger.error('[Pushpin] Failed to unsubscribe', { 
            error: err instanceof Error ? err.message : String(err) 
          })
        );
        subscriber.quit().catch(err =>
          logger.error('[Pushpin] Failed to quit subscriber', { 
            error: err instanceof Error ? err.message : String(err) 
          })
        );
        
        // Remove subscription from registry
        subscriptionRegistry.remove(`subscription:device:${device.id}`).catch(err =>
          logger.error('[Pushpin] Failed to remove subscription', { 
            error: err instanceof Error ? err.message : String(err) 
          })
        );
        
        // Unregister connection from ConnectionManager
        ConnectionManager.unregisterConnection(device.id);
        
        DeviceStatusManager.setDeviceOffline(device.id, locals).catch(err =>
          logger.error('[Pushpin] Failed to set device offline', { 
            error: err instanceof Error ? err.message : String(err) 
          })
        );
      }
    });

    // Publish connection event
    try {
      const connectionMessage = MessageFactory.createSystemMessage(
        'device:connection',
        `subscription:device:${device.id}`,
        { deviceId: device.id, connected: true, connectedAt: new Date().toISOString(), protocol: 'sse' },
        userInfo,
        { echoToSender: false }
      );
      await publisher.publish(connectionMessage);
      logger.info(`[Pushpin] Connection event published for device ${device.id}`);
    } catch (e) {
      logger.warn('[Pushpin] Initial publish failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    const stack = (error instanceof Error) ? error.stack : undefined;
    logger.error('Device Pushpin listen error', { 
      error: msg,
      stack
    });
    return new Response('Pushpin connection failed', { status: 500 });
  }
};
