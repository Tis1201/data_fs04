import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * Load organization details
 */
export const load = restrictAccountRole(
    async ({ params, cookies, locals, accountMembership }: AccountAuthenticatedEvent & { params: { id: string } }) => {
        const { accountId } = accountMembership;
        const { id } = params;

        try {
            const organization = await prisma.company.findFirst({
                where: { id, accountId },
                include: {
                    devices: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    _count: {
                        select: { devices: true }
                    }
                }
            });

            if (!organization) {
                throw error(404, 'Organization not found');
            }

            // Get current account info
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { id: true, name: true }
            });

            return {
                organization: {
                    id: organization.id,
                    name: organization.name,
                    contactEmail: organization.contactEmail,
                    contactPhone: organization.contactPhone,
                    address: organization.address,
                    description: organization.description,
                    status: organization.status,
                    createdAt: organization.createdAt.toISOString(),
                    updatedAt: organization.updatedAt.toISOString(),
                    totalDevices: organization._count.devices
                },
                currentAccountId: accountId,
                currentAccount: account
            };
        } catch (err: any) {
            if (err?.status === 404) throw err;
            logger.error('Error loading organization:', err as Record<string, any>);
            throw error(500, 'Failed to load organization');
        }
    },
    ['ADMIN', 'OWNER', 'MEMBER']
) satisfies PageServerLoad;

/**
 * Actions for detail page
 */
export const actions: Actions = {
    /**
     * Update organization profile
     */
    update: restrictAccountRole(
        async ({ request, params, locals, accountMembership }: AccountAuthenticatedEvent & { params: { id: string } }) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;
            const { id } = params;

            const formData = await request.formData();
            const name = (formData.get('name') as string)?.trim();
            const contactEmail = (formData.get('contactEmail') as string)?.trim();
            const contactPhone = (formData.get('contactPhone') as string)?.trim() || null;
            const address = (formData.get('address') as string)?.trim() || null;
            const description = (formData.get('description') as string)?.trim() || null;

            if (!name) {
                return fail(400, { error: 'Organization name is required' });
            }
            if (!contactEmail) {
                return fail(400, { error: 'Contact email is required' });
            }

            try {
                const existing = await prisma.company.findFirst({
                    where: { id, accountId }
                });

                if (!existing) {
                    return fail(404, { error: 'Organization not found' });
                }

                const updated = await prisma.company.update({
                    where: { id },
                    data: {
                        name,
                        contactEmail,
                        contactPhone,
                        address,
                        description
                    }
                });

                logger.info(`Organization updated: ${id}`, { userId, accountId });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Company',
                    recordId: id,
                    oldData: existing,
                    newData: updated,
                    userId: userId || 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma
                });

                return { type: 'success', message: 'Profile updated successfully!' };
            } catch (err) {
                logger.error('Error updating organization:', err as Record<string, any>);
                return fail(500, { error: 'Failed to update organization' });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Toggle status
     */
    toggleStatus: restrictAccountRole(
        async ({ request, params, locals, accountMembership }: AccountAuthenticatedEvent & { params: { id: string } }) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;
            const { id } = params;

            const formData = await request.formData();
            const newStatus = formData.get('status') as string;

            if (!newStatus) {
                return fail(400, { error: 'Status is required' });
            }

            try {
                const existing = await prisma.company.findFirst({
                    where: { id, accountId }
                });

                if (!existing) {
                    return fail(404, { error: 'Organization not found' });
                }

                const updated = await prisma.company.update({
                    where: { id },
                    data: { status: newStatus }
                });

                const action = newStatus === 'ACTIVE' ? 'reactivated' : 'deactivated';
                logger.info(`Organization ${action}: ${id}`, { userId, accountId });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Company',
                    recordId: id,
                    oldData: existing,
                    newData: updated,
                    userId: userId || 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma,
                    changeSummary: `Organization ${action}`
                });

                return { type: 'success', message: `Organization ${action} successfully!` };
            } catch (err) {
                logger.error('Error toggling status:', err as Record<string, any>);
                return fail(500, { error: 'Failed to update organization status' });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Delete organization
     */
    delete: restrictAccountRole(
        async ({ request, params, locals, accountMembership }: AccountAuthenticatedEvent & { params: { id: string } }) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;
            const { id } = params;

            try {
                const existing = await prisma.company.findFirst({
                    where: { id, accountId }
                });

                if (!existing) {
                    return fail(404, { error: 'Organization not found' });
                }

                await prisma.company.delete({ where: { id } });

                logger.info(`Organization deleted: ${id}`, { userId, accountId });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Company',
                    recordId: id,
                    oldData: existing,
                    newData: null,
                    userId: userId || 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma
                });

                // Redirect back to listing after delete
                throw redirect(303, '/user/settings/organizations');
            } catch (err: any) {
                if (err?.status === 303) throw err;
                logger.error('Error deleting organization:', err as Record<string, any>);
                return fail(500, { error: 'Failed to delete organization' });
            }
        },
        ['ADMIN', 'OWNER']
    )
};
