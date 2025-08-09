import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { licenseSchema } from './license';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

export const load = restrict(
    async (event) => {
        const { locals } = event;
        try {
            const form = await superValidate(zod(licenseSchema), { id: 'license-form' });

            if (!form.data.accountId || form.data.accountId === 'undefined') {
                form.data.accountId = '';
            }

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });

            const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

            return { form, accountOptions };
        } catch (err) {
            logger.error(`Error loading add license form: ${String(err)}`);
            throw error(500, 'Failed to load license form');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async (event) => {
            const { request, locals, auth } = event;
            try {
                const form = await superValidate(request, zod(licenseSchema));

                if (!form.valid) {
                    logger.debug(`License form validation failed: ${JSON.stringify(form.errors)}`);
                    return fail(400, { form });
                }

                let accountId = form.data.accountId || '';

                // Resolve account (specific or system)
                let account;
                let accountName = 'Unknown Account';

                try {
                    if (accountId && accountId !== '') {
                        account = await locals.prisma.account.findUnique({ where: { id: accountId } });
                        if (!account) {
                            return message(
                                form,
                                createErrorResponse('Invalid account', {
                                    details: `The selected account with ID '${accountId}' does not exist.`
                                })
                            );
                        }
                    } else {
                        account = await locals.prisma.account.findFirst({ where: { isSystem: true } });
                        if (!account) {
                            logger.error('System account not found in database');
                            return message(
                                form,
                                createErrorResponse('System account not found', {
                                    details: 'The system account does not exist. Please run the database seed to create it.'
                                })
                            );
                        }
                    }

                    accountName = account.name;
                    accountId = account.id; // canonicalize
                } catch (acctErr) {
                    logger.error(`Error verifying account: ${String(acctErr)}`);
                    return message(
                        form,
                        createErrorResponse('Error verifying account', {
                            details: 'Failed to verify the selected account. Please try again.'
                        })
                    );
                }

                const deviceId = form.data.deviceId && form.data.deviceId.trim() !== '' ? form.data.deviceId.trim() : null;

                // Create the license
                const license = await locals.prisma.license.create({
                    data: {
                        accountId,
                        deviceId,
                        expiresAt: form.data.expiresAt,
                        keyId: form.data.keyId,
                        algorithm: form.data.algorithm,
                        jwt: form.data.jwt,
                        createdBy: auth.user.id,
                        updatedBy: auth.user.id
                    }
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'License',
                    recordId: license.id,
                    oldData: null,
                    newData: license,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return message(
                    form,
                    createSuccessResponse('License created successfully', {
                        details: `License has been issued for ${accountName}.`,
                        data: { licenseId: license.id, accountId }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    accountId: undefined,
                    defaultMessage: 'Failed to create license. Please try again.',
                    action: 'admin license creation'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
