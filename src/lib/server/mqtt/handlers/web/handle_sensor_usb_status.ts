import type { RpcHandlerArgs, RpcResponse } from '$lib/server/mqtt/handlers/index';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from './shared/access_checker';
import { isControllerOnline } from '$lib/server/device/controllerPresence';

type SensorUsbStatusRequestParams = {
    sensorId: string;
};

type SensorUsbStatusRequestResult = {
    requested: boolean;
};

/**
 * Handle `sensor.usb.status.request` RPC — asks the controller to publish its
 * current radar USB link state.
 *
 * Flow:
 * 1. Browser calls `callUserRpc('sensor.usb.status.request', { sensorId })`
 * 2. Worker validates access, sends `usb.status.request` notification to controller
 * 3. Controller (or emulator) publishes `radar.usb.status` on `.../data`
 * 4. Worker fans it out as `radar:usb_status` to user notifications (existing path)
 * 5. Browser store updates automatically
 *
 * This is fire-and-forget from the worker side — no reply waiter. The response
 * arrives asynchronously via the normal USB fan-out path.
 */
export async function handleSensorUsbStatusRequest(
    params: SensorUsbStatusRequestParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<SensorUsbStatusRequestResult>> {
    if (!sub) {
        throw new Error('Missing subject');
    }

    const { sensorId } = params;
    if (!sensorId) {
        throw new Error('Missing sensorId');
    }

    const sensor = await prisma.sensor.findUnique({
        where: { id: sensorId },
        include: { controller: { include: { device: true } } }
    });

    if (!sensor) {
        throw new Error('Sensor not found');
    }

    await checkDeviceAccess({ prisma, sub, deviceId: sensor.controller.deviceId });

    const controllerId = sensor.controller.id;
    // Portal gates USB sync on radar bridge, not RDM agent (`Device.connected`).
    if (!(await isControllerOnline(controllerId))) {
        return { result: { requested: false } };
    }

    const device = sensor.controller.device;
    const controllerType = sensor.controller.type;

    const { createTicket } = await import('../../core/publish');
    const { getMqttTransport } = await import('../../core/transport');

    const recipient = `device:${device.id}/controller/${controllerType}:${controllerId}`;
    const notificationTopic = `${recipient}/notifications`;

    const ticket = await createTicket(
        prisma,
        sub,
        recipient,
        'usb.status.request',
        crypto.randomUUID(),
        { sensorId, controllerId, controllerType, deviceId: device.id },
        '1m'
    );

    const transport = getMqttTransport();
    await transport.publish(notificationTopic, JSON.stringify({ ticket }), { qos: 1 });

    logger.info('[SensorUsbStatus] Published usb.status.request', {
        sensorId,
        deviceId: device.id,
        controllerId
    });

    return { result: { requested: true } };
}
