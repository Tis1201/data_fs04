import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceSchema } from '../new/resource';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

export const load = restrict(
    async (event) => {
        const { params, locals } = event;
        const resourceId = params.id;

        try {
            // Load the resource with account information
            const resource = await locals.prisma.resource.findUnique({
                where: { id: resourceId },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!resource) {
                throw error(404, 'Resource not found');
            }

            // Fetch user information for createdBy and updatedBy
            const [createdByUser, updatedByUser] = await Promise.all([
                locals.prisma.user.findUnique({
                    where: { id: resource.createdBy },
                    select: { email: true }
                }),
                locals.prisma.user.findUnique({
                    where: { id: resource.updatedBy },
                    select: { email: true }
                })
            ]);

            // Get all accounts for admin selection
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Format accounts for dropdown
            let accountOptions = accounts.map(account => ({
                value: account.id,
                label: account.name
            }));

            // Add current account if it's not in the list (e.g., system account)
            if (resource.account && !accountOptions.find(opt => opt.value === resource.accountId)) {
                accountOptions.push({
                    value: resource.accountId,
                    label: resource.account.name
                });
            }

            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' },
                { value: 'binary', label: 'Binary' }
            ];

            // Create form with existing data
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

            // Ensure accountId is properly set for the form
            if (!resource.accountId || resource.accountId === '') {
                form.data.accountId = ''; // System account
            } else {
                form.data.accountId = resource.accountId;
            }

            return {
                resource,
                createdByUser,
                updatedByUser,
                form,
                accountOptions,
                resourceTypes
            };
        } catch (err) {
            logger.error(`Error loading resource detail: ${JSON.stringify(err)}`);
            if (err.status === 404) {
                throw err;
            }
            throw error(500, 'Failed to load resource');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    update: restrict(
        async (event) => {
            const { request, params, locals, auth } = event;
            const resourceId = params.id;

            // Validate the form data
            const form = await superValidate(request, zod(resourceSchema), {
                dataType: 'json'
            });

            // Check if the form is valid
            if (!form.valid) {
                return fail(400, { form });
            }

            // Clean up accountId if it's undefined
            if (form.data.accountId === 'undefined' || form.data.accountId === undefined) {
                form.data.accountId = '';
            }

            // Get the account ID from the form
            let accountId = form.data.accountId;
            let account;
            let accountName = 'Unknown Account';

            // Verify that the account exists
            try {
                if (accountId && accountId !== 'undefined' && accountId.trim() !== '') {
                    logger.debug(`Processing resource update for account ID: ${accountId}`);
                    account = await locals.prisma.account.findUnique({
                        where: { id: accountId }
                    });

                    if (!account) {
                        return message(
                            form,
                            createErrorResponse('Invalid account', {
                                details: `The selected account with ID '${accountId}' does not exist.`
                            })
                        );
                    }
                } else {
                    logger.debug(`Processing resource update for system account (accountId was: ${accountId})`);
                    account = await locals.prisma.account.findFirst({
                        where: { isSystem: true }
                    });

                    if (!account) {
                        logger.error('System account not found in database');
                        return message(
                            form,
                            createErrorResponse('System account not found', {
                                details: 'The system account does not exist. Please run the database seed to create it.'
                            })
                        );
                    }
                }

                accountName = account.name;
                accountId = account.id;
                logger.debug(`Using account: ${accountName} (ID: ${accountId})`);
            } catch (err) {
                logger.error(`Error verifying account: ${JSON.stringify(err)}`);
                return message(
                    form,
                    createErrorResponse('Error verifying account', {
                        details: 'Failed to verify the selected account. Please try again.'
                    })
                );
            }

            try {
                // Get the existing resource to log changes
                const existingResource = await locals.prisma.resource.findUnique({
                    where: { id: resourceId }
                });

                if (!existingResource) {
                    return message(
                        form,
                        createErrorResponse('Resource not found', {
                            details: 'The resource you are trying to update does not exist.'
                        })
                    );
                }

                // Update the resource
                const updatedResource = await locals.prisma.resource.update({
                    where: { id: resourceId },
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        type: form.data.type,
                        target: form.data.target,
                        version: form.data.version,
                        format: form.data.format,
                        packageName: form.data.packageName,
                        path: form.data.path,
                        size: form.data.size,
                        accountId: accountId,
                        updatedBy: auth.user.id
                    }
                });

                logger.info(`Resource updated by admin: ${updatedResource.id}`);

                // Log audit trail
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Resource',
                    recordId: updatedResource.id,
                    oldData: existingResource,
                    newData: updatedResource,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return message(
                    form,
                    createSuccessResponse('Resource updated successfully', {
                        details: `Resource '${updatedResource.name}' has been updated in ${accountName}.`,
                        data: { resourceId: updatedResource.id, accountId: accountId }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId,
                    defaultMessage: 'Failed to update resource. Please try again.',
                    action: 'admin resource update'
                });
            }
        },
        [SystemRole.ADMIN]
    ),

    delete: restrict(
        async (event) => {
            const { params, locals } = event;
            const resourceId = params.id;

            try {
                // Get the resource before deletion for audit logging
                const resource = await locals.prisma.resource.findUnique({
                    where: { id: resourceId },
                    include: {
                        account: {
                            select: {
                                name: true
                            }
                        }
                    }
                });

                if (!resource) {
                    return fail(404, { message: 'Resource not found' });
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
                    where: { id: resourceId }
                });

                logger.info(`Resource deleted by admin: ${resourceId}`);

                // Log audit trail
                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: resourceId,
                    oldData: resource,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                // Detect if caller expects JSON (e.g., AJAX/dialog)
                const accept = event.request.headers.get('accept') || '';
                const wantsJson =
                    accept.includes('application/json') ||
                    event.request.headers.get('x-requested-with') === 'XMLHttpRequest';

                if (wantsJson) {
                    // Return plain success object (serializable)
                    return {
                        type: 'success',
                        status: 200,
                        data: [{ success: 1 }, true]
                    };
                } else {
                    // Regular flow: redirect back to list
                    throw redirect(303, '/admin/iot/resources');
                }
            } catch (err: any) {
                logger.error(`Error deleting resource: ${JSON.stringify(err)}`);
                if (err.status === 303) {
                    throw err; // propagate redirect
                }
                return fail(500, { message: 'Failed to delete resource' });
            }
        },
        [SystemRole.ADMIN]
    )
};
