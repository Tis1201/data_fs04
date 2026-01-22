import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

/**
 * GET /api/devices/[id]/deployments
 * 
 * Get all bundle deployments (bundles) that include this device.
 * Returns bundles with their status, apps, and deployment progress for this device.
 * 
 * Query params:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 10, max: 50)
 * - status: filter by bundle status (DRAFT, PUBLISHED, COMPLETED, FAILED, CANCELLED)
 */
export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, url } = event;
        const deviceId = params.id;

        if (!event.auth?.user) {
            return json({ 
                success: false, 
                error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } 
            }, { status: 401 });
        }

        const user = event.auth.user;
        
        if (!deviceId) {
            return json({ 
                success: false, 
                error: { code: 'INVALID_REQUEST', message: 'Device ID is required' }
            }, { status: 400 });
        }

        // Parse query params
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')));
        const statusFilter = url.searchParams.get('status');

        try {
            // Verify device exists and user has access
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { 
                    id: true, 
                    name: true,
                    createdBy: true,
                    accountId: true
                }
            });

            if (!device) {
                return json({ 
                    success: false, 
                    error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' }
                }, { status: 404 });
            }

            // Check if user has access to this device
            if (user.systemRole !== SystemRole.ADMIN && device.createdBy !== user.id) {
                return json({ 
                    success: false, 
                    error: { code: 'FORBIDDEN', message: 'Access denied to this device' }
                }, { status: 403 });
            }

            // Build where clause for BundleDevice
            const bundleDeviceWhere: any = {
                deviceId: deviceId
            };

            // Get all BundleDevice entries for this device
            const bundleDevices = await prisma.bundleDevice.findMany({
                where: bundleDeviceWhere,
                select: {
                    id: true,
                    bundleId: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (bundleDevices.length === 0) {
                return json({
                    success: true,
                    data: {
                        deployments: [],
                        pagination: {
                            page,
                            pageSize,
                            total: 0,
                            totalPages: 0
                        }
                    }
                });
            }

            const bundleIds = bundleDevices.map(bd => bd.bundleId);

            // Build bundle where clause
            const bundleWhere: any = {
                id: { in: bundleIds }
            };
            
            if (statusFilter) {
                bundleWhere.status = statusFilter;
            }

            // Get total count
            const total = await prisma.bundle.count({ where: bundleWhere });

            // Get bundles with pagination
            const bundles = await prisma.bundle.findMany({
                where: bundleWhere,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    os: true,
                    status: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                    scheduledAt: true,
                    apps: {
                        select: {
                            id: true,
                            order: true,
                            resource: {
                                select: {
                                    id: true,
                                    name: true,
                                    version: true,
                                    packageName: true
                                }
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                }
            });

            // Get progress for this device for each bundle
            const bundleDeviceMap = new Map(bundleDevices.map(bd => [bd.bundleId, bd]));
            
            // Get progress entries for this device
            const progressEntries = await prisma.bundleDeviceProgress.findMany({
                where: {
                    bundleId: { in: bundleIds },
                    bundleDevice: {
                        deviceId: deviceId
                    }
                },
                select: {
                    id: true,
                    bundleId: true,
                    status: true,
                    result: true,
                    errorDetails: true,
                    startedAt: true,
                    completedAt: true,
                    retryCount: true
                },
                orderBy: { createdAt: 'desc' }
            });

            // Group progress by bundleId (take latest)
            const progressMap = new Map<string, typeof progressEntries[0]>();
            for (const progress of progressEntries) {
                if (!progressMap.has(progress.bundleId)) {
                    progressMap.set(progress.bundleId, progress);
                }
            }

            // Transform bundles to deployment format
            const deployments = bundles.map(bundle => {
                const bundleDevice = bundleDeviceMap.get(bundle.id);
                const progress = progressMap.get(bundle.id);
                
                // Determine device-specific status
                let deviceStatus = bundleDevice?.status || 'PENDING';
                if (progress) {
                    deviceStatus = progress.status;
                }

                return {
                    id: bundle.id,
                    name: bundle.name,
                    description: bundle.description,
                    os: bundle.os,
                    bundleStatus: bundle.status,
                    deviceStatus: deviceStatus,
                    version: bundle.version,
                    scheduledAt: bundle.scheduledAt,
                    createdAt: bundle.createdAt,
                    updatedAt: bundle.updatedAt,
                    apps: bundle.apps.map(app => ({
                        id: app.id,
                        order: app.order,
                        name: app.resource.name,
                        version: app.resource.version,
                        packageName: app.resource.packageName
                    })),
                    progress: progress ? {
                        status: progress.status,
                        result: progress.result,
                        errorDetails: progress.errorDetails,
                        startedAt: progress.startedAt,
                        completedAt: progress.completedAt,
                        retryCount: progress.retryCount
                    } : null
                };
            });

            logger.info(`[DeploymentsAPI] Retrieved ${deployments.length} deployments for device ${deviceId}`);

            return json({
                success: true,
                data: {
                    deployments,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize)
                    }
                }
            });

        } catch (error) {
            logger.error(`[DeploymentsAPI] Error retrieving deployments: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to retrieve deployments',
                    details: String(error)
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
