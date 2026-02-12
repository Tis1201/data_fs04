import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * Organization row type for the listing table
 */
interface OrganizationRow {
    id: string;
    name: string;
    contactEmail: string | null;
    totalDevices: number;
    address: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    description: string | null;
    contactPhone: string | null;
}

/**
 * Load organizations (companies) for the current account
 */
export const load = restrictAccountRole(
    async ({ url, cookies, locals, accountMembership }: AccountAuthenticatedEvent) => {
        const { accountId } = accountMembership;

        try {
            // Parse query params
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'name';
            const sortOrder = (url.searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build where clause
            const where: any = {
                accountId
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { contactEmail: { contains: search, mode: 'insensitive' } },
                    { address: { contains: search, mode: 'insensitive' } }
                ];
            }

            if (statuses.length > 0) {
                where.status = { in: statuses };
            }

            // Fetch organizations (companies)
            const [organizations, totalOrganizations] = await Promise.all([
                prisma.company.findMany({
                    where,
                    orderBy: { [sortField]: sortOrder },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,
                        contactEmail: true,
                        contactPhone: true,
                        address: true,
                        description: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                        _count: {
                            select: { devices: true }
                        }
                    }
                }),
                prisma.company.count({ where })
            ]);

            const totalPages = Math.ceil(totalOrganizations / perPage);

            // Transform to OrganizationRow
            const rows: OrganizationRow[] = organizations.map(org => ({
                id: org.id,
                name: org.name,
                contactEmail: org.contactEmail,
                totalDevices: org._count.devices,
                address: org.address,
                status: org.status,
                createdAt: org.createdAt.toISOString(),
                updatedAt: org.updatedAt.toISOString(),
                description: org.description,
                contactPhone: org.contactPhone
            }));

            // Get current account info for the form
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { id: true, name: true }
            });

            return {
                organizations: rows,
                currentAccountId: accountId,
                currentAccount: account,
                meta: {
                    totalItems: totalOrganizations,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error('Error loading organizations:', err as Record<string, any>);
            throw error(500, 'Failed to load organizations');
        }
    },
    ['ADMIN', 'OWNER', 'MEMBER']
) satisfies PageServerLoad;

/**
 * Actions for CRUD operations
 */
export const actions: Actions = {
    /**
     * Create a new organization
     */
    create: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

            const formData = await request.formData();
            const name = (formData.get('name') as string)?.trim();
            const contactEmail = (formData.get('contactEmail') as string)?.trim();
            const contactPhone = (formData.get('contactPhone') as string)?.trim() || null;
            const address = (formData.get('address') as string)?.trim() || null;
            const description = (formData.get('description') as string)?.trim() || null;

            // Validation
            if (!name) {
                return fail(400, { error: 'Organization name is required' });
            }
            if (!contactEmail) {
                return fail(400, { error: 'Contact email is required' });
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactEmail)) {
                return fail(400, { error: 'Invalid email format' });
            }

            try {
                const organization = await prisma.company.create({
                    data: {
                        name,
                        contactEmail,
                        contactPhone,
                        address,
                        description,
                        status: 'ACTIVE',
                        accountId
                    }
                });

                logger.info(`Organization created: ${organization.id}`, {
                    userId,
                    accountId,
                    organizationId: organization.id
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Company',
                    recordId: organization.id,
                    oldData: null,
                    newData: organization,
                    userId: userId || 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma
                });

                return { type: 'success', message: 'Organization added successfully!' };
            } catch (err) {
                logger.error('Error creating organization:', err as Record<string, any>);
                return fail(500, { error: 'Failed to create organization' });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Update an existing organization
     */
    update: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

            const formData = await request.formData();
            const id = formData.get('id') as string;
            const name = (formData.get('name') as string)?.trim();
            const contactEmail = (formData.get('contactEmail') as string)?.trim();
            const contactPhone = (formData.get('contactPhone') as string)?.trim() || null;
            const address = (formData.get('address') as string)?.trim() || null;
            const description = (formData.get('description') as string)?.trim() || null;

            if (!id) {
                return fail(400, { error: 'Organization ID is required' });
            }
            if (!name) {
                return fail(400, { error: 'Organization name is required' });
            }
            if (!contactEmail) {
                return fail(400, { error: 'Contact email is required' });
            }

            try {
                // Verify organization belongs to this account
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
     * Toggle organization status (activate/deactivate)
     */
    toggleStatus: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

            const formData = await request.formData();
            const id = formData.get('id') as string;
            const newStatus = formData.get('status') as string;

            if (!id || !newStatus) {
                return fail(400, { error: 'Organization ID and status are required' });
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

                return { 
                    type: 'success', 
                    message: `Organization ${action} successfully!` 
                };
            } catch (err) {
                logger.error('Error toggling organization status:', err as Record<string, any>);
                return fail(500, { error: 'Failed to update organization status' });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Delete an organization
     */
    delete: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

            const formData = await request.formData();
            const id = formData.get('id') as string;

            if (!id) {
                return fail(400, { error: 'Organization ID is required' });
            }

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

                return { type: 'success', message: 'Organization deleted successfully!' };
            } catch (err) {
                logger.error('Error deleting organization:', err as Record<string, any>);
                return fail(500, { error: 'Failed to delete organization' });
            }
        },
        ['ADMIN', 'OWNER']
    )
};
