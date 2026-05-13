import type { PageServerLoad } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { SystemRole } from '$lib/types/roles';
import { fail } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { logger } from '$lib/server/logger';
import { deleteEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';

// Table options for Licenses
const table_options = {
    modelName: 'license',
    searchableFields: ['accountId', 'deviceId', 'keyId', 'status'],
    allowedFilters: ['statuses', 'accountId'],
    defaultSortField: 'issuedAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    include: {
        account: {
            select: {
                id: true,
                name: true
            }
        }
    },
    filterMappings: {
        'statuses': { field: 'status', operator: 'in' }
    }
};

export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:licenses');
        const result = await fetchTableData(locals, url, table_options);
        return {
            licenses: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions = {
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'License ID is required' });
                }
                
                // Get the license to be deleted
                const license = await locals.prisma.license.findUnique({
                    where: { id }
                });

                if (!license) {
                    return fail(404, { error: 'License not found' });
                }

                // Delete the associated expiration cronjob first
                try {
                    await deleteEntityExpirationCronjob(locals.prisma, 'license', id);
                    logger.info(`Deleted expiration cronjob for license: ${id}`);
                } catch (cronError) {
                    logger.warn(`Failed to delete cronjob for license ${id}:`, cronError);
                }

                await locals.prisma.license.delete({
                    where: { id }
                })

                logger.info('License deleted successfully:', { licenseId: id });

                const session = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'License',
                    recordId: id,
                    oldData: license,
                    newData: null,
                    userId: session?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })
                
                return {
                    success: true,
                    message: 'License deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting license', { error: e });
                return fail(500, {
                    error: 'Failed to delete license'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
}