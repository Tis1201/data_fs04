import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            // Load existing device
            const device = await locals.prisma.device.findUnique({
                where: { 
                    id: params.id,
                    // Only allow users to view their own devices or devices in their account
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

            if (!device) {
                throw error(404, "Device not found or you don't have access to it");
            }

            return {
                device
            };
        } catch (e) {
            logger.error('Error loading device:', e);
            throw error(500, 'Failed to load device');
        }
    },
    [SystemRole.USER] // Allow regular users to access this route
) satisfies PageServerLoad;
