/**
 * Controller-bridge presence (radar app MQTT session), separate from the RDM agent.
 * Keys: `presence:controller:<id>`. See also {@link areDevicesOnline}.
 */

import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * Check if a controller's MQTT bridge is currently online.
 * Priority: Redis (fast) → Database (fallback).
 */
export async function isControllerOnline(controllerId: string): Promise<boolean> {
    try {
        if (redis) {
            try {
                const exists = await redis.exists(`presence:controller:${controllerId}`);
                logger.debug(
                    `[ControllerPresence] Redis check - controller ${controllerId} online: ${exists === 1}`
                );
                return exists === 1;
            } catch (redisError) {
                logger.warn(
                    '[ControllerPresence] Redis check failed, falling back to database',
                    {
                        error:
                            redisError instanceof Error
                                ? redisError.message
                                : String(redisError),
                        controllerId
                    }
                );
            }
        }

        const prisma = getAdminPrisma();
        const controller = await prisma.controller.findUnique({
            where: { id: controllerId },
            select: { connected: true, disconnectedAt: true }
        });

        if (!controller) {
            logger.warn(`[ControllerPresence] Controller ${controllerId} not found`);
            return false;
        }

        // Match devicePresence: if `disconnectedAt` is very recent, treat as offline.
        if (controller.connected && controller.disconnectedAt) {
            const disconnectAge =
                Date.now() - new Date(controller.disconnectedAt).getTime();
            if (disconnectAge < 30000) return false;
        }

        return controller.connected ?? false;
    } catch (error) {
        logger.error('[ControllerPresence] Failed to check online status', {
            error: error instanceof Error ? error.message : String(error),
            controllerId
        });
        return false;
    }
}

/**
 * Batch check if multiple controllers' MQTT bridges are online.
 * Priority: Redis (`presence:controller:<id>`) → Database (fallback).
 */
export async function areControllersOnline(
    controllerIds: string[]
): Promise<Map<string, boolean>> {
    try {
        if (controllerIds.length === 0) {
            return new Map();
        }

        const unique = [...new Set(controllerIds)];

        if (redis) {
            try {
                const pipeline = redis.pipeline();
                const keys = unique.map((id) => `presence:controller:${id}`);
                keys.forEach((key) => pipeline.exists(key));
                const results = await pipeline.exec();

                const fromRedis = new Map<string, boolean>();
                unique.forEach((controllerId, index) => {
                    const exists = results?.[index]?.[1] === 1;
                    fromRedis.set(controllerId, exists);
                });
                logger.debug(
                    `[ControllerPresence] Redis batch check completed for ${unique.length} controller(s)`
                );
                return fromRedis;
            } catch (redisError) {
                logger.warn('[ControllerPresence] Redis batch check failed, falling back to database', {
                    error: redisError instanceof Error ? redisError.message : String(redisError),
                    controllerCount: unique.length
                });
            }
        }

        const prisma = getAdminPrisma();
        const controllers = await prisma.controller.findMany({
            where: { id: { in: unique } },
            select: { id: true, connected: true, disconnectedAt: true }
        });

        const result = new Map<string, boolean>();
        const now = Date.now();

        for (const controllerId of unique) {
            const c = controllers.find((x) => x.id === controllerId);
            if (!c) {
                result.set(controllerId, false);
                continue;
            }
            let isOnline = c.connected ?? false;
            if (isOnline && c.disconnectedAt) {
                const disconnectAge = now - new Date(c.disconnectedAt).getTime();
                if (disconnectAge < 30000) {
                    isOnline = false;
                }
            }
            result.set(controllerId, isOnline);
        }

        return result;
    } catch (error) {
        logger.error('[ControllerPresence] Failed to batch check controller online status', {
            error: error instanceof Error ? error.message : String(error),
            controllerCount: controllerIds.length
        });
        return new Map(controllerIds.map((id) => [id, false]));
    }
}
