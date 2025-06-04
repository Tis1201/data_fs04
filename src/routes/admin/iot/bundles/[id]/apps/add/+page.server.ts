import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

// Schema for adding an app to a bundle
const bundleAppSchema = z.object({
    resourceId: z.string().min(1, 'Resource ID is required'),
    order: z.number().int().positive('Order must be a positive integer'),
    autoOpen: z.boolean().default(false)
});

// Schema for resource search
const resourceSearchSchema = z.object({
    query: z.string().optional().default(''),
    type: z.string().optional().default('APK'),
    limit: z.number().int().min(1).max(100).optional().default(20)
});

export const load = restrict(
    async ({ params, url, locals, request }) => {
        const { id: bundleId } = params;
        const isJsonRequest = request.headers.get('accept')?.includes('application/json');
        
        try {
            // Get the bundle
            const bundle = await locals.prisma.bundle.findUnique({
                where: { id: bundleId },
                include: {
                    apps: {
                        include: {
                            resource: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: {
                            order: 'asc'
                        }
                    }
                }
            });
            
            if (!bundle) {
                throw error(404, 'Bundle not found');
            }
            
            // Parse search parameters
            const searchQuery = url.searchParams.get('query') || '';
            const resourceType = url.searchParams.get('type') || 'APK';
            const limit = parseInt(url.searchParams.get('limit') || '20');
            
            const searchParams = resourceSearchSchema.parse({
                query: searchQuery,
                type: resourceType,
                limit
            });
            
            // Build the where clause for resource search
            const where: any = {
                type: searchParams.type
            };
            
            if (searchParams.query) {
                // Use contains without mode parameter for compatibility
                where.OR = [
                    { name: { contains: searchParams.query } },
                    { description: { contains: searchParams.query } },
                    { packageName: { contains: searchParams.query } }
                ];
            }
            
            // Get resources that are not already in the bundle
            const existingResourceIds = bundle.apps.map(app => app.resourceId);
            if (existingResourceIds.length > 0) {
                where.id = { notIn: existingResourceIds };
            }
            
            // Execute the search
            const resources = await locals.prisma.resource.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                    size: true,
                    format: true,
                    packageName: true,
                    target: true,
                    type: true
                },
                orderBy: {
                    name: 'asc'
                },
                take: searchParams.limit
            });
            
            // Get total count for pagination
            const totalCount = await locals.prisma.resource.count({ where });
            
            // If this is a JSON request (from fetch), return just the resources
            if (isJsonRequest) {
                return { resources };
            }
            
            // Create a form with the bundle app schema
            const form = await superValidate(zod(bundleAppSchema));
            
            // Calculate next order number
            const nextOrder = bundle.apps.length > 0
                ? Math.max(...bundle.apps.map(app => app.order)) + 1
                : 1;
            
            // Set default values
            form.data.order = nextOrder;
            form.data.autoOpen = false;
            
            // Return full page data for normal page loads
            return {
                bundle,
                resources,
                form,
                search: {
                    query: searchParams.query,
                    type: searchParams.type,
                    total: totalCount,
                    hasMore: totalCount > resources.length
                },
                meta: {
                    title: `Add App to Bundle: ${bundle.name}`,
                    description: `Add an app to the bundle ${bundle.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading bundle app add page: ${err instanceof Error ? err.message : String(err)}`);
            throw error(500, 'Failed to load bundle app add page');
        }
    },
    [SystemRole.ADMIN]
);

export const actions: Actions = {
    default: restrict(
        async ({ request, params, locals }) => {
            const { id: bundleId } = params;
            
            // Validate form data
            const form = await superValidate(request, zod(bundleAppSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get authenticated user info for audit fields
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { form, message: 'Authentication required' });
                }
                
                const userInfo = await locals.prisma.user.findUnique({
                    where: { id: auth.user.userId },
                    select: { id: true }
                });
                
                if (!userInfo) {
                    return fail(404, { form, message: 'User not found' });
                }
                
                // Check if bundle exists
                const bundle = await locals.prisma.bundle.findUnique({
                    where: { id: bundleId }
                });
                
                if (!bundle) {
                    return fail(404, { form, message: 'Bundle not found' });
                }
                
                // Check if resource exists
                const resource = await locals.prisma.resource.findUnique({
                    where: { id: form.data.resourceId }
                });
                
                if (!resource) {
                    return fail(404, { form, message: 'Resource not found' });
                }
                
                // Check if the app is already in the bundle
                const existingApp = await locals.prisma.bundleApp.findFirst({
                    where: {
                        bundleId,
                        resourceId: form.data.resourceId
                    }
                });
                
                if (existingApp) {
                    form.message = 'App already added to this bundle';
                    return fail(400, { form });
                }
                
                // Create the bundle app
                await locals.prisma.bundleApp.create({
                    data: {
                        bundleId,
                        resourceId: form.data.resourceId,
                        order: form.data.order,
                        autoOpen: form.data.autoOpen,
                        createdBy: userInfo.id,
                        updatedBy: userInfo.id
                    }
                });
                
                logger.info(`Added app to bundle: ${bundleId}, resourceId: ${form.data.resourceId}`);
                
                return { form, success: true };
            } catch (err) {
                logger.error(`Error adding app to bundle: ${err instanceof Error ? err.message : String(err)}`);
                return fail(500, { form, message: 'Failed to add app to bundle' });
            }
        },
        [SystemRole.ADMIN]
    )
};