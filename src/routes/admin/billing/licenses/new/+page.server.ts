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
            // Move form declaration outside try-catch to make it available in the catch block
            // Use JSON data type for superForm to handle complex data types
            const form = await superValidate(request, zod(licenseSchema), { dataType: 'json' });
            
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
                
                // In a real implementation, this would be signed with the proper key
                const jwt = `server_generated_jwt_${Date.now()}_${keyId}_${algorithm}`;
                logger.debug(`Generated placeholder JWT for testing purposes`);

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
                        jwt,
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
