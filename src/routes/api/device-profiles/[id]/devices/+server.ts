import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, url, auth } = event;
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
            // Get query parameters
            const search = url.searchParams.get('search');
            const deviceType = url.searchParams.get('deviceType');
            const tagId = url.searchParams.get('tagId');
            const status = url.searchParams.get('status'); // 'assigned' | 'available'
            const limit = parseInt(url.searchParams.get('limit') || '100');
            const offset = parseInt(url.searchParams.get('offset') || '0');

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

            // Build where clause for devices
            const where: any = {
                status: 'ACTIVE'
            };

            // Filter devices by account membership
            // Admin can see all devices, regular users can only see devices from their accounts
            if (event.auth?.user?.systemRole !== SystemRole.ADMIN) {
                // Get user's account memberships
                const userAccounts = await prisma.accountMembership.findMany({
                    where: { userId: auth?.user?.id },
                    select: { accountId: true }
                });
                
                const accountIds = userAccounts.map(membership => membership.accountId);
                
                if (accountIds.length === 0) {
                    // User has no account access, return empty result
                    return json({
                        success: true,
                        devices: [],
                        total: 0,
                        pagination: {
                            limit,
                            offset,
                            hasMore: false
                        }
                    });
                }
                
                // Filter devices to only those in user's accounts
                where.accountId = {
                    in: accountIds
                };
            }

            // Search filter
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { macAddress: { contains: search, mode: 'insensitive' } },
                    { deviceType: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Device type filter
            if (deviceType && deviceType !== 'all') {
                where.deviceType = deviceType;
            }

            // Tag filter
            if (tagId && tagId !== 'all') {
                where.tags = {
                    some: {
                        id: tagId
                    }
                };
            }

            // Status filter (assigned/available)
            if (status === 'assigned') {
                where.profileAssignment = {
                    isNot: null
                };
            } else if (status === 'available') {
                where.profileAssignment = null;
            }

            // Get devices with their current profile assignments
            const devices = await prisma.device.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    deviceType: true,
                    status: true,
                    macAddress: true,
                    connected: true,
                    createdAt: true,
                    tags: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    },
                    profileAssignment: {
                        select: {
                            id: true,
                            status: true,
                            assignedAt: true,
                            profile: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });

            // Filter devices by specific profile if status is 'assigned'
            let filteredDevices = devices;
            let totalCount = await prisma.device.count({ where });

            if (status === 'assigned') {
                filteredDevices = devices.filter(device => 
                    device.profileAssignment?.profile?.id === profileId
                );
                
                // Get the correct total count for assigned devices
                const assignedWhere = { ...where };
                assignedWhere.profileAssignment = {
                    isNot: null
                };
                const allAssignedDevices = await prisma.device.findMany({
                    where: assignedWhere,
                    select: {
                        id: true,
                        profileAssignment: {
                            select: {
                                profile: {
                                    select: {
                                        id: true
                                    }
                                }
                            }
                        }
                    }
                });
                totalCount = allAssignedDevices.filter(device => 
                    device.profileAssignment?.profile?.id === profileId
                ).length;
            }

            return json({
                success: true,
                devices: filteredDevices,
                total: totalCount,
                pagination: {
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            });

        } catch (error) {
            logger.error(`[Devices List] Error: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to fetch devices',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

