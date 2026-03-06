import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedEvent, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { resourceSchema } from '../../../admin/iot/resources/new/resource';
import { deleteFileFromCloudStorage } from '$lib/server/storage';
import { createErrorResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { z } from 'zod';

const resourceSchemaWithTarget = resourceSchema.extend({
    target: z.string().optional().nullable().default('')
});

// Define actions for this route
export const actions: Actions = {
    // Action to update a resource
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;

            if (!locals.user) {
                throw error(401, 'Unauthorized');
            }
            const { id } = params;
            if (!id) {
                throw error(400, 'Missing resource id');
            }
            let existingResource;
            
            // Validate the form data
            const form = await superValidate(request, zod(resourceSchemaWithTarget));

            // Check if the form is valid
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get the existing resource
                existingResource = await locals.prisma.resource.findUnique({
                    where: { id }
                });

                if (!existingResource) {
                    return message(
                        form,
                        createErrorResponse(
                            'Resource not found',
                            'RESOURCE_NOT_FOUND',
                            { details: 'The resource you are trying to update does not exist.' }
                        )
                    );
                }

                // Check permissions: user must be the creator OR an OWNER/ADMIN of the account
                const isCreator = existingResource.createdBy === locals.user.id;
                
                const accountMembership = await locals.prisma.accountMembership.findFirst({
                    where: {
                        accountId: existingResource.accountId,
                        userId: locals.user.id,
                        role: { in: ['OWNER', 'ADMIN'] }
                    }
                });

                if (!isCreator && !accountMembership) {
                    return message(
                        form,
                        createErrorResponse(
                            'Permission denied',
                            'FORBIDDEN',
                            {
                                details:
                                    'You do not have permission to update this resource. You must be the creator or an account admin.'
                            }
                        )
                    );
                }

                // Update the resource - users can only edit name and releaseType.
                // All other fields (packageName, version, type, format, path, etc.) are read-only.
                const updatedResource = await locals.prisma.resource.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        releaseType: form.data.releaseType,
                        updatedBy: locals.user.id
                    }
                });

                logger.info(`Resource updated by user: ${updatedResource.id} (User: ${locals.user.id})`);

                // Log audit trail
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Resource',
                    recordId: updatedResource.id,
                    oldData: existingResource,
                    newData: updatedResource,
                    userId: locals.user.id,
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                return {
                    type: 'success',
                    status: 200,
                    data: [{ success: 1 }, true]
                };
            } catch (err) {
                logger.error(`Error updating resource ${id}:`, err as Record<string, any>);
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId: existingResource?.accountId,
                    defaultMessage: 'Failed to update resource. Please try again.',
                    action: 'user resource update'
                });
            }
        },
        [SystemRole.USER]
    ),

    // Action to delete a resource
    deleteResource: restrict(
        async (event: AuthenticatedEvent) => {
            const { params, locals } = event;

            if (!locals.user) {
                throw error(401, 'Unauthorized');
            }
            const { id } = params;
            if (!id) {
                throw error(400, 'Missing resource id');
            }
            
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
                
                // Delete the file from cloud storage first
                if (resource.path) {
                    try {
                        await deleteFileFromCloudStorage(resource.path);
                        logger.info(`Successfully deleted file from cloud storage: ${resource.path}`);
                    } catch (error) {
                        logger.error(`Failed to delete file from cloud storage: ${error}`);
                        // Continue with database deletion even if file deletion fails
                    }
                }

                // Delete the resource from database
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
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                })
                
                // Return success
                return {
                    success: true,
                    message: 'Resource deleted successfully'
                };
            } catch (err) {
                logger.error(`Error deleting resource ${id}:`, err as Record<string, any>);
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
    async (event: AuthenticatedLoadEvent) => {
        const { params, locals, depends } = event;

        depends('app:resource');

        if (!locals.user) {
            throw error(401, 'Unauthorized');
        }
        const { id } = params;
        if (!id) {
            throw error(400, 'Missing resource id');
        }
        
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
            
            let creator = null;
            let updater = null;
            if (resource) {
                creator = await locals.prisma.user.findUnique({
                    where: { id: resource.createdBy },
                    select: { id: true, name: true, email: true }
                });
                if (resource.updatedBy) {
                    updater = await locals.prisma.user.findUnique({
                        where: { id: resource.updatedBy },
                        select: { id: true, name: true, email: true }
                    });
                }
            }

            if (!resource) {
                throw error(404, 'Resource not found');
            }
            
            // Check if the user has access to this resource
            // User can access if they belong to the account that owns the resource
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: resource.accountId,
                    userId: locals.user.id,
                    role: { not: 'SYSTEM' }
                }
            });
            
            if (!hasAccess) {
                throw error(403, 'You do not have permission to view this resource');
            }

            const form = await superValidate(zod(resourceSchemaWithTarget));

            // Populate form with existing resource data
            form.data = {
                name: resource.name,
                description: resource.description || '',
                type: resource.type,
                target: resource.target || '',
                version: resource.version || '1.0.0',
                versionCode: resource.versionCode ?? null,
                signature: resource.signature ?? null,
                releaseType: resource.releaseType || 'Production',
                format: resource.format || '',
                packageName: resource.packageName || '',
                path: resource.path,
                size: resource.size,
                accountId: resource.accountId || '',
                file: null // Don't populate file field for editing
            };

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            
            return {
                form,
                accounts,
                resource: {
                    ...resource,
                    creator,
                    updater
                },
                userId: locals.user.id, // Pass the user ID for permission checks
                meta: {
                    title: `Resource: ${resource.name}`,
                    description: `Viewing details for resource ${resource.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading resource ${id}:${err}`);
            throw error(500, 'Failed to load resource');
        }
    },
    [SystemRole.USER]
);
