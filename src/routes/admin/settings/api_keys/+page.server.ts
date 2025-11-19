import type { PageServerLoad } from './$types';
import type { ApiKey } from '@prisma/client';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { generateId } from 'lucia';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

// Define table options for API Keys
const table_options = {
    modelName: 'apiKey',
    searchableFields: ['name', 'description'],
    allowedFilters: ['statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'statuses': { field: 'active', operator: 'in' }
    },
    // Define columns to display in the table
    columns: [
        {
            id: 'name',
            label: 'Name',
            sortable: true,
            width: '30%'
        },
        {
            id: 'description',
            label: 'Description',
            sortable: true,
            width: '30%'
        },
        {
            id: 'active',
            label: 'Status',
            sortable: true,
            width: '15%'
        },
        {
            id: 'expiresAt',
            label: 'Expires',
            sortable: true,
            width: '15%'
        },
        {
            id: 'lastUsedAt',
            label: 'Last Used',
            sortable: true,
            width: '15%'
        },
        {
            id: 'actions',
            label: 'Actions',
            width: '15%'
        }
    ],
    // Specify which fields to fetch from the database
    select: {
        id: true,
        name: true,
        description: true,
        active: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        key: true
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        // Log the records being returned
        console.log('API Keys returned:', result.records);
        
        return {
            apiKeys: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Create
     ******************************************************************************************/
    create: restrict(
        async ({ request, locals }) => {
            const schema = z.object({
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                expiresAt: z.string().optional().transform((val) => {
                    if (!val) return null;
                    return new Date(val);
                }),
            });

            const form = await superValidate(request, zod(schema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { name, description, expiresAt } = form.data;

                const userId = locals.auth.validate()?.user?.id || '';

                // Check if user already has 10 or more API keys
                const existingKeysCount = await locals.prisma.apiKey.count({
                    where: { userId }
                });

                if (existingKeysCount >= 10) {
                    return fail(400, {
                        form,
                        error: 'You have reached the maximum limit of 10 API keys. Please delete some keys before creating new ones.'
                    });
                }

                // Generate a new API key
                const apiKey = await locals.prisma.apiKey.create({
                    data: {
                        name,
                        description,
                        expiresAt,
                        userId,
                        active: true,
                        key: generateId(32) // Generate a new 32-character key
                    }
                });

                logger.info('API key created successfully:', { apiKeyId: apiKey.id });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'ApiKey',
                    recordId: apiKey.id,
                    oldData: null,
                    newData: apiKey,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { 
                    form,
                    success: true,
                    apiKey: apiKey.key // Return the actual key only once
                };
            } catch (e) {
                logger.error('Error creating API key:', e);
                return fail(500, {
                    form,
                    error: "Failed to create API key"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create API keys
    ),
    
    /*******************************************************************************************
     * Toggle Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const active = data.get('active')?.toString() === 'true';
                
                if (!id) {
                    return fail(400, { error: 'API key ID is required' });
                }
                
                // Get the API key to be updated
                const apiKey = await locals.prisma.apiKey.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        active: true,
                        userId: true
                    }
                });

                if (!apiKey) {
                    return fail(404, { error: 'API key not found' });
                }

                // Check if the user is trying to deactivate their own API key
                const auth = await locals.auth.validate();
                if (auth?.user?.id === apiKey.userId && !active) {
                    return fail(400, {
                        error: 'You cannot deactivate your own API key'
                    });
                }

                // Update the API key status
                await locals.prisma.apiKey.update({
                    where: { id },
                    data: { active }
                });

                logger.info(`API key ${id} status changed to ${active ? 'active' : 'inactive'}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ApiKey',
                    recordId: id,
                    oldData: { active: !active },
                    newData: { active },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling API key status: ${err}`);
                return fail(500, { error: 'Failed to update API key status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle API key status
    ),

    /*******************************************************************************************
     * Regenerate
     ******************************************************************************************/
    regenerate: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'API key ID is required' });
                }
                
                // Get the API key to be regenerated
                const apiKey = await locals.prisma.apiKey.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        userId: true,
                        key: true,
                        lastUsedAt: true
                    }
                });

                if (!apiKey) {
                    return fail(404, { error: 'API key not found' });
                }

                // Check if the user has permission to regenerate
                const auth = await locals.auth.validate();
                if (auth?.user?.id !== apiKey.userId && auth?.user?.systemRole !== SystemRole.ADMIN) {
                    return fail(403, {
                        error: 'You do not have permission to regenerate this API key'
                    });
                }

                // Generate a new key and update
                const newApiKey = await locals.prisma.apiKey.update({
                    where: { id },
                    data: {
                        key: generateId(32), // Generate a new 32-character key
                        lastUsedAt: null // Reset last used time
                    }
                });

                logger.info(`API key ${id} regenerated successfully`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ApiKey',
                    recordId: id,
                    oldData: { key: apiKey.key, lastUsedAt: apiKey.lastUsedAt },
                    newData: { key: newApiKey.key, lastUsedAt: newApiKey.lastUsedAt },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return {
                    success: true,
                    apiKey: newApiKey.key // Return the new key
                };
            } catch (err) {
                logger.error('Error regenerating API key:', err);
                return fail(500, { error: 'Failed to regenerate API key' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to regenerate API keys
    ),
    
    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    delete: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'API key ID is required' });
                }
                
                // Get the API key to be deleted
                const apiKey = await locals.prisma.apiKey.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        userId: true
                    }
                });

                if (!apiKey) {
                    return fail(404, { error: 'API key not found' });
                }

                // Check if the user is trying to delete their own API key
                const auth = await locals.auth.validate();
                if (auth?.user?.id === apiKey.userId) {
                    return fail(400, {
                        error: 'You cannot delete your own API key'
                    });
                }

                // Delete the API key
                await locals.prisma.apiKey.delete({
                    where: { id }
                });

                logger.info('API key deleted successfully:', { apiKeyId: id });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'ApiKey',
                    recordId: id,
                    oldData: apiKey,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return {
                    success: true,
                    message: 'API key deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting API key:', e);
                if (e.code === 'P2025') {
                    return fail(404, {
                        error: 'API key not found'
                    });
                }
                return fail(500, {
                    error: 'Failed to delete API key'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete API keys
    )
};
