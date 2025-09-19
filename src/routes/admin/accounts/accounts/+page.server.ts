import { error, type RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {restrict} from "$lib/server/security/guards";
import {SystemRole} from "$lib/types/roles";
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType, UserStatus } from '$lib/constants/system';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

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
    select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        logoUrl: true,
        _count: {
            select: {
                companies: true,
                members: true,
                devices: true
            }
        }
    },
    baseWhere: {
        isSystem: false
    }
};

export const load: PageServerLoad = async ({ url, locals }: RequestEvent) => {
    try {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            accounts: result.records,
            meta: result.meta
        };
    } catch (err) {
        console.error('Error loading accounts:', err);
        throw error(500, 'Failed to load accounts');
    }
};

export const actions: Actions = {
    deleteAccount: restrict(
        async ({ request, locals }: RequestEvent) => {
        const formData = await request.formData();
        const id = formData.get('id')?.toString();

        if (!id) {
            return { success: false, error: 'Account ID is required' };
        }

        try {
            const account = await locals.prisma.account.delete({
                where: { id }
            });

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'Account',
                recordId: id,
                oldData: account,
                newData: null,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            })

            return { success: true };
        } catch (err) {
            console.error('Error deleting account:', err);
            return { success: false, error: 'Failed to delete account' };
        }
    },[SystemRole.ADMIN]),
    
    toggleStatus: async ({ request, locals }: RequestEvent) => {
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

            await logAudit({
                actionType: AuditActionType.UPDATE,
                tableName: 'Account',
                recordId: id,
                oldData: {status: status == UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE},
                newData: {status},
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            })

            return { success: true };
        } catch (err) {
            console.error('Error updating account status:', err);
            return { success: false, error: 'Failed to update account status' };
        }
    }
};
