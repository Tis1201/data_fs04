import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { resourceSchema } from '../../../admin/iot/resources/new/resource';

// Define actions for this route
export const actions: Actions = {
    // Action to delete a resource
    deleteResource: restrict(
        async ({ params, locals }) => {
            const { id } = params;
            
            try {
                // Check if the resource exists and the user has permission to delete it
                const resource = await locals.prisma.resource.findUnique({
                    where: { id }
                });
                
                // If resource doesn't exist, return an error
                if (!resource) {
                    return fail(404, {
                        success: false,
                        message: 'Resource not found'
                    });
                }
                
                // Check if the user is the creator of the resource or has admin access
                const isCreator = resource.createdBy === locals.user.id;
                
                // Check if the user is a member of the account with appropriate permissions
                const accountMembership = await locals.prisma.accountMembership.findFirst({
                    where: {
                        accountId: resource.accountId,
                        userId: locals.user.id,
                        role: { in: ['OWNER', 'ADMIN'] }
                    }
                });
                
                // If the user is not the creator and doesn't have admin access, return an error
                if (!isCreator && !accountMembership) {
                    return fail(403, {
                        success: false,
                        message: 'You do not have permission to delete this resource'
                    });
                }
                
                // Delete the resource
                await locals.prisma.resource.delete({
                    where: { id }
                });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: id,
                    oldData: resource,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                // Return success
                return {
                    success: true,
                    message: 'Resource deleted successfully'
                };
            } catch (err) {
                logger.error(`Error deleting resource ${id}:`, err);
                return fail(500, {
                    success: false,
                    message: 'Failed to delete resource'
                });
            }
        },
        [SystemRole.USER]
    )
};

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;
        
        try {
            // Fetch the resource by ID
            const resource = await locals.prisma.resource.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            // Also fetch the creator's information if needed
            let creator = null;
            if (resource) {
                creator = await locals.prisma.user.findUnique({
                    where: { id: resource.createdBy },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });
            }
            
            // If resource doesn't exist or user doesn't have access, throw a 404 error
            if (!resource) {
                throw error(404, {
                    message: 'Resource not found',
                    code: 'RESOURCE_NOT_FOUND'
                });
            }
            
            // Check if the user has access to this resource
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: resource.accountId,
                    userId: locals.user.id,
                    role: { not: 'SYSTEM' }
                }
            });
            
            if (!hasAccess) {
                throw error(403, {
                    message: 'You do not have permission to view this resource',
                    code: 'FORBIDDEN'
                });
            }

            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form',
                dataType: 'json'
            });

            // Populate form with existing resource data
            form.data = {
                name: resource.name,
                description: resource.description || '',
                type: resource.type,
                target: resource.target,
                version: resource.version || '1.0.0',
                format: resource.format || '',
                packageName: resource.packageName || '',
                path: resource.path,
                size: resource.size,
                accountId: resource.accountId || '',
                file: null // Don't populate file field for editing
            };
            
            return {
                form,
                resource: {
                    ...resource,
                    creator // Add the creator information to the resource
                },
                userId: locals.user.id, // Pass the user ID for permission checks
                meta: {
                    title: `Resource: ${resource.name}`,
                    description: `Viewing details for resource ${resource.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading resource ${id}:${err}`,);
            throw error(500, {
                message: 'Failed to load resource',
                code: 'RESOURCE_LOAD_ERROR'
            });
        }
    },
    [SystemRole.USER]
);
