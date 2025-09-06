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
import jwt from 'jsonwebtoken';

export const load = restrict(
    async (event: any) => {
        const { locals, url } = event;
        try {
            
            // Initialize form with defaults
            const form = await superValidate(zod(licenseSchema), { id: 'license-form' });

            // Load accounts for dropdown
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });

            const accountOptions = accounts.map((a: any) => ({ value: a.id, label: a.name }));

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
        async (event: any) => {
            const { request, locals, auth } = event;
            // Move form declaration outside try-catch to make it available in the catch block
            const form = await superValidate(request, zod(licenseSchema));
            if (!form.valid) {
                logger.debug(`License form validation failed: ${JSON.stringify(form.errors)}`);
                return fail(400, { form });
            }
            
            try {
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


                const deviceId = form.data.deviceId.trim();
                const expiresAtDate = new Date(form.data.expiresAt);
                
                let jwtToken;
                let signingKey;
                let factoryToken;

                try {
                    const device = await locals.prisma.device.findUnique({
                        where: { id: deviceId },
                        include: {
                            factoryTokens: {
                                where: { isUsed: false },
                                include: { factory_signing_key: true }
                            }
                        }
                    });

                    if (!device) {
                        return message(
                            form,
                            createErrorResponse('Invalid device', {
                                details: `The selected device with ID '${deviceId}' does not exist.`
                            })
                        );
                    }

                    if (!device.factoryTokens.length) {
                        return message(
                            form,
                            createErrorResponse('Missing factory token', {
                                details: `The selected device with ID '${deviceId}' does not have unsued factory token.`
                            })
                        );
                    }

                    // Use factory token's signing key
                    factoryToken = device.factoryTokens[0];
                    signingKey = factoryToken.factory_signing_key;
                    
                    try {
                        // Generate real JWT using factory token's signing key
                        const payload = {
                            iss: 'fs04_system',
                            iat: Math.floor(Date.now() / 1000),
                            exp: Math.floor(expiresAtDate.getTime() / 1000),
                            sub: deviceId,
                            accountId
                        };
                        jwtToken = jwt.sign(
                            payload,
                            signingKey.privateKey,
                            {
                                algorithm: signingKey.algorithm,
                                keyid: signingKey.keyId,
                            }
                        );
                        
                        logger.debug(`Generated JWT using factory token signing key: ${signingKey.keyId}`);
                    } catch (signError) {
                        logger.error(`Error signing JWT with factory token key: ${signError}`);
                        return message(form, createErrorResponse('JWT signing failed', {
                            details: 'Failed to sign license with factory token. Please check the signing key configuration.'
                        }));
                    }
                } catch (deviceErr) {
                    logger.error(`Error verifying device: ${String(deviceErr)}`);
                    return message(
                        form,
                        createErrorResponse('Error verifying device', {
                            details: 'Failed to verify the selected device. Please try again.'
                        })
                    );
                }

                // Create the license and mark factory token as used
                const result = await locals.prisma.$transaction(async (tx) => {
                    const license = await tx.license.create({
                        data: {
                            accountId,
                            deviceId: deviceId,
                            // Convert expiresAt to Date object for database storage
                            expiresAt: expiresAtDate,
                            // Add description field
                            description: form.data.description || null,
                            keyId: signingKey.keyId,
                            algorithm: signingKey.algorithm,
                            jwt: jwtToken,
                            createdBy: auth.user.id,
                            updatedBy: auth.user.id
                        }
                    });

                    await tx.factoryToken.update({
                        where: { id: factoryToken.id },
                        data: { isUsed: true, usedAt: new Date() }
                    })

                    return { license };
                })

                const { license } = result;
                
                // Get device name for the message if a device was selected
                let deviceName = '';
                if (deviceId) {
                    const device = await locals.prisma.device.findUnique({
                        where: { id: deviceId },
                        select: { name: true }
                    });
                    deviceName = device?.name || 'Unknown Device';
                }
                
                // Log the audit
                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'License',
                    recordId: license.id,
                    oldData: null,
                    newData: license,
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                logger.info(`License created: ${license.id} for account ${accountId}${deviceId ? ` and device ${deviceId}` : ''}`);
                
                // Return success with message and form
                return message(
                    form,
                    createSuccessResponse('License created successfully!', {
                        details: `License has been created for account ${accountName}${deviceName ? ` and device ${deviceName}` : ''}.`,
                        data: {
                            // Return the full license object for download
                            license: {
                                id: license.id,
                                accountId: license.accountId,
                                deviceId: license.deviceId,
                                expiresAt: license.expiresAt,
                                description: license.description,
                                algorithm: license.algorithm,
                                keyId: license.keyId,
                                jwt: license.jwt
                            }
                        }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to create license. Please try again.',
                    action: 'admin license creation'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
