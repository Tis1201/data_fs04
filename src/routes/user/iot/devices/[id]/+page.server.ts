import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { z } from 'zod';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { v4 as uuidv4 } from 'uuid';


const apiKeySchema = z.object({
    deviceId: z.string()
});

export const load = restrict(
    async ({ params, locals }) => {
        try {
            console.log('Device detail load params:', params);
            console.log('Device detail load user:', locals.user);

            // Load existing device
            const device = await locals.prisma.device.findFirst({
                where: {
                    id: params.id,
                    OR: [
                        { createdBy: locals.user?.id },
                        { accountId: locals.user?.currentAccountId }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    status: true,
                    deviceType: true,
                    model: true,
                    manufacturer: true,
                    osVersion: true,
                    firmwareVersion: true,
                    hardwareId: true,
                    wifiMac: true,
                    lanMac: true,
                    ipAddress: true,
                    apiKey: true,
                    apiKeyCreatedAt: true,
                    apiKeyRotatedAt: true,
                    connected: true,
                    connectedAt: true,
                    disconnectedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    lastUsedAt: true,
                    createdBy: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    accountId: true,
                    account: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            });

            console.log('Device detail load device result:', device);

            if (!device) {
                throw error(404, "Device not found or you don't have access to it");
            }

            console.log('About to create form...');
            // Create form for API key generation
            const form = await superValidate({ deviceId: device.id }, zod(apiKeySchema));
            console.log('Form created successfully:', form);

            return {
                device,
                form
            };
        } catch (e) {
            // @ts-ignore
            logger.error('Error loading device:', e);
            throw error(500, 'Failed to load device');
        }
    },
    [SystemRole.USER] // Allow regular users to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Generate new API key for the device
     */
    generateApiKey: restrict(
        async ({ params, locals }) => {
            const auth: any = await locals.auth.validate();
            const senderInfo = auth.user;

            logger.debug(`User generating new API key for device: ${JSON.stringify(senderInfo)}`);

            const id = params.id;

            try {
                const device = await locals.prisma.device.findUnique({
                    where: { 
                        id,
                        OR: [
                            { createdBy: locals.user?.id },
                            { accountId: locals.user?.currentAccountId }
                        ]
                    }
                });

                if (!device) {
                    return fail(404, {
                        error: 'Device not found or you don\'t have access to it'
                    });
                }

                const apiKey = crypto.randomUUID();

                logger.info(`User generating new API key for device ${id}: ${apiKey}`);

                const message = {
                    id: uuidv4(),
                    scope: `subscription:device:${id}`,
                    senderId: 'system',
                    timestamp: new Date().toISOString(),
                    userInfo: senderInfo
                };

                const updateMessage = MessageFactory.toRoutingMessage({
                    ...message,
                    type: 'device',
                    payload: {
                        action: 'rotateKey',
                        success: true,
                        apiKey: apiKey,
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    }
                } as any);

                await publisher.publish(updateMessage);

                const form = await superValidate({ deviceId: id }, zod(apiKeySchema));

                return {
                    form,
                    success: true,
                    message: 'API key generated successfully',
                    apiKey
                };
            } catch (e) {
                logger.error(`Error generating API key: ${e}`);
                return fail(500, {
                    error: 'Failed to generate API key'
                });
            }
        },
        [SystemRole.USER]
    )
};
