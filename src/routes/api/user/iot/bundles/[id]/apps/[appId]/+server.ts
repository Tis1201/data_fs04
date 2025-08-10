import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createSuccessResponse, createErrorResponse } from '$lib/types/api';

export const DELETE: RequestHandler = restrict(
    async ({ params, locals }) => {
        const { id: bundleId, appId } = params;

        try {
            // Check if bundle app exists
            const bundleApp = await locals.prisma.bundleApp.findUnique({
                where: { id: appId }
            });
            
            if (!bundleApp) {
                return json(createErrorResponse('Bundle app not found', {}), { status: 404 });
            }
            
            // Verify that the bundle app belongs to the specified bundle
            if (bundleApp.bundleId !== bundleId) {
                return json(createErrorResponse('Bundle app does not belong to this bundle', {}), { status: 400 });
            }
            
            // Delete the bundle app
            await locals.prisma.bundleApp.delete({
                where: { id: appId }
            });
            
            logger.info(`Removed app from bundle: ${bundleId}, appId: ${appId}`);
            
            return json(createSuccessResponse('App removed from bundle successfully', {}));
        } catch (err) {
            logger.error(`Error removing app from bundle: ${err instanceof Error ? err.message : String(err)}`);
            return json(createErrorResponse('Failed to remove app from bundle', {}), { status: 500 });
        }
    },
    [SystemRole.USER]
);
