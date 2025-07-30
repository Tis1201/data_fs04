import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { restrict } from '$lib/server/security/guards';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * Factory Tokens API Endpoint
 * 
 * DELETE /admin/iot/factory_tokens - Delete a factory token
 */

// Handle DELETE requests to delete a factory token
export const DELETE = restrict(
    async ({ request, locals }) => {
        try {
            const { prisma } = locals;
            const data = await request.json();
            const { id } = data;
            
            if (!id) {
                throw error(400, 'Factory token ID is required');
            }
            
            // Check if factory token exists
            const factoryToken = await prisma.factoryToken.findUnique({
                where: { id }
            });
            
            if (!factoryToken) {
                throw error(404, 'Factory token not found');
            }
            
            // Delete the factory token
            await prisma.factoryToken.delete({
                where: { id }
            });
            
            logger.info(`Factory token deleted: ${id}`);

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'FactoryToken',
                recordId: id,
                oldData: factoryToken,
                newData: null,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: prisma
            })
            
            return json({
                success: true
            });
            
        } catch (err: any) {
            logger.error(`Error deleting factory token: ${JSON.stringify(err)}`);
            
            if (err.code === 'P2025') {
                throw error(404, 'Factory token not found');
            }
            
            throw error(500, 'Failed to delete factory token');
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users only
);

// Handle PATCH requests to update factory token status
export const PATCH = restrict(
    async ({ request, locals }) => {
        try {
            const { prisma } = locals;
            const data = await request.json();
            const { id, isUsed } = data;
            
            if (!id) {
                throw error(400, 'Factory token ID is required');
            }
            
            if (isUsed === undefined) {
                throw error(400, 'isUsed status is required');
            }
            
            // Check if factory token exists
            const factoryToken = await prisma.factoryToken.findUnique({
                where: { id }
            });
            
            if (!factoryToken) {
                throw error(404, 'Factory token not found');
            }
            
            // Get the authenticated user
            const auth = await locals.auth.validate();
            if (!auth) {
                throw error(401, 'Unauthorized');
            }
            
            // Update the factory token status
            const updatedToken = await prisma.factoryToken.update({
                where: { id },
                data: {
                    isUsed: isUsed === true,
                    updatedBy: auth.user.userId
                }
            });
            
            logger.info(`Factory token status updated: ${id}, isUsed: ${isUsed}`);

            await logAudit({
                actionType: AuditActionType.UPDATE,
                tableName: 'FactoryToken',
                recordId: id,
                oldData: factoryToken,
                newData: updatedToken,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: prisma
            })
            
            return json({
                success: true,
                data: updatedToken
            });
            
        } catch (err: any) {
            logger.error(`Error updating factory token status: ${JSON.stringify(err)}`);
            
            if (err.code === 'P2025') {
                throw error(404, 'Factory token not found');
            }
            
            throw error(500, 'Failed to update factory token status');
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users only
);

// Handle unsupported HTTP methods
const fallback: RequestHandler = async ({ request }) => {
    throw error(405, `Method ${request.method} not allowed`);
};

export { fallback as GET, fallback as POST, fallback as PUT, fallback as HEAD, fallback as OPTIONS };
