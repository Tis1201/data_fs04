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

export const load = restrict(
    async ({ url, locals }) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const keyTypes = url.searchParams.get('keyTypes')?.split(',').filter(Boolean) || [];
            const isActive = url.searchParams.get('isActive') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { keyId: { contains: search } },
                    { id: { contains: search } }
                ];
            }
            
            // Add keyType filter if provided
            if (keyTypes.length > 0) {
                where.keyType = { in: keyTypes };
            }
            
            // Add active filter if provided
            const activeFilters = isActive ? isActive.split(',') : [];
            if (activeFilters.length > 0) {
                // If both true and false are selected, don't filter by isActive
                if (!(activeFilters.includes('true') && activeFilters.includes('false'))) {
                    where.isActive = activeFilters.includes('true');
                }
            }

            // Query JWT signing keys with filtering, sorting, and pagination
            const [jwtSigningKeys, totalKeys] = await Promise.all([
                locals.prisma.jwtSigningKey.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        keyId: true,
                        keyType: true,
                        algorithm: true,
                        isActive: true,
                        isPrimary: true,
                        rotatedAt: true,
                        expiresAt: true,
                        createdAt: true,
                        updatedAt: true,
                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }),
                locals.prisma.jwtSigningKey.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalKeys / perPage);
                
            // Get all key types for filtering
            const keyTypeOptions = [
                { id: 'RUNTIME', name: 'Runtime' },
                { id: 'FACTORY', name: 'Factory' },
                { id: 'INVITATION', name: 'Invitation' }
            ];

            // Return the data
            return {
                jwtSigningKeys,
                keyTypeOptions,
                meta: {
                    totalItems: totalKeys,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    keyTypes: keyTypes,
                    isActive: isActive
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading JWT signing keys: ${err}`);
            const errorResponse = await handleZenstackError({
                error: err,
                defaultMessage: 'Failed to load JWT signing keys',
                prisma: locals.prisma,
                requestId: locals.requestId
            });
            throw error(500, errorResponse.text, { details: errorResponse });
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    deleteSigningKey: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            
            // Create a form object for consistent handling
            const form = {
                id: id || ''
            };

            if (!id) {
                return message(form, createErrorResponse('JWT signing key ID is required'), { status: 400 });
            }

            try {
                // Check if this is the primary key
                const key = await locals.prisma.jwtSigningKey.findUnique({
                    where: { id },
                    select: { isPrimary: true, keyType: true }
                });

                if (key?.isPrimary) {
                    return message(
                        form,
                        createErrorResponse('Cannot delete the primary signing key', 
                        { details: 'Please set another key as primary first.' }),
                        { status: 400 }
                    );
                }

                await locals.prisma.jwtSigningKey.delete({
                    where: { id }
                });

                logger.info(`JWT signing key deleted: ${id}`);
                return message(
                    form,
                    createSuccessResponse('JWT signing key deleted successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to delete JWT signing key',
                    action: 'JWT signing key deletion'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    setPrimary: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            
            // Create a form object for consistent handling
            const form = {
                id: id || ''
            };

            if (!id) {
                return message(form, createErrorResponse('JWT signing key ID is required'), { status: 400 });
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return message(form, createErrorResponse('User not authenticated'), { status: 401 });
                }
                
                // Get the key type for the selected key
                const selectedKey = await locals.prisma.jwtSigningKey.findUnique({
                    where: { id },
                    select: { keyType: true, isActive: true }
                });
                
                if (!selectedKey) {
                    return message(form, createErrorResponse('JWT signing key not found'), { status: 404 });
                }
                
                if (!selectedKey.isActive) {
                    return message(
                        form, 
                        createErrorResponse('Cannot set an inactive key as primary', 
                        { details: 'Please activate the key first.' }),
                        { status: 400 }
                    );
                }
                
                // Update all keys of the same type to not be primary
                await locals.prisma.jwtSigningKey.updateMany({
                    where: { keyType: selectedKey.keyType },
                    data: {
                        isPrimary: false
                    }
                });
                
                // Set the selected key as primary
                await locals.prisma.jwtSigningKey.update({
                    where: { id },
                    data: {
                        isPrimary: true
                    }
                });

                logger.info(`JWT signing key set as primary: ${id}`);
                return message(
                    form,
                    createSuccessResponse('Primary JWT signing key updated successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to set primary JWT signing key',
                    action: 'primary JWT signing key update'
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
                return message(form, createErrorResponse('JWT signing key ID is required'), { status: 400 });
            }

            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return message(form, createErrorResponse('User not authenticated'), { status: 401 });
                }
                
                // Check if this is the primary key and trying to deactivate
                if (!active) {
                    const key = await locals.prisma.jwtSigningKey.findUnique({
                        where: { id },
                        select: { isPrimary: true }
                    });

                    if (key?.isPrimary) {
                        return message(
                            form, 
                            createErrorResponse('Cannot deactivate the primary JWT signing key', 
                            { details: 'Please set another key as primary first.' }),
                            { status: 400 }
                        );
                    }
                }
                
                // Update the key's active status
                const updatedKey = await locals.prisma.jwtSigningKey.update({
                    where: { id },
                    data: {
                        isActive: active
                    },
                    select: {
                        id: true,
                        keyId: true,
                        isActive: true
                    }
                });

                logger.info(`JWT signing key ${active ? 'activated' : 'deactivated'}: ${id}`);
                return message(
                    form,
                    createSuccessResponse(`JWT signing key ${active ? 'activated' : 'deactivated'} successfully`, 
                    { data: updatedKey })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to update JWT signing key status',
                    action: 'JWT signing key status update'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
