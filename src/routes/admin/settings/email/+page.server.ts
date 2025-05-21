import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../users/schema';
import { logger } from '$lib/server/logger';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleZenstackError, handleFormError } from '$lib/server/errors/errorHandlers';
import { EmailService } from '$lib/server/email';

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
                    { name: { contains: search } },
                    { id: { contains: search } },
                    { fromEmail: { contains: search } }
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
            
            // Create a form object for consistent handling
            const form = {
                id: id || ''
            };

            if (!id) {
                return message(form, createErrorResponse('Email provider ID is required'), { status: 400 });
            }

            try {
                // Check if this is the default provider
                const provider = await locals.prisma.emailServiceProvider.findUnique({
                    where: { id },
                    select: { isDefault: true }
                });

                if (provider?.isDefault) {
                    return message(
                        form,
                        createErrorResponse('Cannot delete the default email provider', 
                        { details: 'Please set another provider as default first.' }),
                        { status: 400 }
                    );
                }

                await locals.prisma.emailServiceProvider.delete({
                    where: { id }
                });

                logger.info(`Email provider deleted: ${id}`);
                return message(
                    form,
                    createSuccessResponse('Email provider deleted successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to delete email provider',
                    action: 'email provider deletion'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    setDefault: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            
            // Create a form object for consistent handling
            const form = {
                id: id || ''
            };

            if (!id) {
                return message(form, createErrorResponse('Email provider ID is required'), { status: 400 });
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return message(form, createErrorResponse('User not authenticated'), { status: 401 });
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
                return message(
                    form,
                    createSuccessResponse('Default email provider updated successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to set default email provider',
                    action: 'default email provider update'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    toggleActive: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const active = formData.get('active') === 'true';
            
            // Create a form object for consistent handling
            const form = {
                id: id || '',
                active: active
            };

            if (!id) {
                return message(form, createErrorResponse('Email provider ID is required'), { status: 400 });
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return message(form, createErrorResponse('User not authenticated'), { status: 401 });
                }
                
                // Check if this is the default provider and trying to deactivate
                if (!active) {
                    const provider = await locals.prisma.emailServiceProvider.findUnique({
                        where: { id },
                        select: { isDefault: true }
                    });

                    if (provider?.isDefault) {
                        return message(
                            form, 
                            createErrorResponse('Cannot deactivate the default email provider', 
                            { details: 'Please set another provider as default first.' }),
                            { status: 400 }
                        );
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
                return message(
                    form,
                    createSuccessResponse(`Email provider ${active ? 'activated' : 'deactivated'} successfully`, 
                    { data: updatedProvider })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to update email provider status',
                    action: 'email provider status update'
                });
            }
        },
        [SystemRole.ADMIN]
    ),

    testEmailSend: restrict(
        async ({ request, locals }) => {
            // Define the schema for test email validation
            const testEmailSchema = z.object({
                id: z.string().min(1, 'Email provider ID is required'),
                to: z.string().email('Please enter a valid email address'),
                subject: z.string().min(1, 'Subject is required'),
                message: z.string().min(1, 'Message is required')
            });
            
            // Validate the form data using SuperForm
            const form = await superValidate(request, zod(testEmailSchema));
            
            // If validation fails, return the form with errors
            if (!form.valid) {
                return message(form, createErrorResponse('Please correct the errors in the form'), { status: 400 });
            }
            
            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return message(form, createErrorResponse('User not authenticated'), { status: 401 });
                }
                
                // Find the email provider
                const provider = await locals.prisma.emailServiceProvider.findUnique({
                    where: { id: form.data.id }
                });

                if (!provider) {
                    return message(form, createErrorResponse('Email provider not found'), { status: 404 });
                }

                if (!provider.isActive) {
                    return message(form, createErrorResponse('Cannot send test email with inactive provider'), { status: 400 });
                }

                try {
                    // Create an instance of the EmailService with the provider
                    const emailService = new EmailService(provider);
                    
                    // Send the test email
                    const result = await emailService.sendTestEmail(
                        form.data.to,
                        form.data.subject,
                        form.data.message
                    );
                    
                    if (!result.success) {
                        const errorMessage = result.error instanceof Error 
                            ? result.error.message 
                            : String(result.error);
                        
                        logger.error(`Failed to send test email: ${errorMessage}`);
                        return message(form, createErrorResponse('Failed to send test email', { details: errorMessage }), { status: 500 });
                    }
                    
                    // Email sent successfully
                    logger.info(`Test email sent successfully using provider ${provider.name} (${provider.id}) to ${form.data.to}`);
                    
                    // Update the lastUsedAt and increment totalSent
                    await locals.prisma.emailServiceProvider.update({
                        where: { id: form.data.id },
                        data: {
                            lastUsedAt: new Date(),
                            totalSent: { increment: 1 }
                        }
                    });

                    // Return success response with form data
                    return message(
                        form,
                        createSuccessResponse('Test email sent successfully', {
                            details: `Test email sent successfully to ${form.data.to} using ${provider.name}.`,
                            data: { messageId: result.messageId || 'N/A' }
                        })
                    );
                } catch (error) {
                    // Catch any unexpected errors
                    logger.error(`Unexpected error sending test email:`, { error });
                    
                    return handleFormError({
                        error,
                        form,
                        prisma: locals.prisma,
                        requestId: locals.requestId,
                        defaultMessage: 'Failed to send test email',
                        action: 'test email sending'
                    });
                }
            } catch (err) {
                // Use the handleFormError utility to simplify error handling
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to send test email. Please try again.',
                    action: 'test email sending'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
