import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

export const POST: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, request, auth, fetch } = event;
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
            const body = await request.json();
            const { tagId } = body;

            if (!tagId) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'INVALID_REQUEST', 
                        message: 'Tag ID is required',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

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

            // Get devices with the specified tag that are not already assigned
            const devices = await prisma.device.findMany({
                where: {
                    tags: {
                        some: {
                            id: tagId
                        }
                    },
                    profileAssignment: null
                },
                select: {
                    id: true,
                    name: true
                }
            });

            if (devices.length === 0) {
                return json({ 
                    success: true, 
                    message: 'No available devices with this tag to assign',
                    data: {
                        profileId,
                        tagId,
                        assignedCount: 0,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Create assignments for all available devices
            const assignments = devices.map(device => ({
                deviceId: device.id,
                profileId: profileId,
                assignedBy: auth?.user?.id || 'system',
                status: 'PENDING' as const
            }));

            const result = await prisma.deviceProfileAssignment.createMany({
                data: assignments,
                skipDuplicates: true
            });

            logger.info(`Created ${result.count} profile assignments for assign-by-tag`, {
                profileId,
                tagId,
                deviceCount: result.count,
                userId: auth?.user?.id
            });

            // Call the unified assign endpoint to handle ActionLog creation and SSE messaging
            const deviceIdsToAssign = devices.map(d => d.id);
            const response = await fetch(`/api/device-profiles/${profileId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ deviceIds: deviceIdsToAssign })
            });

            if (!response.ok) {
                const data = await response.json();
                logger.error('Error calling unified assign endpoint:', data);
            }

            return json({
                success: true,
                message: `Successfully assigned ${result.count} device(s) by tag`,
                data: {
                    profileId,
                    tagId,
                    assignedCount: result.count,
                    deviceIds: deviceIdsToAssign,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error(`[Assign By Tag] Error: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to assign devices by tag',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

