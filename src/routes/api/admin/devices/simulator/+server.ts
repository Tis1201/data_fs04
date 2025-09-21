// import { json } from '@sveltejs/kit';
// import type { RequestHandler } from './$types';
// import { errorHandler } from '$lib/server/errors/errorHandler';
// import { logger } from '$lib/server/logger';
// import { restrict } from '$lib/server/security/restrict';
// import { SystemRole } from '$lib/constants/system';
// import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
//
// export const POST: RequestHandler = restrict(
//     async ({ request, locals }) => {
//         try {
//             const { name, deviceType = 'kiosk', count = 1, connected = false } = await request.json();
//
//             const devices = [];
//
//             for (let i = 0; i < count; i++) {
//                 const deviceName = count > 1 ? `${name} ${i + 1}` : name;
//
//                 const device = await locals.prisma.device.create({
//                     data: {
//                         name: deviceName,
//                         deviceType,
//                         description: `Simulated device for testing`,
//                         status: 'ACTIVE',
//                         createdBy: locals.user.id,
//                         connected: false, // Always start as offline
//                         connectedAt: null,
//                         disconnectedAt: null
//                     }
//                 });
//
//                 devices.push(device);
//             }
//
//             logger.info(`Created ${devices.length} simulated devices`);
//
//             return json({
//                 success: true,
//                 devices,
//                 count: devices.length
//             });
//
//         } catch (error) {
//             logger.error('Error creating simulated devices:', error);
//             return errorHandler(error);
//         }
//     },
//     [SystemRole.ADMIN]
// );
//
// // Endpoint to control device status (works with or without Redis)
// export const PUT: RequestHandler = restrict(
//     async ({ request, locals }) => {
//         try {
//             const { deviceId, action, pattern } = await request.json();
//
//             if (!action || !['online', 'offline'].includes(action)) {
//                 return json({ error: 'Invalid action. Use "online" or "offline"' }, { status: 400 });
//             }
//
//             if (deviceId) {
//                 // Single device
//                 await DeviceStatusManager.setDeviceStatus(deviceId, action, locals);
//
//                 return json({
//                     success: true,
//                     message: `Device ${deviceId} set to ${action}`,
//                     count: 1
//                 });
//
//             } else if (pattern) {
//                 // Multiple devices by pattern
//                 await DeviceStatusManager.setDevicesByPatternStatus(pattern, action, locals);
//
//                 return json({
//                     success: true,
//                     message: `Devices matching pattern "${pattern}" set to ${action}`,
//                     pattern
//                 });
//
//             } else {
//                 return json({ error: 'Must specify deviceId or pattern' }, { status: 400 });
//             }
//
//         } catch (error) {
//             logger.error('Error controlling device status:', error);
//             return errorHandler(error);
//         }
//     },
//     [SystemRole.ADMIN]
// );
