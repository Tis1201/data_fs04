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
 * POST /user/iot/device_tags - Create a Device Tag
 * DELETE /user/iot/device_tags - Delete a Device Tag
 */

// Handle POST requests to create a Device Tag
export const POST = restrict(
    async ({ request, locals }: AuthenticatedEvent) => {
        try {
            const { prisma } = locals;
            const formData = await request.formData();
            const name = formData.get('name')?.toString()?.trim() || '';
            const description = formData.get('description')?.toString()?.trim() || '';

            if (!name) {
                return json({ success: false, error: 'Tag name is required' }, { status: 400 });
            }

            const currentAccount = (locals as any).currentAccount?.account;
            if (!currentAccount?.id) {
                return json({ success: false, error: 'No account selected' }, { status: 400 });
            }

            const accountId = currentAccount.id;

            // Check for existing tag with same name
            const existingTag = await prisma.deviceTag.findFirst({
                where: {
                    accountId,
                    name: { equals: name, mode: 'insensitive' }
                }
            });

            if (existingTag) {
                return json({ success: false, error: 'A tag with this name already exists' }, { status: 409 });
            }

            // Create the tag
            const deviceTag = await prisma.deviceTag.create({
                data: {
                    name,
                    description: description || null,
                    accountId
                }
            });

            logger.info(`Device Tag created: ${deviceTag.id} by user ${locals.user?.id}`);

            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'DeviceTag',
                recordId: deviceTag.id,
                oldData: null,
                newData: deviceTag,
                userId: locals.user?.id ?? 'system',
                ipAddress: (locals as any).ipAddress,
                prisma: prisma
            });

            return json({ success: true, tag: deviceTag });
        } catch (err: any) {
            logger.error(`Error creating Device Tag: ${JSON.stringify(err)}`);
            return json({ success: false, error: 'Failed to create tag. Please try again.' }, { status: 500 });
        }
    },
    [SystemRole.USER]
);

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

            // Get current account ID
            const currentAccount = (locals as any).currentAccount?.account;
            if (!currentAccount?.id) {
                throw error(400, 'No account selected');
            }
            const accountId = currentAccount.id;
            
            // Check if Device Tag exists and belongs to current account
            const deviceTag = await prisma.deviceTag.findFirst({
                where: { id, accountId }
            });
            
            if (!deviceTag) {
                throw error(404, 'Device Tag not found');
            }
            
            // Delete the Device Tag (with accountId filter for defense-in-depth)
            await prisma.deviceTag.delete({
                where: { id, accountId }
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

export { fallback as GET, fallback as PUT, fallback as HEAD, fallback as OPTIONS };
