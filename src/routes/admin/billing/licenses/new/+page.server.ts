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
import { DeviceModel } from '$lib/constants/device';
import { getActiveTokenKey } from '$lib/server/jwt_issuer/keys/token-key';
import { randomUUID } from 'crypto';

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
                
                // Validate and parse expiration date
                if (!form.data.expiresAt || form.data.expiresAt === 'undefined') {
                    return message(
                        form,
                        createErrorResponse('Invalid expiration date', {
                            details: 'Please select a valid expiration date for the license.'
                        })
                    );
                }
                
                const expiresAtDate = new Date(form.data.expiresAt);
                
                // Check if date is valid
                if (isNaN(expiresAtDate.getTime())) {
                    return message(
                        form,
                        createErrorResponse('Invalid expiration date', {
                            details: `The expiration date "${form.data.expiresAt}" is not a valid date.`
                        })
                    );
                }
                
                // Check if date is in the future
                if (expiresAtDate <= new Date()) {
                    return message(
                        form,
                        createErrorResponse('Invalid expiration date', {
                            details: 'The expiration date must be in the future.'
                        })
                    );
                }
                
                // Validate device exists
                const device = await locals.prisma.device.findUnique({
                    where: { id: deviceId },
                    select: {
                        id: true,
                        name: true,
                        model: true,
                        macAddress: true,
                        wifiMac: true,
                        lanMac: true
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

                // Get active TOKEN signing key (NOT factory key!)
                let signingKey;
                try {
                    signingKey = await getActiveTokenKey(locals.prisma);
                    logger.info(`Using TOKEN signing key: ${signingKey.keyId} for license`);
                } catch (keyError) {
                    logger.error(`Error fetching TOKEN signing key: ${keyError}`);
                    return message(
                        form,
                        createErrorResponse('No TOKEN signing key available', {
                            details: 'Please create a TOKEN signing key first. Factory keys cannot be used for licenses.'
                        })
                    );
                }

                // Generate license ID
                const licenseId = randomUUID();

                // Build JWT payload with all required claims
                const now = Math.floor(Date.now() / 1000);
                const exp = Math.floor(expiresAtDate.getTime() / 1000);
                
                const payload: Record<string, any> = {
                    // Standard claims
                    iss: 'fs04_system',
                    sub: deviceId,              // device_id
                    iat: now,
                    exp: exp,
                    
                    // License-specific claims (per DEVICE_LICENSE.md)
                    account_id: accountId,
                    license_id: licenseId,
                    entitlements: [],           // Empty array for now, can be extended
                    expires_at: expiresAtDate.toISOString()
                };

                // Add MAC address for Android devices
                if (device.model?.toUpperCase() === DeviceModel.ANDROID) {
                    const macAddress = device.macAddress || device.wifiMac || device.lanMac;
                    if (macAddress) {
                        payload['macAddress'] = macAddress;
                    }
                }

                // Sign JWT with TOKEN key
                let jwtToken;
                try {
                    jwtToken = jwt.sign(
                        payload,
                        signingKey.privateKey,
                        {
                            algorithm: signingKey.algorithm as jwt.Algorithm,
                            keyid: signingKey.keyId,
                        }
                    );
                    
                    logger.info(`Generated license JWT using TOKEN key: ${signingKey.keyId}`);
                } catch (signError) {
                    logger.error(`Error signing JWT with TOKEN key: ${signError}`);
                    return message(form, createErrorResponse('JWT signing failed', {
                        details: 'Failed to sign license JWT. Please check the TOKEN signing key configuration.'
                    }));
                }

                // Create the license (no factory token involved!)
                const license = await locals.prisma.license.create({
                    data: {
                        id: licenseId,
                        accountId,
                        deviceId: deviceId,
                        expiresAt: expiresAtDate,
                        description: form.data.description || null,
                        keyId: signingKey.keyId,
                        algorithm: signingKey.algorithm,
                        signingKeyId: signingKey.id,  // ✅ Reference TOKEN signing key
                        jwt: jwtToken,
                        createdBy: auth.user.id,
                        updatedBy: auth.user.id
                    }
                });
                
                // Use device name for the message
                const deviceName = device?.name || 'Unknown Device';
                
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
                                signingKeyId: license.signingKeyId,  // ✅ Include signing key reference
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
