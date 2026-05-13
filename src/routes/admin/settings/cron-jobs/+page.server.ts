import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { syncCronJobs, triggerCronJob, removeCronJob } from '$lib/server/jobs/cron-sync';

// Table options for CronJobs
const table_options = {
    modelName: 'cronJob',
    searchableFields: ['name', 'functionName'],
    allowedFilters: ['status'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 20,
    filterMappings: {
        'status': { field: 'status', operator: 'in' }
    },
    columns: [
        { id: 'name', label: 'Name', sortable: true, width: '20%' },
        { id: 'functionName', label: 'Function', sortable: true, width: '15%' },
        { id: 'cronExpression', label: 'Schedule', sortable: true, width: '10%' },
        { id: 'status', label: 'Status', sortable: true, width: '10%' },
        { id: 'lastRunAt', label: 'Last Run', sortable: true, width: '15%' },
        { id: 'lastResult', label: 'Result', sortable: true, width: '10%' },
        { id: 'stats', label: 'Stats', width: '10%' },
        { id: 'actions', label: 'Actions', width: '10%' }
    ],
    select: {
        id: true,
        name: true,
        functionName: true,
        cronExpression: true,
        isRecurring: true,
        timezone: true,
        status: true,
        lastRunAt: true,
        nextRunAt: true,
        lastResult: true,
        lastError: true,
        isRunning: true,
        totalRuns: true,
        successCount: true,
        failureCount: true,
        maxRetries: true,
        timeout: true,
        args: true,
        createdAt: true,
        updatedAt: true
    }
};

/*******************************************************************************************
 * Load
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // Fetch all cron jobs
        const cronJobs = await locals.prisma.cronJob.findMany({
            select: table_options.select,
            orderBy: { createdAt: 'desc' }
        });

        return {
            cronJobs,
            meta: {
                total: cronJobs.length,
                currentPage: 1,
                perPage: table_options.defaultPerPage
            }
        };
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

// Validation schema for CronJob
const cronJobSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    functionName: z.string().min(1, 'Function name is required'),
    cronExpression: z.string().min(1, 'Cron expression is required'),
    timezone: z.string().optional().default('UTC'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).default('ACTIVE'),
    maxRetries: z.coerce.number().int().min(0).max(10).default(3),
    timeout: z.coerce.number().int().min(0).nullable().optional(),
    args: z.string().optional().transform((val) => {
        if (!val) return null;
        try {
            return JSON.parse(val);
        } catch {
            return null;
        }
    })
});

/*******************************************************************************************
 * Actions
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Create CronJob
     *******************************************************************************************/
    create: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const form = await superValidate(request, zod(cronJobSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const session = await locals.auth.validate();
                const userId = session?.user?.id;

                const cronJob = await locals.prisma.cronJob.create({
                    data: {
                        ...form.data,
                        createdBy: userId
                    }
                });

                // Sync to BullMQ
                await syncCronJobs();

                logger.info('[CronJobs] Created:', { id: cronJob.id, name: cronJob.name });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'CronJob',
                    recordId: cronJob.id,
                    oldData: null,
                    newData: cronJob,
                    userId: userId ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                });

                return { form, success: true, cronJob };
            } catch (e) {
                logger.error('[CronJobs] Create failed:', { error: e });
                return fail(500, { form, error: 'Failed to create cron job' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Update CronJob
     *******************************************************************************************/
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, { error: 'CronJob ID is required' });
            }

            const form = await superValidate(formData, zod(cronJobSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const session = await locals.auth.validate();
                const oldCronJob = await locals.prisma.cronJob.findUnique({ where: { id } });

                if (!oldCronJob) {
                    return fail(404, { form, error: 'CronJob not found' });
                }

                const cronJob = await locals.prisma.cronJob.update({
                    where: { id },
                    data: form.data
                });

                // Sync to BullMQ
                await syncCronJobs();

                logger.info('[CronJobs] Updated:', { id: cronJob.id, name: cronJob.name });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'CronJob',
                    recordId: cronJob.id,
                    oldData: oldCronJob,
                    newData: cronJob,
                    userId: session?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                });

                return { form, success: true, cronJob };
            } catch (e) {
                logger.error('[CronJobs] Update failed:', { error: e });
                return fail(500, { form, error: 'Failed to update cron job' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Toggle Status
     *******************************************************************************************/
    toggleStatus: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const newStatus = formData.get('status')?.toString() as 'ACTIVE' | 'INACTIVE' | 'PAUSED';

            if (!id || !newStatus) {
                return fail(400, { error: 'ID and status are required' });
            }

            try {
                const session = await locals.auth.validate();
                const oldCronJob = await locals.prisma.cronJob.findUnique({ where: { id } });

                if (!oldCronJob) {
                    return fail(404, { error: 'CronJob not found' });
                }

                const cronJob = await locals.prisma.cronJob.update({
                    where: { id },
                    data: { status: newStatus }
                });

                // Sync to BullMQ (will add/remove scheduler based on status)
                await syncCronJobs();

                logger.info('[CronJobs] Status changed:', { id, oldStatus: oldCronJob.status, newStatus });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'CronJob',
                    recordId: id,
                    oldData: { status: oldCronJob.status },
                    newData: { status: newStatus },
                    userId: session?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (e) {
                logger.error('[CronJobs] Toggle status failed:', { error: e });
                return fail(500, { error: 'Failed to update status' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Trigger Now (Ad-hoc execution)
     *******************************************************************************************/
    trigger: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, { error: 'CronJob ID is required' });
            }

            try {
                const jobId = await triggerCronJob(id);
                logger.info('[CronJobs] Triggered:', { cronJobId: id, jobId });
                return { success: true, jobId };
            } catch (e) {
                logger.error('[CronJobs] Trigger failed:', { error: e });
                return fail(500, { error: 'Failed to trigger job' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Delete CronJob
     *******************************************************************************************/
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, { error: 'CronJob ID is required' });
            }

            try {
                const session = await locals.auth.validate();
                const cronJob = await locals.prisma.cronJob.findUnique({ where: { id } });

                if (!cronJob) {
                    return fail(404, { error: 'CronJob not found' });
                }

                // Remove from BullMQ first
                await removeCronJob(id);

                // Delete from DB
                await locals.prisma.cronJob.delete({ where: { id } });

                logger.info('[CronJobs] Deleted:', { id, name: cronJob.name });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'CronJob',
                    recordId: id,
                    oldData: cronJob,
                    newData: null,
                    userId: session?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (e) {
                logger.error('[CronJobs] Delete failed:', { error: e });
                return fail(500, { error: 'Failed to delete cron job' });
            }
        },
        [SystemRole.ADMIN]
    )
};
