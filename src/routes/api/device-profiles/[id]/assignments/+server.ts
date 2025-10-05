import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

export const GET: RequestHandler = restrict(
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
            // Get device profile with assignments
            const deviceProfile = await prisma.deviceProfile.findUnique({
                where: { id: profileId },
                include: {
                    assignments: {
                        include: {
                            device: {
                                select: {
                                    id: true,
                                    name: true,
                                    status: true,
                                    connected: true,
                                    lastUsedAt: true
                                }
                            }
                        },
                        orderBy: {
                            assignedAt: 'desc'
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!deviceProfile) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'NOT_FOUND', 
                        message: 'Device profile not found',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 404 });
            }

            // Check access permissions
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

            // Format assignments with status information
            const assignments = deviceProfile.assignments.map(assignment => ({
                id: assignment.id,
                deviceId: assignment.deviceId,
                deviceName: assignment.device.name,
                deviceStatus: assignment.device.status,
                deviceConnected: assignment.device.connected,
                deviceLastUsed: assignment.device.lastUsedAt,
                profileId: assignment.profileId,
                status: assignment.status,
                // Note: Enhanced fields will be available after schema migration
                // For now, we'll return the basic assignment data
                assignedAt: assignment.assignedAt,
                appliedAt: assignment.appliedAt,
                // Placeholder for future enhanced fields
                applicationStatus: null,
                applicationMessage: null,
                applicationError: null,
                lastAttemptAt: null,
                attemptCount: 0
            }));

            return json({
                success: true,
                data: {
                    profile: {
                        id: deviceProfile.id,
                        name: deviceProfile.name,
                        description: deviceProfile.description,
                        isActive: deviceProfile.isActive,
                        account: deviceProfile.account
                    },
                    assignments,
                    summary: {
                        total: assignments.length,
                        applied: assignments.filter(a => a.status === 'APPLIED').length,
                        failed: assignments.filter(a => a.status === 'FAILED').length,
                        applying: assignments.filter(a => a.status === 'APPLYING').length,
                        pending: assignments.filter(a => a.status === 'PENDING').length
                    }
                },
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            logger.error(`[DeviceProfileAssignmentsAPI] Error fetching assignments: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to fetch device profile assignments',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
