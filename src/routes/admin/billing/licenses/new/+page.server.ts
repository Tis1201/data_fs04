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

            const accountOptions = accounts.map((a: any) => ({ value: a.id, label: a.name }));
            
            // Load devices for the selected account if an account is selected
            let deviceOptions: { value: string; label: string }[] = [];
            
            if (selectedAccountId) {
                const devices = await locals.prisma.device.findMany({
                    where: { 
                        accountId: selectedAccountId,
                        status: 'ACTIVE'
                    },
                    include: {
                        factoryTokens: {
                            where: { isUsed: false }
                        }
                    },
                    select: { 
                        id: true, 
                        name: true,
                        hardwareId: true,
                        deviceType: true,
                        factoryTokens: {
                            select: { id: true, name: true, hardwareModel: true }
                        }
                    },
                    orderBy: { name: 'asc' }
                });
                
                deviceOptions = devices
                    .filter((d: any) => d.factoryTokens.length > 0)  // Only show devices with factory tokens
                    .map((d: any) => ({
                        value: d.id,
                        label: `${d.name}${d.hardwareId ? ` (${d.hardwareId})` : ''}${d.deviceType ? ` - ${d.deviceType}` : ''} [${d.factoryTokens.length} token(s)]`
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
        async (event: any) => {
            const { request, locals, auth } = event;
            // Move form declaration outside try-catch to make it available in the catch block
            const form = await superValidate(request, zod(licenseSchema));
            
            try {
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
                
                // Always generate JWT server-side
                // Get the primary signing key if not already set
                let keyId = form.data.keyId;
                let algorithm = form.data.algorithm || 'RS256';
                let jwtToken = `server_generated_jwt_${Date.now()}_${keyId}_${algorithm}`;
                
                if (!keyId) {
                    // Find the primary signing key
                    const primaryKey = await locals.prisma.jwtSigningKey.findFirst({
                        where: {
                            keyType: 'LICENSE',
                            isActive: true,
                            isPrimary: true
                        },
                        select: {
                            keyId: true
                        }
                    });
                    
                    if (primaryKey) {
                        keyId = primaryKey.keyId;
                        logger.debug(`Using primary signing key: ${keyId}`);
                    } else {
                        // Fallback to any active key
                        const anyKey = await locals.prisma.jwtSigningKey.findFirst({
                            where: {
                                keyType: 'LICENSE',
                                isActive: true
                            },
                            select: {
                                keyId: true
                            }
                        });
                        
                        if (anyKey) {
                            keyId = anyKey.keyId;
                            logger.debug(`Using fallback signing key: ${keyId}`);
                        } else {
                            keyId = 'default_key';
                            logger.warn('No active signing keys found, using default key');
                        }
                    }
                }
                
                // Generate JWT
                logger.debug(`Generating server-side JWT for license with keyId: ${keyId}`);
                
                // Create JWT payload
                const expiresAtDate = new Date(form.data.expiresAt);
                
                const payload = {
                    iss: 'fs04_system',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(expiresAtDate.getTime() / 1000),
                    sub: deviceId || 'any_device',
                    accountId: accountId,
                    kid: keyId,
                    alg: algorithm
                };
                
                // Check if device has factory token and use it for signing
                if (deviceId) {
                    const device = await locals.prisma.device.findUnique({
                        where: { id: deviceId },
                        include: {
                            factoryTokens: {
                                where: { isUsed: false },
                                include: { factory_signing_key: true }
                            }
                        }
                    });
                    
                    if (device?.factoryTokens?.length > 0) {
                        // Use factory token's signing key
                        const factoryToken = device.factoryTokens[0];
                        const signingKey = factoryToken.factory_signing_key;
                        
                        try {
                            // Generate real JWT using factory token's signing key
                            const realJwt = jwt.sign(
                                payload,
                                signingKey.privateKey,
                                {
                                    algorithm: 'RS256',
                                    keyid: signingKey.keyId,
                                    expiresIn: Math.floor((expiresAtDate.getTime() - Date.now()) / 1000)
                                }
                            );
                            
                            // Update variables to use factory token data
                            jwtToken = realJwt;
                            keyId = signingKey.keyId;
                            algorithm = 'RS256';
                            
                            logger.debug(`Generated real JWT using factory token signing key: ${signingKey.keyId}`);
                        } catch (signError) {
                            logger.error(`Error signing JWT with factory token key: ${signError}`);
                            return message(form, createErrorResponse('JWT signing failed', {
                                details: 'Failed to sign license with factory token. Please check the signing key configuration.'
                            }));
                        }
                    } else {
                        logger.warn(`Device ${deviceId} has no available factory tokens, using system signing key`);
                    }
                }
                
                // If no factory token was used, fall back to placeholder JWT
                if (jwtToken.startsWith('server_generated_jwt_')) {
                    // In a real implementation, this would be signed with the proper key
                    jwtToken = `server_generated_jwt_${Date.now()}_${keyId}_${algorithm}`;
                    logger.debug(`Generated placeholder JWT for testing purposes`);
                }

                // Create the license
                const license = await locals.prisma.license.create({
                    data: {
                        accountId,
                        deviceId: deviceId || null,
                        // Convert expiresAt to Date object for database storage
                        expiresAt: new Date(form.data.expiresAt),
                        // Add description field
                        description: form.data.description || null,
                        keyId,
                        algorithm,
                        jwt: jwtToken,
                        createdBy: auth.user.id,
                        updatedBy: auth.user.id
                    }
                });
                
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
