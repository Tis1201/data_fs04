import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * Device Tags API Endpoint
 * 
 * DELETE /admin/iot/factory_tokens - Delete a Device Tag
 */

// Handle DELETE requests to delete a Device Tag
export const DELETE = restrict(
    async ({ request, locals }: AuthenticatedEvent) => {
        try {
            const { prisma } = locals;
            const data = await request.json();
            const { id } = data;
            
            if (!id) {
                throw error(400, 'Device Tag ID is required');
            }
            
            // Check if Device Tag exists
            const deviceTag = await prisma.deviceTag.findUnique({
                where: { id }
            });
            
            if (!deviceTag) {
                throw error(404, 'Device Tag not found');
            }
            
            // Delete the Device Tag
            await prisma.deviceTag.delete({
                where: { id }
            });
            
            logger.info(`Device Tag deleted: ${id}`);

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'DeviceTag',
                recordId: id,
                oldData: deviceTag,
                newData: null,
                userId: locals.user?.id ?? 'system',
                ipAddress: locals.requestContext?.ip,
                prisma: prisma
            })
            
            return json({
                success: true
            });
            
        } catch (err: any) {
            logger.error(`Error deleting Device Tag: ${JSON.stringify(err)}`);
            
            if (err.code === 'P2025') {
                throw error(404, 'Device Tag not found');
            }
            
            throw error(500, 'Failed to delete Device Tag');
        }
    },
    [SystemRole.USER] // Restrict to users only
);

// Handle unsupported HTTP methods
const fallback: RequestHandler = async ({ request }) => {
    throw error(405, `Method ${request.method} not allowed`);
};

export { fallback as GET, fallback as POST, fallback as PUT, fallback as HEAD, fallback as OPTIONS };
