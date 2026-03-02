import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import prisma from '$lib/server/prisma';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';

// Schema for profile editing (Account info)
const profileEditSchema = z.object({
    name: z.string().min(1, 'Account name is required').max(100, 'Name is too long'),
    description: z.string().optional()
});

// Organization row type
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
 * Load profile data including account info and organizations
 */
export const load = restrictAccountRole(
    async ({ url, locals, accountMembership }: AccountAuthenticatedEvent) => {
        const { accountId } = accountMembership;
        const userId = locals.user?.id;

        try {
            // Get user data
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    systemRole: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (!user) {
                throw error(404, 'User not found');
            }

            // Get account details
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (!account) {
                throw error(404, 'Account not found');
            }

            // Parse query params for organizations
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'name';
            const sortOrder = (url.searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build where clause for organizations
            const where: any = { accountId };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { contactEmail: { contains: search, mode: 'insensitive' } },
                    { address: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Fetch organizations
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

            // Initialize the profile edit form
            const form = await superValidate(zod(profileEditSchema), {
                id: 'profile-edit-form',
                defaults: {
                    name: account.name || '',
                    description: account.description || ''
                }
            });

            return {
                user,
                account,
                form,
                organizations: rows,
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
            if (err instanceof Response) {
                throw err;
            }
            logger.error(`Error loading profile: ${err}`);
            throw error(500, 'Failed to load profile');
        }
    },
    ['ADMIN', 'OWNER', 'MEMBER']
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update account profile (name, description)
     */
    updateProfile: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

            const form = await superValidate(request, zod(profileEditSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get current account for audit
                const currentAccount = await prisma.account.findUnique({
                    where: { id: accountId }
                });

                if (!currentAccount) {
                    return fail(404, { form, error: 'Account not found' });
                }

                // Update account
                const updatedAccount = await prisma.account.update({
                    where: { id: accountId },
                    data: {
                        name: form.data.name,
                        description: form.data.description || null
                    }
                });

                logger.info(`Account profile updated: ${accountId}`, { userId, accountId });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Account',
                    recordId: accountId,
                    oldData: currentAccount,
                    newData: updatedAccount,
                    userId: userId || 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma
                });

                return message(form, {
                    type: 'success',
                    text: 'Profile updated successfully!'
                });
            } catch (err) {
                logger.error(`Error updating profile: ${err}`);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update profile'
                }, { status: 400 });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Create a new organization
     */
    createOrganization: restrictAccountRole(
        async ({ request, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const { accountId } = accountMembership;
            const userId = locals.user?.id;

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

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactEmail)) {
                return fail(400, { error: 'Invalid email format' });
            }

            // Prevent duplicate organization name (per account)
            const existingByName = await prisma.company.findFirst({
                where: { accountId, name: { equals: name, mode: 'insensitive' } }
            });
            if (existingByName) {
                return fail(400, { error: 'An organization with this name already exists in this account.' });
            }

            // Prevent duplicate contact email (per account)
            const existingByEmail = await prisma.company.findFirst({
                where: { accountId, contactEmail: { equals: contactEmail, mode: 'insensitive' } }
            });
            if (existingByEmail) {
                return fail(400, { error: 'An organization with this contact email already exists in this account.' });
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
    updateOrganization: restrictAccountRole(
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

            const existing = await prisma.company.findFirst({
                where: { id, accountId }
            });

            if (!existing) {
                return fail(404, { error: 'Organization not found' });
            }

            // Prevent duplicate name by another org (same account, exclude current)
            const duplicateName = await prisma.company.findFirst({
                where: {
                    accountId,
                    id: { not: id },
                    name: { equals: name, mode: 'insensitive' }
                }
            });
            if (duplicateName) {
                return fail(400, { error: 'Another organization with this name already exists in this account.' });
            }

            // Prevent duplicate contact email by another org (same account, exclude current)
            const duplicateEmail = await prisma.company.findFirst({
                where: {
                    accountId,
                    id: { not: id },
                    contactEmail: { equals: contactEmail, mode: 'insensitive' }
                }
            });
            if (duplicateEmail) {
                return fail(400, { error: 'Another organization with this contact email already exists in this account.' });
            }

            try {
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

                return { type: 'success', message: 'Organization updated successfully!' };
            } catch (err) {
                logger.error('Error updating organization:', err as Record<string, any>);
                return fail(500, { error: 'Failed to update organization' });
            }
        },
        ['ADMIN', 'OWNER']
    ),

    /**
     * Toggle organization status
     */
    toggleOrganizationStatus: restrictAccountRole(
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

                return { type: 'success', message: `Organization ${action} successfully!` };
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
    deleteOrganization: restrictAccountRole(
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
