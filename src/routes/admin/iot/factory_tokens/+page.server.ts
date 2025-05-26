import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { factoryTokenSchema } from '$lib/schemas/factory-token';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '../../users/schema';

// Define table options for Factory Tokens
const table_options = {
    modelName: 'factoryToken',
    searchableFields: ['tokenId', 'serialNumber', 'hardwareModel', 'batchNumber'],
    allowedFilters: ['isUsed', 'hardwareModels'],
    defaultSortField: 'issuedAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'isUsed': { 
            field: 'isUsed', 
            operator: 'equals',
            valueTransformer: (value: string) => value === 'true' // Convert string 'true' to boolean true
        },
        'hardwareModels': { field: 'hardwareModel', operator: 'in' }
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
        
        return {
            factoryTokens: result.records,
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
            const form = await superValidate(request, zod(factoryTokenSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { serialNumber, hardwareModel, firmwareVersion, batchNumber, expiresAt, notes } = form.data;

                // Check if token with same serial number already exists
                const existingToken = await locals.prisma.factoryToken.findFirst({
                    where: { serialNumber }
                });

                if (existingToken) {
                    return fail(400, {
                        form,
                        error: "Factory token with this serial number already exists"
                    });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Generate a unique token ID
                const tokenId = crypto.randomUUID();
                
                // Create factory token
                const factoryToken = await locals.prisma.factoryToken.create({
                    data: {
                        tokenId,
                        serialNumber,
                        hardwareModel,
                        firmwareVersion,
                        batchNumber,
                        expiresAt,
                        notes,
                        issuedBy: auth.user.id,
                        issuedAt: new Date()
                    }
                });

                return { 
                    form,
                    success: true
                };
            } catch (e) {
                logger.error(`Error creating factory token: ${JSON.stringify(e)}`);
                return fail(500, {
                    form,
                    error: "Failed to create factory token"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create factory tokens
    ),
    
    /*******************************************************************************************
     * Toggle Used Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async ({ request, locals }) => {
            try {
                // Get the token ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const isUsed = data.get('isUsed') === 'true';
                
                if (!id) {
                    return fail(400, { error: 'Factory token ID is required' });
                }
                
                // Check if factory token exists
                const factoryToken = await locals.prisma.factoryToken.findUnique({
                    where: { id }
                });
                
                if (!factoryToken) {
                    return fail(404, { error: 'Factory token not found' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Update the factory token status
                await locals.prisma.factoryToken.update({
                    where: { id },
                    data: { 
                        isUsed,
                        usedAt: isUsed ? new Date() : null
                    }
                });

                logger.info(`Factory token ${id} status changed to ${isUsed ? 'used' : 'unused'}`);
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling factory token status: ${JSON.stringify(err)}`);
                return fail(500, { error: 'Failed to update factory token status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle factory token status
    ),

    /**
     * Delete factory token
     */
    delete: restrict(
        async ({ request, locals }) => {
            try {
                // Get the factory token ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Factory token ID is required' });
                }
                
                // Check if factory token exists
                const factoryToken = await locals.prisma.factoryToken.findUnique({
                    where: { id }
                });
                
                if (!factoryToken) {
                    return fail(404, { error: 'Factory token not found' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Delete the factory token
                await locals.prisma.factoryToken.delete({
                    where: { id }
                });

                logger.info(`Factory token deleted successfully: ${JSON.stringify({ tokenId: id })}`);
                
                return { success: true };
            } catch (err) {
                logger.error(`Error deleting factory token: ${JSON.stringify(err)}`);
                return fail(500, { error: 'Failed to delete factory token' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete factory tokens
    )
};
