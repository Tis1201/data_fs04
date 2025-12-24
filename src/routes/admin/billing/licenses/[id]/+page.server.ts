import { error, fail, json } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import jwt from 'jsonwebtoken';
import { upsertEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';

// Define the license renewal schema
const licenseRenewalSchema = z.object({
    newExpiresAt: z.coerce.date({
        required_error: "Expiration date is required",
        invalid_type_error: "Expiration date must be a valid date"
    }).refine(date => date > new Date(), {
        message: "Expiration date must be in the future"
    }),
    metadata: z.string().optional(),
});

export const actions: Actions = {
    download: restrict(
        async ({ params, locals }: any) => {
            const { id } = params;
            
            try {
                // Fetch the license by ID
                const license = await locals.prisma.license.findUnique({
                    where: { id },
                    select: {
                        jwt: true,
                        account: {
                            select: {
                                name: true
                            }
                        }
                    }
                });
                
                if (!license) {
                    throw error(404, 'License not found');
                }
                
                // Return the JWT as a downloadable file
                return new Response(license.jwt, {
                    headers: {
                        'Content-Type': 'application/jwt',
                        'Content-Disposition': `attachment; filename="license-${license.account.name.replace(/\s+/g, '-').toLowerCase()}.jwt"`
                    }
                });
            } catch (err) {
                logger.error(`Error downloading license ${id}: ${err}`);
                throw error(500, 'Failed to download license');
            }
        },
        [SystemRole.ADMIN]
    ),
    renew: restrict(
        async ({ params, locals, request, auth }: any) => {
            const { id } = params;
            
            // Validate form data
            const form = await superValidate(request, zod(licenseRenewalSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Fetch the existing license
                const existingLicense = await locals.prisma.license.findUnique({
                    where: { id },
                    include: {
                        account: true,
                        device: true
                    }
                });
                
                if (!existingLicense) {
                    throw new FormValidationError(
                        'License not found',
                        'LICENSE_NOT_FOUND',
                        404
                    );
                }
                
                // Get authenticated user info
                const userInfo = auth.user;
                if (!userInfo) {
                    throw new FormValidationError(
                        'You must be logged in to renew a license',
                        'AUTH_REQUIRED',
                        401
                    );
                }

                // Create renewal record
                const { data } = form;
                
                // Get the signing key to regenerate JWT
                const signingKey = await locals.prisma.jwtSigningKey.findFirst({
                    where: {
                        keyType: 'TOKEN',
                        isActive: true
                    }
                });

                if (!signingKey) {
                    throw new FormValidationError(
                        'No active TOKEN signing key found',
                        'SIGNING_KEY_NOT_FOUND',
                        500
                    );
                }

                // Start a transaction to ensure both operations succeed or fail together
                const result = await locals.prisma.$transaction(async (tx: any) => {
                    // Create the renewal record
                    const renewal = await tx.licenseRenewal.create({
                        data: {
                            licenseId: id,
                            oldIssuedAt: existingLicense.issuedAt,
                            oldExpiresAt: existingLicense.expiresAt,
                            newIssuedAt: new Date(),
                            newExpiresAt: data.newExpiresAt,
                            jwtSnapshot: existingLicense.jwt,
                            source: 'manual',
                            metadata: data.metadata || null,
                            performedBy: userInfo.id,
                            createdBy: userInfo.id,
                            updatedBy: userInfo.id
                        }
                    });

                    // Generate new JWT with updated expiration
                    const now = Math.floor(Date.now() / 1000);
                    const exp = Math.floor(data.newExpiresAt.getTime() / 1000);
                    
                    const payload: Record<string, any> = {
                        // Standard claims
                        iss: 'fs04_system',
                        sub: existingLicense.deviceId || 'any_device',
                        iat: now,
                        exp: exp,
                        
                        // License-specific claims
                        account_id: existingLicense.accountId,
                        license_id: existingLicense.id,
                        entitlements: [],
                        expires_at: data.newExpiresAt.toISOString()
                    };

                    // Add MAC address for Android devices if available
                    if (existingLicense.device?.model?.toUpperCase() === 'ANDROID') {
                        const macAddress = existingLicense.device.macAddress || 
                                        existingLicense.device.wifiMac || 
                                        existingLicense.device.lanMac;
                        if (macAddress) {
                            payload['macAddress'] = macAddress;
                        }
                    }

                    // Sign new JWT
                    const newJwt = jwt.sign(
                        payload,
                        signingKey.privateKey,
                        {
                            algorithm: signingKey.algorithm as jwt.Algorithm,
                            keyid: signingKey.keyId,
                        }
                    );
                    
                    // Update the license with new expiration date and JWT
                    const updatedLicense = await tx.license.update({
                        where: { id },
                        data: {
                            expiresAt: data.newExpiresAt,
                            jwt: newJwt,
                            updatedBy: userInfo.id
                        }
                    });
                    
                    return { renewal, updatedLicense };
                });
                
                logger.info(`License renewed: ${result.updatedLicense.id} by user ${userInfo.id}`);

                // Update cronjob for new expiration date
                await upsertEntityExpirationCronjob(locals.prisma, {
                    entityType: 'license',
                    entityId: result.updatedLicense.id,
                    expiresAt: result.updatedLicense.expiresAt,
                    action: 'mark',
                    userId: userInfo.id,
                    accountId: result.updatedLicense.accountId
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'License',
                    recordId: result.updatedLicense.id,
                    oldData: existingLicense,
                    newData: result.updatedLicense,
                    userId: userInfo.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                // Return success response
                return message(
                    form,
                    createSuccessResponse('License renewed successfully!', {
                        details: `License for account '${existingLicense.account.name}' has been renewed until ${data.newExpiresAt.toLocaleDateString()}.`,
                        data: {
                            id: result.updatedLicense.id,
                            expiresAt: result.updatedLicense.expiresAt
                        }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to renew license. Please try again later.',
                    action: 'license renewal'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
};

export const load = restrict(
    async ({ params, locals }: any) => {
        const { id } = params;

        try {
            // Fetch the license by ID
            const license = await locals.prisma.license.findUnique({
                where: { id },
                include: {
                    account: true,
                    device: true,
                    renewals: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        include: {
                            // Include user information if needed
                        }
                    },
                    entitlements: true
                }
            });
            
            if (!license) {
                throw error(404, 'License not found');
            }
            
            // Create form for renewal
            const renewalForm = await superValidate(zod(licenseRenewalSchema));
            
            return {
                license,
                renewalForm,
                meta: {
                    title: `License: ${license.account.name}`,
                    description: `Manage license for ${license.account.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading license ${id}: ${err}`);
            throw error(500, 'Failed to load license');
        }
    },
    [SystemRole.ADMIN]
);
