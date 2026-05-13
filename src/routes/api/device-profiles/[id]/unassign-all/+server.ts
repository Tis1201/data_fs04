import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

export const POST: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, auth } = event;
        const profileId = params.id;
        
        if (!profileId) {
            return json({ 
                success: false, 
                error: { 
                    code: 'INVALID_REQUEST', 
                    message: 'Device Profile ID is required',
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 400 });
        }

        try {
            // Verify device profile exists
            const deviceProfile = await prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: {
                    id: true,
                    name: true,
                    accountId: true
                }
            });

            if (!deviceProfile) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'DEVICE_PROFILE_NOT_FOUND', 
                        message: 'Device profile not found',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 404 });
            }

            // Check if user has access to this device profile
            const hasAccess = await prisma.accountMembership.findFirst({
                where: {
                    accountId: deviceProfile.accountId,
                    userId: auth?.user?.id
                }
            });

            if (event.auth?.user?.systemRole !== SystemRole.ADMIN && !hasAccess) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'FORBIDDEN', 
                        message: 'Access denied to this device profile',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 403 });
            }

            // Get all devices currently assigned to this profile
            const assignedDevices = await prisma.device.findMany({
                where: {
                    profileAssignment: {
                        profileId: profileId
                    }
                },
                select: {
                    id: true
                }
            });

            if (assignedDevices.length === 0) {
                return json({ 
                    success: true, 
                    message: 'No devices were assigned to this profile',
                    data: {
                        profileId,
                        unassignedCount: 0,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Delete all profile assignments for this profile
            const result = await prisma.deviceProfileAssignment.deleteMany({
                where: {
                    profileId: profileId
                }
            });

            logger.info(`Unassigned all devices from profile`, {
                profileId,
                count: result.count,
                userId: auth?.user?.id
            });

            return json({
                success: true,
                message: `Successfully unassigned ${result.count} device(s)`,
                data: {
                    profileId,
                    unassignedCount: result.count,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error(`[Unassign All] Error: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to unassign all devices',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

