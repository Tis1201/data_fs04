import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/utils/mint';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

/**
 * POST /api/device/controller/mqtt/mint
 *
 * Mints MQTT credentials for a specific controller.
 *
 * IMPORTANT: This endpoint requires an existing controller.
 * Use GET /api/device/controller?type=<type> to retrieve/create controllers first.
 *
 * Request Body:
 * - type: Controller type (radar, camera, ble, etc.)
 * - controllerId: ID of the controller (required)
 */
export const POST: RequestHandler = restrictDevice(async ({ device, locals, request }) => {
	logger.info(`[ControllerMqttMintAPI] Received MQTT mint request for device: ${String(device.id)}`);

	const brokerUrl = getMqttBrokerUrl();
	if (!brokerUrl) {
		logger.error('[ControllerMqttMintAPI] MQTT_BROKER_URL is not configured');
		return json(
			createErrorResponse('MQTT broker URL is not configured', {
				details: 'Set MQTT_BROKER_URL in the server environment'
			}),
			{ status: 500 }
		);
	}

	try {
		// Parse request body
		const body = await request.json();
		const { type, controllerId } = body;

		if (!type) {
			return json(
				createErrorResponse('Missing required field: type', {
					details: 'Request body must include "type" field (e.g., "radar", "camera")'
				}),
				{ status: 400 }
			);
		}

		let controller;

		if (controllerId) {
			// Validate that the controller exists and belongs to this device
			controller = await locals.prisma.controller.findFirst({
				where: {
					id: controllerId,
					deviceId: device.id,
					type: type,
					isDeleted: false
				}
			});

			if (!controller) {
				logger.warn(
					`[ControllerMqttMintAPI] Controller not found: controllerId=${controllerId}, deviceId=${device.id}, type=${type}`
				);
				
				// Check if controller exists but belongs to different device
				const controllerExists = await locals.prisma.controller.findFirst({
					where: {
						id: controllerId,
						type: type,
						isDeleted: false
					},
					select: {
						deviceId: true,
						device: {
							select: {
								name: true
							}
						}
					}
				});
				
				if (controllerExists) {
					logger.warn(
						`[ControllerMqttMintAPI] Controller ${controllerId} belongs to different device: ${controllerExists.deviceId}`
					);
					return json(
						createErrorResponse('Controller not found for this device', {
							details: `Controller ${controllerId} has been assigned to a different device. Please call GET /api/device/controller?type=${type} to retrieve or create a new controller for this device.`
						}),
						{ status: 404 }
					);
				}
				
				return json(
					createErrorResponse('Controller not found', {
						details: `No ${type} controller with ID ${controllerId} found. Use GET /api/device/controller?type=${type} to retrieve/create one.`
					}),
					{ status: 404 }
				);
			}
		} else {
			// Auto-find or create controller if controllerId not provided
			logger.info(
				`[ControllerMqttMintAPI] controllerId not provided, finding or creating ${type} controller for device ${device.id}`
			);

			// Check if device has an account (required for controller creation)
			if (!device.accountId) {
				return json(
					createErrorResponse('Device has no associated account', {
						details: 'Device must be claimed and associated with an account to create controllers'
					}),
					{ status: 400 }
				);
			}

			// Find existing controller
			controller = await locals.prisma.controller.findFirst({
				where: {
					deviceId: device.id,
					type: type,
					isDeleted: false
				}
			});

			// Auto-create if not found
			if (!controller) {
				logger.info(`[ControllerMqttMintAPI] Auto-creating new ${type} controller for device ${device.id}`);

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
						description: 'Auto-created during MQTT mint',
						// Auto-create sensor when creating controller
						sensors: {
							create: {
								name: `Auto-created ${type.charAt(0).toUpperCase() + type.slice(1)} Sensor`,
								type: type,
								serialNumber: `${serialNumber}-SENSOR`,
								status: 'ACTIVE',
								account: {
									connect: { id: device.accountId }
								},
								description: 'Auto-created sensor for controller',
								config: {},
								configVersion: 1,
								syncStatus: 'PENDING'
							}
						}
					}
				});

				logger.info(`[ControllerMqttMintAPI] Created controller: ${controller.id} (${controller.type})`);
			} else {
				logger.info(`[ControllerMqttMintAPI] Found existing controller: ${controller.id} (${controller.type})`);
			}
		}

		logger.info(
			`[ControllerMqttMintAPI] Validated controller: ${controller.id} (${controller.type}) for device ${device.id}`
		);

		// Build MQTT username and topic patterns
		const mqttUsername = `device:${device.id}`;
		const effectiveControllerId = controller.id;
		const topicPrefix = `${mqttUsername}/controller/${type}:${effectiveControllerId}`;

		const mintData = await mintIoTCoreCredentials({
			username: mqttUsername,
			pubTopics: [`${topicPrefix}/replies`, `${topicPrefix}/requests`, `${topicPrefix}/data`, `${topicPrefix}/loopback`],
			subTopics: [`${topicPrefix}/response`, `${topicPrefix}/notifications`, `${topicPrefix}/loopback`]
		});

		if (!mintData) {
			return json(
				createErrorResponse('Failed to mint MQTT credentials from IoT Core', {
					details: 'See server logs for IoT Core mint failure details'
				}),
				{ status: 502 }
			);
		}

		const { token, clientId, username } = mintData;

		logger.info(
			`[ControllerMqttMintAPI] Minted MQTT credential for controller ${effectiveControllerId} (type=${type}, clientId=${clientId})`
		);

		const effectiveUsername = username ?? mqttUsername;

		const payload = buildMqttMintPayload({
			brokerUrl,
			clientId,
			token,
			username: effectiveUsername,
			includeLegacyMqttUsername: true
		});

		// Include the controller ID in the response
		return json(
			createSuccessResponse({
				...payload,
				controllerId: controller.id
			})
		);
	} catch (err) {
		logger.error(`[ControllerMqttMintAPI] Error: ${String(err)}`);
		return json(createErrorResponse('Internal server error'), { status: 500 });
	}
});


