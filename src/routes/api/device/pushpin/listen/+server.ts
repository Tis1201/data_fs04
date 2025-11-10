// src/routes/api/device/pushpin/listen/+server.ts
// Scalable Pushpin implementation for 100k+ devices
import type { RequestHandler } from './$types';
import { auth_device } from '$lib/server/device/deviceAuth';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { PushpinConnection } from '$lib/server/messaging/connections/pushpin_connection';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { getPresenceManager, getMessageRelay } from '$lib/server/pushpin/middleware';
import { getRedisService } from '$lib/server/services/redisService';
import { publishDeviceStatusEvent } from '$lib/server/device/deviceEventPublisher';
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
    logger.info('[Pushpin GET] Request received', {
      url: url.toString(),
      hasToken: !!url.searchParams.get('token'),
      headers: Object.fromEntries(request.headers.entries())
    });
    
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

    // Get MessageRelay for Redis Pub/Sub publishing
    const messageRelay = getMessageRelay();
    if (!messageRelay) {
      logger.error('[Pushpin] MessageRelay not initialized');
      return new Response('MessageRelay not available', { status: 500 });
    }

    // Best-effort side effects (never fail the stream)
    try { 
      await DeviceStatusManager.setDeviceOnline(device.id, locals, device.id);
      logger.info(`[Pushpin] Device ${device.id} marked as online`);
    }
    catch (e) {
      logger.warn('[Pushpin] setDeviceOnline failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // Note: In stateless Pushpin mode, we don't maintain connection objects
    // Pushpin handles the connection, pushpin-tracker handles presence
    logger.info(`[Pushpin] Device ${device.id} authenticated for user ${userInfo.id}`);

    // CRITICAL: Register virtual connection in ConnectionManager so publisher can route messages
    // Even though Pushpin manages the actual connection, we need a connection entry for message routing
    const pushpinConn = new PushpinConnection(
      {
        id: device.id,
        deviceId: device.id,
        nodeId: 'pushpin', // Static node ID for Pushpin connections
        connectedAt: Date.now(),
        protocol: 'pushpin' as const,
        userInfo: userInfo
      },
      // Provide publish function so PushpinConnection can send messages via Redis Pub/Sub
      (channel: string, message: any) => messageRelay.publishToChannel(channel, message)
    );
    
    ConnectionManager.registerConnection(pushpinConn);
    logger.info(`[Pushpin] Registered virtual connection with publish function for device ${device.id}`);

    try {
      // Only add subscription if it doesn't already exist
      // Don't remove existing subscriptions as this causes race conditions
      await subscriptionRegistry.addSubscription(
        `subscription:device:${device.id}`,
        `subscriber:connection:${device.id}`
      );
    } catch (e) {
      logger.warn('[Pushpin] Subscription setup failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    logger.info(`[Pushpin] Device ${device.id} connected - Returning GRIP response`);

    // SCALABLE APPROACH: Return immediately with GRIP headers
    // Pushpin will hold the connection and we'll publish messages via Pushpin control endpoint
    // This allows 100k+ devices because we don't maintain per-device state

    // Publish connection event asynchronously (don't block the response)
    setTimeout(async () => {
      try {
        // Use new centralized publisher that publishes to multiple channels:
        // 1. subscription:device:{deviceId} (backward compatibility)
        // 2. subscription:account:{accountId}:devices (for account members)
        // 3. subscription:admin:devices (for admin users)
        await publishDeviceStatusEvent(device, {
          deviceId: device.id,
          connected: true,
          timestamp: new Date().toISOString()
        });
        
        // Also send initial connected message to the device via Redis Pub/Sub
        const messageRelay = getMessageRelay();
        if (messageRelay) {
          await messageRelay.publishToChannel(channel, {
            type: 'connected',
            deviceId: device.id,
            message: 'Device connected successfully',
            timestamp: new Date().toISOString()
          });
        }
        
        logger.info(`[Pushpin] Connection event and welcome message published for device ${device.id}`);
      } catch (e) {
        logger.warn('[Pushpin] Initial publish failed', {
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }, 100); // 100ms delay to ensure subscriptions are registered

    // Return GRIP response immediately - Pushpin will hold the connection
    // No ReadableStream, no Redis subscriber per device = SCALABLE!
    return new Response('', {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        // GRIP headers tell Pushpin to hold this connection as a stream
        'Grip-Hold': 'stream',
        'Grip-Channel': channel,
        // Use escaped newlines (\\n) for HTTP header - Pushpin will interpret them
        'Grip-Keep-Alive': ':\\n\\n; format=cstring; timeout=15'
      }
    });
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    const stack = (error instanceof Error) ? error.stack : undefined;
    
    // Log error in multiple formats to ensure we see it
    console.error('[Pushpin] CATCH BLOCK ERROR:', error);
    console.error('[Pushpin] Error message:', msg);
    console.error('[Pushpin] Error stack:', stack);
    
    logger.error('[Pushpin] Device Pushpin listen error', { 
      error: msg,
      stack,
      errorType: error?.constructor?.name,
      rawError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    return new Response(`Pushpin connection failed: ${msg}`, { status: 500 });
  }
};
