import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	canAccessResourceFields,
	getResourceAccessLevelFields,
	normalizeResourceAccessInput,
	resourceVisibilityOrForAccount
} from '$lib/server/api/unifiedEndpoint';
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
import prisma from '$lib/server/prisma';

const resourceSchemaWithTarget = resourceSchema.extend({
    target: z.string().optional().nullable().default('')
});

function resourceAccessParams(
	locals: {
		user?: { id: string; systemRole: string } | null;
		currentAccount?: { account?: { id: string } } | null;
	},
	cookies?: { get: (name: string) => string | undefined }
) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	const accountId =
		locals.currentAccount?.account?.id ?? cookies?.get('current_account_id') ?? undefined;
	return {
		systemRole: locals.user.systemRole as import('$lib/server/features/flags').SystemRole,
		userId: locals.user.id,
		accountId
	};
}

function isSharedReadResource(
	locals: {
		user?: { id: string; systemRole: string } | null;
		currentAccount?: { account?: { id: string } } | null;
	},
	cookies: { get: (name: string) => string | undefined } | undefined,
	row: Record<string, unknown>
): boolean {
	if (!locals.user) return false;
	const p = {
		systemRole: locals.user.systemRole as import('$lib/server/features/flags').SystemRole,
		userId: locals.user.id,
		accountId: locals.currentAccount?.account?.id ?? cookies?.get('current_account_id') ?? undefined
	};
	return getResourceAccessLevelFields(p, normalizeResourceAccessInput(row)) === 'shared_read';
}

// Define actions for this route
export const actions: Actions = {
    // Action to update a resource
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals, cookies } = event;

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
                existingResource = await prisma.resource.findUnique({
                    where: { id },
                    include: { sharedWithAccounts: { select: { accountId: true } } } as any
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

                if (isSharedReadResource(locals, cookies, existingResource as Record<string, unknown>)) {
                    return message(
                        form,
                        createErrorResponse(
                            'Permission denied',
                            'FORBIDDEN',
                            { details: 'You cannot edit resources shared to your account.' }
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
            const { params, locals, cookies } = event;

            if (!locals.user) {
                throw error(401, 'Unauthorized');
            }
            const { id } = params;
            if (!id) {
                throw error(400, 'Missing resource id');
            }

            try {
                // Check if the resource exists and the user has permission to delete it
                const resource = await prisma.resource.findUnique({
                    where: { id },
                    include: { sharedWithAccounts: { select: { accountId: true } } } as any
                });
                
                // If resource doesn't exist, return an error
                if (!resource) {
                    return fail(404, {
                        success: false,
                        message: 'Resource not found'
                    });
                }

                if (isSharedReadResource(locals, cookies, resource as Record<string, unknown>)) {
                    return fail(403, {
                        success: false,
                        message: 'You cannot delete resources shared to your account'
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

                // BundleApp uses onDelete: SetNull - resource can be deleted; bundles will show snapshot + "Resource deleted"
                
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
            } catch (err: unknown) {
                logger.error(`Error deleting resource ${id}:`, err as Record<string, unknown>);
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
        const { params, locals, depends, cookies } = event;

        depends('app:resource');

        if (!locals.user) {
            throw error(401, 'Unauthorized');
        }
        const { id } = params;
        if (!id) {
            throw error(400, 'Missing resource id');
        }

        const currentAccountId =
            locals.currentAccount?.account?.id ?? cookies.get('current_account_id') ?? undefined;

        try {
            // Unenhanced Prisma: ZenStack denies non-admins from reading `ResourceAccountShare` rows, so
            // `findUnique` with `include: sharedWithAccounts` on enhanced `locals.prisma` returns null
            // for catalog resources. App-level checks below enforce access.
            //
            // When the user has a current account, use the same visibility predicate as the list page
            // (`resourceVisibilityOrForAccount`) so a removed share (no join row) cannot still load by URL.
            const includeBlock = {
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                sharedWithAccounts: { select: { accountId: true } }
            } as const;

            const resource = currentAccountId
                ? await prisma.resource.findFirst({
                        where: {
                            id,
                            AND: [{ OR: resourceVisibilityOrForAccount(currentAccountId) }]
                        },
                        include: includeBlock as any
                    })
                : await prisma.resource.findUnique({
                        where: { id },
                        include: includeBlock as any
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

            const accessParams = resourceAccessParams(locals, cookies);
            const accessInput = normalizeResourceAccessInput(resource as Record<string, unknown>);
            if (!canAccessResourceFields(accessParams, accessInput)) {
                throw error(403, 'You do not have permission to view this resource');
            }

            const accessLevel = getResourceAccessLevelFields(accessParams, accessInput)!;
            const sharedRead = accessLevel === 'shared_read';

            const { sharedWithAccounts: _sw, ...resourceWithoutShares } = resource as typeof resource & {
                sharedWithAccounts?: unknown;
            };

            const resourceForPage: Record<string, unknown> = {
                ...resourceWithoutShares,
                access: accessLevel
            };
            if (sharedRead) {
                delete resourceForPage.path;
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
                path: sharedRead ? '' : resource.path,
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
                    ...resourceForPage,
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
            if (err && typeof err === 'object' && 'status' in err) {
                throw err;
            }
            logger.error(`Error loading resource ${id}:${err}`);
            throw error(500, 'Failed to load resource');
        }
    },
    [SystemRole.USER]
);
