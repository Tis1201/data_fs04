import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getStatusBeforeToggled } from '$lib/utils';

/**
 * Create preclaim actions factory
 * Per structural standard: create{Resource}Actions pattern
 * 
 * Supports both standard Prisma (admin) and enhanced Prisma (user routes with ZenStack)
 */
export function createPreclaimActions(options: {
    checkOwnership?: boolean;
    useEnhancedPrisma?: boolean; // Use enhanced Prisma for user routes
}): {
    toggleStatus: (args: { request: Request; locals: any }) => Promise<any>;
} {
    return {
        /**
         * Toggle preclaim set status action
         * Used by both list pages (admin and user)
         */
        toggleStatus: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                // Get the preclaim set ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();

                if (!id) {
                    return fail(400, { error: 'Preclaim Set ID is required' });
                }

                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Invalid status value' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // For user routes, locals.prisma is already enhanced by middleware
                // For admin routes, use standard Prisma
                const prismaClient = locals.prisma;

                // Check if preclaim set exists
                // For user routes, enhanced Prisma will enforce authorization automatically
                const preclaimSet = await prismaClient.preclaimSet.findFirst({
                    where: { id }
                });

                if (!preclaimSet) {
                    return fail(404, { 
                        error: 'Preclaim Set not found or you do not have permission to modify it' 
                    });
                }

                // Update the preclaim set status
                // For user routes, enhanced Prisma will enforce authorization
                await prismaClient.preclaimSet.update({
                    where: { id },
                    data: {
                        status,
                        updatedAt: new Date()
                    }
                });

                logger.info(`User ${auth.user.id} changed preclaim set ${id} status to ${status}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'PreclaimSet',
                    recordId: id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: auth.user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: prismaClient
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error toggling preclaim set status: ${err}`);
                return fail(500, { error: 'Failed to update preclaim set status' });
            }
        }
    };
}

