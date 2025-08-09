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
        const { locals, url } = event;
        try {
            // Get the selected account ID from URL query parameter if available
            const selectedAccountId = url.searchParams.get('accountId') || '';
            
            // Initialize form with defaults
            const form = await superValidate(zod(licenseSchema), { id: 'license-form' });
            
            // Set default values
            form.data.accountId = selectedAccountId || '';
            form.data.algorithm = 'RS256'; // Set default algorithm
            
            // Get signing keys to set default keyId
            const signingKeys = await locals.prisma.jwtSigningKey.findMany({
                where: {
                    keyType: 'LICENSE',
                    isActive: true
                },
                select: {
                    id: true,
                    keyId: true,
                    isPrimary: true
                },
                orderBy: [
                    { isPrimary: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            
            // Set default keyId if available
            if (signingKeys.length > 0) {
                form.data.keyId = signingKeys[0].keyId;
            }

            // Load accounts for dropdown
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });

            const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
            
            // Load devices for the selected account if an account is selected
            let deviceOptions: { value: string; label: string }[] = [];
            
            if (selectedAccountId) {
                const devices = await locals.prisma.device.findMany({
                    where: { 
                        accountId: selectedAccountId,
                        status: 'ACTIVE'
                    },
                    select: { 
                        id: true, 
                        name: true,
                        hardwareId: true,
                        deviceType: true
                    },
                    orderBy: { name: 'asc' }
                });
                
                deviceOptions = devices.map((d) => ({
                    value: d.id,
                    label: `${d.name}${d.hardwareId ? ` (${d.hardwareId})` : ''}${d.deviceType ? ` - ${d.deviceType}` : ''}`
                }));
            }

            return { form, accountOptions, deviceOptions, signingKeys };
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
                
                // Check if we need to generate a JWT server-side
                let jwt = form.data.jwt;
                
                if (!jwt) {
                    // TODO: In a real implementation, this would call a service to generate the JWT
                    // For now, we'll just create a placeholder
                    logger.debug(`Generating server-side JWT for license with keyId: ${form.data.keyId}`);
                    
                    // This is just a placeholder - in production, this would call a proper JWT generation service
                    const payload = {
                        iss: 'fs04_system',
                        sub: deviceId || 'any_device',
                        iat: Math.floor(Date.now() / 1000),
                        exp: Math.floor(form.data.expiresAt.getTime() / 1000),
                        accountId: accountId
                    };
                    
                    // In a real implementation, this would be signed with the proper key
                    jwt = `server_generated_jwt_${Date.now()}_placeholder`;
                    logger.debug(`Generated placeholder JWT for testing purposes`);
                }

                // Create the license
                const license = await locals.prisma.license.create({
                    data: {
                        accountId,
                        deviceId,
                        expiresAt: form.data.expiresAt,
                        keyId: form.data.keyId,
                        algorithm: form.data.algorithm,
                        jwt,
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
