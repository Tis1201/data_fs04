import type { PageServerLoad, Actions } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { error, fail } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async ({ params }: AuthenticatedEvent) => {
        const plan = await prisma.plan.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { subscriptions: true }
                }
            }
        });

        if (!plan) {
            throw error(404, 'Plan not found');
        }

        return {
            plan: {
                id: plan.id,
                code: plan.code,
                name: plan.name,
                isActive: plan.isActive,
                maxDevices: plan.maxDevices,
                maxUsers: plan.maxUsers,
                maxLogLinesPerMonth: plan.maxLogLinesPerMonth,
                dataRetentionDays: plan.dataRetentionDays,
                stripeProductId: plan.stripeProductId,
                stripePriceId: plan.stripePriceId,
                features: plan.features as string[],
                subscriptionCount: plan._count.subscriptions
            }
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;

export const actions = {
    updatePlan: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const formData = await request.formData();

            // Get current plan for audit log
            const currentPlan = await prisma.plan.findUnique({
                where: { id: params.id }
            });

            if (!currentPlan) {
                return fail(404, { error: 'Plan not found' });
            }

            // Parse and validate form data
            const name = formData.get('name') as string;
            const maxDevices = parseInt(formData.get('maxDevices') as string, 10);
            const maxUsers = parseInt(formData.get('maxUsers') as string, 10);
            const maxLogLinesPerMonth = parseInt(formData.get('maxLogLinesPerMonth') as string, 10);
            const dataRetentionDays = parseInt(formData.get('dataRetentionDays') as string, 10);
            const isActive = formData.get('isActive') === 'true';
            const stripePriceId = formData.get('stripePriceId') as string || null;

            // Validate
            if (!name || name.trim().length === 0) {
                return fail(400, { error: 'Name is required' });
            }
            if (isNaN(maxDevices) || maxDevices < 1) {
                return fail(400, { error: 'Max devices must be at least 1' });
            }
            if (isNaN(maxUsers) || maxUsers < 1) {
                return fail(400, { error: 'Max users must be at least 1' });
            }
            if (isNaN(maxLogLinesPerMonth) || maxLogLinesPerMonth < 0) {
                return fail(400, { error: 'Max log lines must be 0 or greater' });
            }
            if (isNaN(dataRetentionDays) || dataRetentionDays < 1) {
                return fail(400, { error: 'Data retention must be at least 1 day' });
            }

            const newData = {
                name: name.trim(),
                maxDevices,
                maxUsers,
                maxLogLinesPerMonth,
                dataRetentionDays,
                isActive,
                stripePriceId
            };

            // Update plan
            await prisma.plan.update({
                where: { id: params.id },
                data: newData
            });

            // Get current user for audit
            const auth = await locals.auth.validate();

            // Audit log
            await logAudit({
                prisma,
                actionType: AuditActionType.UPDATE,
                tableName: 'Plan',
                recordId: params.id!,
                oldData: {
                    name: currentPlan.name,
                    maxDevices: currentPlan.maxDevices,
                    maxUsers: currentPlan.maxUsers,
                    maxLogLinesPerMonth: currentPlan.maxLogLinesPerMonth,
                    dataRetentionDays: currentPlan.dataRetentionDays,
                    isActive: currentPlan.isActive,
                    stripePriceId: currentPlan.stripePriceId
                },
                newData,
                userId: auth?.user?.id ?? '',
                ipAddress: event.getClientAddress(),
                changeSummary: `Updated plan "${currentPlan.name}"`
            });

            return { success: true };
        },
        ['ADMIN']
    )
} satisfies Actions;

