import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../users/schema';
import { logger } from '$lib/server/logger';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleZenstackError } from '$lib/server/errors/errorHandlers';

export const load = restrict(
    async ({ url, locals }) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const types = url.searchParams.get('types')?.split(',').filter(Boolean) || [];
            const isActive = url.searchParams.get('isActive') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { fromEmail: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Add type filter if provided
            if (types.length > 0) {
                where.type = { in: types };
            }
            
            // Add active filter if provided
            if (isActive === 'true') {
                where.isActive = true;
            } else if (isActive === 'false') {
                where.isActive = false;
            }

            // Query email providers with filtering, sorting, and pagination
            const [emailProviders, totalProviders] = await Promise.all([
                locals.prisma.emailServiceProvider.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        isDefault: true,
                        isActive: true,
                        fromEmail: true,
                        fromName: true,
                        createdAt: true,
                        updatedAt: true,
                        lastUsedAt: true,
                        totalSent: true
                    }
                }),
                locals.prisma.emailServiceProvider.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalProviders / perPage);
                
            // Get all provider types for filtering
            const providerTypes = [
                { id: 'smtp', name: 'SMTP' },
                { id: 'resend', name: 'Resend' },
                { id: 'sendgrid', name: 'SendGrid' },
                { id: 'mailgun', name: 'Mailgun' },
                { id: 'ses', name: 'AWS SES' },
                { id: 'postmark', name: 'Postmark' }
            ];

            // Return the data
            return {
                emailProviders,
                providerTypes,
                meta: {
                    totalItems: totalProviders,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    types: types,
                    isActive: isActive
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading email providers: ${err}`);
            const errorResponse = await handleZenstackError({
                error: err,
                defaultMessage: 'Failed to load email providers',
                prisma: locals.prisma,
                requestId: locals.requestId
            });
            throw error(500, errorResponse.text, { details: errorResponse });
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    deleteEmailProvider: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, createErrorResponse('Email provider ID is required'));
            }

            try {
                // Check if this is the default provider
                const provider = await locals.prisma.emailServiceProvider.findUnique({
                    where: { id },
                    select: { isDefault: true }
                });

                if (provider?.isDefault) {
                    return fail(400, createErrorResponse(
                        'Cannot delete the default email provider',
                        { details: 'Please set another provider as default first.' }
                    ));
                }

                await locals.prisma.emailServiceProvider.delete({
                    where: { id }
                });

                logger.info(`Email provider deleted: ${id}`);
                return createSuccessResponse('Email provider deleted successfully');
            } catch (err) {
                logger.error('Error deleting email provider:', err);
                const errorResponse = await handleZenstackError({
                    error: err,
                    defaultMessage: 'Failed to delete email provider',
                    prisma: locals.prisma,
                    requestId: locals.requestId
                });
                return fail(500, errorResponse);
            }
        },
        [SystemRole.ADMIN]
    ),
    
    setDefault: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, createErrorResponse('Email provider ID is required'));
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return fail(401, createErrorResponse('User not authenticated'));
                }
                
                // Update all providers to not be default
                await locals.prisma.emailServiceProvider.updateMany({
                    data: {
                        isDefault: false,
                        updatedBy: userId
                    }
                });
                
                // Set the selected provider as default
                await locals.prisma.emailServiceProvider.update({
                    where: { id },
                    data: {
                        isDefault: true,
                        updatedBy: userId
                    }
                });

                logger.info(`Email provider set as default: ${id}`);
                return createSuccessResponse('Default email provider updated successfully');
            } catch (err) {
                logger.error('Error setting default email provider:', err);
                const errorResponse = await handleZenstackError({
                    error: err,
                    defaultMessage: 'Failed to set default email provider',
                    prisma: locals.prisma,
                    requestId: locals.requestId
                });
                return fail(500, errorResponse);
            }
        },
        [SystemRole.ADMIN]
    ),
    
    toggleActive: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const active = formData.get('active') === 'true';

            if (!id) {
                return fail(400, createErrorResponse('Email provider ID is required'));
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return fail(401, createErrorResponse('User not authenticated'));
                }
                
                // Check if this is the default provider and trying to deactivate
                if (!active) {
                    const provider = await locals.prisma.emailServiceProvider.findUnique({
                        where: { id },
                        select: { isDefault: true }
                    });

                    if (provider?.isDefault) {
                        return fail(400, createErrorResponse(
                            'Cannot deactivate the default email provider',
                            { details: 'Please set another provider as default first.' }
                        ));
                    }
                }
                
                // Update the provider's active status
                const updatedProvider = await locals.prisma.emailServiceProvider.update({
                    where: { id },
                    data: {
                        isActive: active,
                        updatedBy: userId
                    },
                    select: {
                        id: true,
                        name: true,
                        isActive: true
                    }
                });

                logger.info(`Email provider ${active ? 'activated' : 'deactivated'}: ${id}`);
                return createSuccessResponse(
                    `Email provider ${active ? 'activated' : 'deactivated'} successfully`,
                    { data: updatedProvider }
                );
            } catch (err) {
                logger.error('Error toggling email provider status:', err);
                const errorResponse = await handleZenstackError({
                    error: err,
                    defaultMessage: 'Failed to update email provider status',
                    prisma: locals.prisma,
                    requestId: locals.requestId
                });
                return fail(500, errorResponse);
            }
        },
        [SystemRole.ADMIN]
    )
};
