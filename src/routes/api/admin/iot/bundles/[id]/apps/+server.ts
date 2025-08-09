import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '$lib/types/api';

// Schema for adding an app to a bundle
const addBundleAppSchema = z.object({
    resourceId: z.string().min(1, 'Resource ID is required'),
    order: z.number().int().positive('Order must be a positive integer'),
    autoOpen: z.boolean().default(false)
});

export const POST: RequestHandler = restrict(
    async ({ params, request, locals }) => {
        const { id: bundleId } = params;

        try {
            // Parse and validate the request body
            const body = await request.json();
            const result = addBundleAppSchema.safeParse(body);
            
            if (!result.success) {
                return json(createErrorResponse('Invalid request data', {
                    errors: result.error.format()
                }), { status: 400 });
            }
            
            const { resourceId, order, autoOpen } = result.data;
            
            // Get authenticated user info for audit fields
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return json(createErrorResponse('Authentication required', {}), { status: 401 });
            }
            
            const userInfo = await locals.prisma.user.findUnique({
                where: { id: auth.user.id },
                select: { id: true }
            });
            
            if (!userInfo) {
                return json(createErrorResponse('User not found', {}), { status: 404 });
            }
            
            // Check if bundle exists
            const bundle = await locals.prisma.bundle.findUnique({
                where: { id: bundleId }
            });
            
            if (!bundle) {
                return json(createErrorResponse('Bundle not found', {}), { status: 404 });
            }
            
            // Check if resource exists
            const resource = await locals.prisma.resource.findUnique({
                where: { id: resourceId }
            });
            
            if (!resource) {
                return json(createErrorResponse('Resource not found', {}), { status: 404 });
            }
            
            // Check if the app is already in the bundle
            const existingApp = await locals.prisma.bundleApp.findFirst({
                where: {
                    bundleId,
                    resourceId
                }
            });
            
            if (existingApp) {
                return json(createErrorResponse('App already added to this bundle', {}), { status: 400 });
            }
            
            // Create the bundle app
            const bundleApp = await locals.prisma.bundleApp.create({
                data: {
                    bundleId,
                    resourceId,
                    order,
                    autoOpen,
                    createdBy: userInfo.id,
                    updatedBy: userInfo.id
                }
            });
            
            logger.info(`Added app to bundle: ${bundleId}, resourceId: ${resourceId}`);
            
            return json(createSuccessResponse('App added to bundle successfully', {
                bundleApp
            }));
        } catch (err) {
            logger.error(`Error adding app to bundle: ${err instanceof Error ? err.message : String(err)}`);
            return json(createErrorResponse('Failed to add app to bundle', {}), { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
