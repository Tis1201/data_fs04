import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from "$lib/server/security/guards";
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType, UserStatus } from '$lib/constants/system';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';
import prisma from '$lib/server/prisma';

const table_options = {
    modelName: 'account',
    searchableFields: ['name', 'id', 'slug'],
    allowedFilters: ['statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'statuses': { field: 'status', operator: 'in' }
    },
    baseWhere: {
        isSystem: false
    },
    include: {
        _count: { select: { companies: true, members: true } }
    }
};

export const load = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        try {
            // Use raw Prisma for admin accounts list - ZenStack enhanced client
            // doesn't support _count in include; raw client works correctly
            const result = await fetchTableData({ prisma }, url, table_options);
            
            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            const accountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && accountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, accountId);
                } catch (e) { /* ignore */ }
            }
            
            return {
                accounts: result.records,
                meta: result.meta,
                modulePermissions,
                user: locals.user
            };
        } catch (err) {
            console.error('Error loading accounts:', err);
            throw error(500, 'Failed to load accounts');
        }
    },
    'ACCOUNTS',
    { action: 'VIEW' }
) satisfies PageServerLoad;

export const actions: Actions = {
    deleteAccount: restrictModule(
        async (event: ModuleAuthenticatedEvent) => {
        const { request, locals } = event;
        const formData = await request.formData();
        const id = formData.get('id')?.toString();

        if (!id) {
            return { success: false, error: 'Account ID is required' };
        }

        try {
            const account = await locals.prisma.account.delete({
                where: { id }
            });

            const auth = await locals.auth.validate();

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'Account',
                recordId: id,
                oldData: account,
                newData: null,
                userId: auth?.user?.id ?? '',
                ipAddress: event.getClientAddress(),
                prisma: locals.prisma
            })

            return { success: true };
        } catch (err) {
            console.error('Error deleting account:', err);
            return { success: false, error: 'Failed to delete account' };
        }
    },
    'ACCOUNTS',
    { action: 'DELETE' }),
    
    toggleStatus: restrictModule(
        async (event: ModuleAuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const status = formData.get('status')?.toString();

            if (!id || !status) {
                return { success: false, error: 'Account ID and status are required' };
            }

            try {
                await locals.prisma.account.update({
                    where: { id },
                    data: { status }
                });

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Account',
                    recordId: id,
                    oldData: {status: status == UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE},
                    newData: {status},
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                console.error('Error updating account status:', err);
                return { success: false, error: 'Failed to update account status' };
            }
        },
        'ACCOUNTS',
        { action: 'EDIT' }
    )
};
