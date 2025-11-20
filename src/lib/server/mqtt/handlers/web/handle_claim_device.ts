import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../core/publish';
import type { RpcResponse, RpcHandlerArgs } from '../index';

interface ClaimDeviceParams {
    pin?: string;
}

/**
 * Web-side claim handler.
 *
 * Called via MQTT RPC with op: 'web.claim.device' on a topic like:
 *   user:<id>/requests
 *
 * For now this is intentionally minimal: it just checks that the
 * provided PIN matches an existing factoryDevice.registrationPin
 * and returns that device's id so you can wire up the rest of the
 * claim flow without impacting other code paths.
 */
export async function handleClaimDevice(
    params: ClaimDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ factoryDeviceId: string }> | never> {

    const pin = params.pin?.trim();

    if (!pin) {
        throw new Error('PIN is required');
    }

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    logger.info(`[WebClaim] User ${sub} attempting to claim device with PIN ${pin}`);

    // Look up a factory device by registrationPin
    const factoryDevice = await prisma.factoryDevice.findFirst({
        where: { registrationPin: pin }
    });

    if (!factoryDevice) {
        throw new Error('Invalid or expired PIN');
    }

    // For now, just return the device id. Full claim logic (linking
    // to a user account, clearing the PIN, etc.) can be added later.
    logger.info(
        `[WebClaim] PIN ${pin} matched factory device ${factoryDevice.id} for user ${sub}`
    );

    //We need the user information to generate the ticket
    const user_id = sub.split(':')[1];
    const user = await prisma.user.findUnique({
        where: { id: user_id }
    });

    if (!user) {
        throw new Error('User not found');
    }

    //We should convert the factory:device to a actual device and save the update to the device record
    //There would be a device api key created, we are supposed to send that to the device
    // const requestId = await sendFactoryDeviceNotificationWithTicket({
    //     prisma,
    //     factoryDeviceId: factoryDevice.id,
    //     sub,
    //     type: DeviceNotificationType.Claim
    // });

    // logger.info(
    //     `[WebClaim] Sent claim notification to device/factory:${factoryDevice.id}/notifications for user ${sub}`
    // );

    const flowId = crypto.randomUUID();

    // const ticket = await createTicket(
    //     prisma, 
    //     sub, 
    //     `device:${factoryDevice.id}`, 
    //     DeviceNotificationType.Claim, 
    //     flowId, { 
    //         factoryDeviceId: factoryDevice.id,
    //         pin: pin
    //     }, '5m');

    // console.log("------------- Ticket -------------------")

    // console.log(ticket);    

    sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `factory:${factoryDevice.id}`,
        type: DeviceNotificationType.Claim,
        flowId,
        params: {
            factoryDeviceId: factoryDevice.id,
            pin: pin
        },
        expiresIn: '5m'
    })

    //We need to send a notification message over device:<id> to get device to reply
    //Or we rcp call to device over mqtt

    return { flowId, result: { factoryDeviceId: factoryDevice.id } };
}

