import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import type { Sensor } from '@prisma/client';

/**
 * GET /api/device/controller?type=radar
 *
 * Retrieves or auto-creates controller and sensor configuration for the authenticated device.
 *
 * Query Parameters:
 * - type: Controller type (radar, camera, ble, etc.)
 *
 * Returns:
 * - controller: Controller information (auto-created if doesn't exist)
 * - sensors: Array of sensors associated with this controller
 * - config: Type-specific configuration (if any)
 */
export const GET: RequestHandler = restrictDevice(async ({ device, locals, url }) => {
    logger.info(`[ControllerConfigAPI] GET request from device: ${String(device.id)}`);

    try {
        const type = url.searchParams.get('type');

        if (!type) {
            return json(
                createErrorResponse('Missing required query parameter: type', {
                    details: 'Specify controller type as a query parameter (e.g., ?type=radar)'
                }),
                { status: 400 }
            );
        }

        // Validate controller type
        const validTypes = ['radar', 'camera', 'ble'];
        if (!validTypes.includes(type)) {
            return json(
                createErrorResponse('Invalid controller type', {
                    details: `Type must be one of: ${validTypes.join(', ')}`
                }),
                { status: 400 }
            );
        }

        // Check if device has an account (required for controller creation)
        if (!device.accountId) {
            return json(
                createErrorResponse('Device has no associated account', {
                    details: 'Device must be claimed and associated with an account to create controllers'
                }),
                { status: 400 }
            );
        }

        // Find or create controller
        let controller = await locals.prisma.controller.findFirst({
            where: {
                deviceId: device.id,
                type: type,
                isDeleted: false
            },
            include: {
                sensors: true
            }
        });

        let sensors: Sensor[] = [];

        if (!controller) {
            // Auto-create controller
            logger.info(
                `[ControllerConfigAPI] Auto-creating new ${type} controller for device ${device.id}`
            );

            const serialNumber = `${type.toUpperCase()}-${device.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

            controller = await locals.prisma.controller.create({
                data: {
                    name: `Auto-created ${type.charAt(0).toUpperCase() + type.slice(1)} Controller`,
                    type: type,
                    serialNumber: serialNumber,
                    status: 'ACTIVE',
                    device: {
                        connect: { id: device.id }
                    },
                    account: {
                        connect: { id: device.accountId }
                    },
                    description: 'Auto-created during config retrieval'
                },
                include: {
                    sensors: true
                }
            });

            logger.info(
                `[ControllerConfigAPI] Created controller: ${controller.id} (${controller.type})`
            );
            sensors = [];
        } else {
            logger.info(
                `[ControllerConfigAPI] Found existing controller: ${controller.id} (${controller.type})`
            );
            sensors = controller.sensors;
        }

        // Build response - sensors nested inside controller
        const response = {
            controller: {
                id: controller.id,
                name: controller.name,
                type: controller.type,
                serialNumber: controller.serialNumber,
                status: controller.status,
                description: controller.description,
                createdAt: controller.createdAt,
                updatedAt: controller.updatedAt,
                // Sensors nested inside controller, each with its own config
                sensors: sensors.map((sensor) => ({
                    id: sensor.id,
                    name: sensor.name,
                    type: sensor.type,
                    status: sensor.status,
                    config: sensor.config ?? getDefaultSensorConfig(sensor.type),
                    createdAt: sensor.createdAt,
                    updatedAt: sensor.updatedAt
                }))
            }
        };

        return json(createSuccessResponse(response));
    } catch (err) {
        logger.error(`[ControllerConfigAPI] Error: ${String(err)}`);
        return json(createErrorResponse('Internal server error'), { status: 500 });
    }
});

/**
 * Get default configuration for a sensor type
 */
function getDefaultSensorConfig(type: string): Record<string, unknown> {
    switch (type) {
        case 'radar':
            return {
                detectionZones: [],
                sensitivity: 50,
                range: 10
            };
        case 'camera':
            return {
                resolution: '1920x1080',
                fps: 30,
                encoding: 'h264'
            };
        case 'ble':
            return {
                scanInterval: 1000,
                advertisingPower: 0
            };
        default:
            return {};
    }
}
