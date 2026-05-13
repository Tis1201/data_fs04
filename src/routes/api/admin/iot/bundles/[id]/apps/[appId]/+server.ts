import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '$lib/types/api';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const DELETE: RequestHandler = restrict(
    async ({ params, locals, getClientAddress }: any) => {
        const { id: bundleId, appId } = params;

        try {
            // Check if bundle app exists
            const bundleApp = await locals.prisma.bundleApp.findUnique({
                where: { id: appId }
            });
            
            if (!bundleApp) {
                return json(createErrorResponse('Bundle app not found', ErrorCodes.NOT_FOUND), { status: 404 });
            }
            
            // Verify that the bundle app belongs to the specified bundle
            if (bundleApp.bundleId !== bundleId) {
                return json(
                    createErrorResponse(
                        'Bundle app does not belong to this bundle',
                        ErrorCodes.CONFLICT
                    ),
                    { status: 400 }
                );
            }
            
            // Delete the bundle app
            await locals.prisma.bundleApp.delete({
                where: { id: appId }
            });
            
            logger.info(`Removed app from bundle: ${bundleId}, appId: ${appId}`);

            // Get authenticated user for audit log
            const auth = await locals.auth.validate();
            
            // Log audit for bundle app deletion
            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'BundleApp',
                recordId: appId,
                oldData: bundleApp,
                newData: null,
                userId: auth?.user?.id ?? locals.user?.id ?? 'unknown',
                ipAddress: (locals as any).ipAddress || getClientAddress?.() || 'unknown',
                prisma: locals.prisma
            });
            
            return json(createSuccessResponse('App removed from bundle successfully', {}));
        } catch (err) {
            logger.error(`Error removing app from bundle: ${err instanceof Error ? err.message : String(err)}`);
            return json(createErrorResponse('Failed to remove app from bundle', ErrorCodes.INTERNAL_ERROR), { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
