import { fail, redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { createErrorResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';

/**
 * Create resource actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createResourceActions(options?: {
    checkOwnership?: boolean;
}): {
    update: (args: { params: { id: string }; request: Request; locals: any; auth: any }) => Promise<any>;
    delete: (args: { params: { id: string }; request: Request; locals: any }) => Promise<any>;
} {
    return {
        /**
         * Update resource action
         */
        update: async ({
            params,
            request,
            locals,
            auth
        }: {
            params: { id: string };
            request: Request;
            locals: any;
            auth: any;
        }) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }

            // Import resourceSchema from admin route
            const { resourceSchema } = await import('../../../routes/admin/iot/resources/new/resource');

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
                    where: { id }
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
                    where: { id },
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        type: form.data.type,
                        version: form.data.version,
                        releaseType: form.data.releaseType,
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
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return {
                    type: 'success',
                    status: 200,
                    data: [{ success: 1 }, true]
                };
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

        /**
         * Delete resource action
         * Includes cloud storage cleanup
         */
        delete: async ({
            params,
            request,
            locals
        }: {
            params: { id: string };
            request: Request;
            locals: any;
        }) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }
            try {
            // Get the authenticated user
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return fail(401, { error: 'Unauthorized' });
            }

            // Get the resource first to get the file path and account info for audit
            const resource = await locals.prisma.resource.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            name: true
                        }
                    }
                }
            });

                if (!resource) {
                    return fail(404, { error: 'Resource not found' });
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

                logger.info(`Resource deleted by admin: ${id}`);

                // Log audit trail
                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: id,
                    oldData: resource,
                    newData: null,
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                // Detect if caller expects JSON (e.g., AJAX/dialog)
                const accept = request.headers.get('accept') || '';
                const wantsJson =
                    accept.includes('application/json') ||
                    request.headers.get('x-requested-with') === 'XMLHttpRequest';

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
        }
    };
}

