import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { createSuccessResponse, createErrorResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { upsertEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';

// PreclaimSet upload schema (file validated in action)
const preclaimSetSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }).max(255),
    description: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(), // yyyy-MM-dd from date picker
    profileId: z.string().optional().nullable(), // Optional device profile assignment
});

export const load = restrict(
    async ({ locals }: any) => {
        const form = await superValidate(zod(preclaimSetSchema), {
            id: 'preclaim-set-form'
        });

        const { currentAccount } = locals;
        const accountId = currentAccount?.accountId ?? null;

        // Load available device profiles for the current account (GLOBAL level only)
        const profiles = await locals.prisma.deviceProfile.findMany({
            where: {
                isActive: true,
                level: 'GLOBAL', // Only GLOBAL profiles can be assigned to preclaims
                accountId: accountId // Only show profiles from user's current account
            },
            select: {
                id: true,
                name: true,
                description: true
            },
            orderBy: { name: 'asc' }
        });

        const profileOptions = profiles.map((profile: any) => ({
            value: profile.id,
            label: profile.name,
            description: profile.description
        }));

        return {
            form,
            accountId,
            profileOptions
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

function parseCsv(content: string): Array<{ macId: string; name?: string; description?: string; expiresAt?: string }>{
    // Very small CSV parser for UTF-8 with header
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const colIndex = {
        macid: header.indexOf('macid') >= 0 ? header.indexOf('macid') : header.indexOf('mac'),
        name: header.indexOf('name'),
        description: header.indexOf('description'),
        expiresat: header.indexOf('expiresat')
    } as const;
    if (colIndex.macid < 0) {
        throw new Error('CSV must include a macId/mac column header');
    }
    const rows: Array<{ macId: string; name?: string; description?: string; expiresAt?: string }> = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length === 0) continue;
        const macRaw = (cols[colIndex.macid] || '').trim();
        if (!macRaw) continue;
        // Use original MAC format as-is
        if (macRaw.length < 6) continue;
        const row = {
            macId: macRaw, // Store original format
            name: colIndex.name >= 0 ? (cols[colIndex.name] || '').trim() : undefined,
            description: colIndex.description >= 0 ? (cols[colIndex.description] || '').trim() : undefined,
            expiresAt: colIndex.expiresat >= 0 ? (cols[colIndex.expiresat] || '').trim() : undefined
        };
        rows.push(row);
    }
    return rows;
}

export const actions: Actions = {
    upload: restrict(
        async (event: any) => {
            const { request, locals, auth } = event;
            try {
                // Read once
                const formData = await request.formData();
                const rawFile = formData.get('file');
                const saveAsDraft = formData.get('saveAsDraft') === 'true' || formData.get('saveAsDraft') === '1';

                // Build synthetic request for validation (preserve boundary)
                const headers = new Headers();
                for (const [key, value] of request.headers) {
                    if (key.toLowerCase() === 'content-type') continue;
                    headers.append(key, value);
                }
                const validateRequest = new Request(request.url, { method: request.method, headers, body: formData });
                const form = await superValidate(validateRequest, zod(preclaimSetSchema), { id: 'preclaim-set-form' });

                if (!form.valid) {
                    return fail(400, { form });
                }

                if (!(rawFile instanceof File)) {
                    return message(form, createErrorResponse('Please upload a CSV file.'), { status: 400 });
                }

                const fileName = rawFile.name?.toLowerCase() || '';
                const isCsv = fileName.endsWith('.csv') || rawFile.type === 'text/csv';
                const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

                let rows: Array<{ macId: string; name?: string; description?: string; expiresAt?: string }>= [];
                if (isCsv) {
                    const text = await rawFile.text();
                    rows = parseCsv(text);
                } else if (isExcel) {
                    return message(form, createErrorResponse('Excel files are not supported yet. Please upload a CSV.'), { status: 400 });
                } else {
                    return message(form, createErrorResponse('Unsupported file type. Please upload CSV.'), { status: 400 });
                }

                if (rows.length === 0) {
                    return message(form, createErrorResponse('No valid rows found in file.'), { status: 400 });
                }

                // Build user context for enhanced prisma (needed before duplicate check)
                const userContext = {
                    id: auth.user.id,
                    systemRole: auth.user.systemRole,
                    accountMemberships: auth.memberships
                };

                const enhancedPrisma = getEnhancedPrisma(userContext, { logPrismaQuery: true });

                // Resolve accountId before duplicate checks
                const { currentAccount } = locals;
                const accountId: string = auth.currentAccount?.account?.id ?? currentAccount?.id ?? currentAccount?.accountId;
                if (!accountId) {
                    return message(form, createErrorResponse('No current account selected. Please select an account first.'), { status: 400 });
                }

                // Check for duplicates across all accounts in database
                const macIds = rows.map(r => r.macId);
                const existingPreclaims = await enhancedPrisma.preclaimDevice.findMany({
                    where: {
                        macId: { in: macIds },
                        status: { in: ['PENDING', 'FULFILLED'] } // Include fulfilled to prevent re-preclaiming
                    },
                    include: {
                        set: {
                            select: { name: true }
                        },
                        account: {
                            select: { name: true }
                        },
                        device: {
                            select: { id: true }
                        }
                    }
                });

                // Group conflicts by MAC and account
                const conflicts: Array<{
                    macId: string;
                    existingAccount: string;
                    existingSet: string;
                    status: string;
                }> = [];

                for (const existing of existingPreclaims) {
                    const conflictingRow = rows.find(r => r.macId === existing.macId);
                    
                    // Skip FULFILLED preclaims where the device no longer exists (allows reclaiming)
                    if (existing.status === 'FULFILLED' && !existing.device) {
                        continue;
                    }
                    
                    if (conflictingRow && existing.accountId !== accountId) {
                        conflicts.push({
                            macId: existing.macId,
                            existingAccount: existing.account?.name || 'Unknown Account',
                            existingSet: existing.set?.name || 'Unknown Set',
                            status: existing.status
                        });
                    } else if (conflictingRow && existing.accountId === accountId) {
                        // Same account - check if it's a different set
                        if (existing.setId !== null) { // We'll set setId after creation
                            conflicts.push({
                                macId: existing.macId,
                                existingAccount: existing.account?.name || 'Same Account',
                                existingSet: existing.set?.name || 'Existing Set',
                                status: existing.status
                            });
                        }
                    }
                }

                if (conflicts.length > 0) {
                    // Log detailed conflicts server-side for audit without leaking cross-tenant info to users
                    logger.warn(`Duplicate preclaim conflicts detected: ${JSON.stringify(conflicts)}`);

                    // Mask MACs for client message (keep first 4 and last 4 chars)
                    const maskMac = (mac: string) => mac.length <= 8 ? '********' : `${mac.slice(0, 4)}****${mac.slice(-4)}`;
                    const masked = Array.from(new Set(conflicts.map((c) => maskMac(c.macId))));

                    const text = masked.length === 1
                        ? `Duplicate MAC detected: ${masked[0]}. Please remove duplicates and try again.`
                        : `Duplicate MACs detected (${masked.length}): ${masked.join(', ')}. Please remove duplicates and try again.`;

                    return message(form, createErrorResponse(text), { status: 400 });
                }

                const expiresAt = form.data.expiresAt ? new Date(`${form.data.expiresAt}T00:00:00`) : null;

                try {
                    const result = await enhancedPrisma.$transaction(async (tx: any) => {
                        const set = await tx.preclaimSet.create({
                            data: {
                                name: form.data.name,
                                description: form.data.description || '',
                                status: saveAsDraft ? 'INACTIVE' : 'ACTIVE', // Draft = INACTIVE, Add = ACTIVE
                                expiresAt: expiresAt,
                                accountId,
                                profileId: form.data.profileId || null, // Optional profile assignment
                                createdBy: auth.user.id
                            }
                        });

                        const devices: any[] = [];
                        for (const r of rows) {
                            const rowExpiresAt = r.expiresAt ? new Date(`${r.expiresAt}T00:00:00`) : null;
                            const device = await tx.preclaimDevice.create({
                                data: {
                                    macId: r.macId,
                                    name: r.name || null,
                                    description: r.description || null,
                                    expiresAt: rowExpiresAt,
                                    setId: set.id,
                                    accountId
                                }
                            });
                            devices.push(device);
                        }
                        return { set, devices };
                    });

                    // Log audit for PreclaimSet creation
                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'PreclaimSet',
                        recordId: result.set.id,
                        oldData: null,
                        newData: result.set,
                        userId: auth.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: enhancedPrisma
                    });

                    // Log audit for each PreclaimDevice creation
                    for (const device of result.devices) {
                        await logAudit({
                            actionType: AuditActionType.INSERT,
                            tableName: 'PreclaimDevice',
                            recordId: device.id,
                            oldData: null,
                            newData: device,
                            userId: auth.user.id,
                            ipAddress: locals.ipAddress,
                            prisma: enhancedPrisma
                        });
                    }

                    // One-time cron job per set: schedule at set's expiresAt (entity-expire will mark devices + set as EXPIRED)
                    if (result.set.expiresAt) {
                        try {
                            await upsertEntityExpirationCronjob(locals.prisma, {
                                entityType: 'preclaimSet',
                                entityId: result.set.id,
                                expiresAt: result.set.expiresAt,
                                action: 'mark',
                                userId: auth.user.id,
                                accountId
                            });
                        } catch (cronErr) {
                            logger.warn(`Failed to create expiration cronjob for preclaim set ${result.set.id}:`, cronErr);
                        }
                    }

                    // Optional: per-device expiration cron jobs when a row has its own expiresAt
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (row.expiresAt && result.devices[i]) {
                            const rowExpiresAt = new Date(`${row.expiresAt}T00:00:00`);
                            try {
                                await upsertEntityExpirationCronjob(locals.prisma, {
                                    entityType: 'preclaimDevice',
                                    entityId: result.devices[i].id,
                                    expiresAt: rowExpiresAt,
                                    action: 'mark',
                                    userId: auth.user.id,
                                    accountId
                                });
                            } catch (cronErr) {
                                logger.warn(`Failed to create expiration cronjob for preclaim device ${result.devices[i].id}:`, cronErr);
                            }
                        }
                    }

                    logger.info(`PreclaimSet created ${result.set.id} with ${rows.length} devices`);
                    return message(
                        form,
                        createSuccessResponse('Preclaim set created successfully', { data: { id: result.set.id } })
                    );
                } catch (err) {
                    return handleFormError({
                        error: err,
                        form,
                        prisma: enhancedPrisma,
                        accountId,
                        defaultMessage: 'Failed to create preclaim set. Please try again.',
                        action: 'preclaim set creation'
                    });
                }
            } catch (e: any) {
                const errInfo = {
                    name: e?.name,
                    message: e?.message,
                    code: e?.code,
                    meta: e?.meta,
                    stack: e?.stack
                };
                logger.error(`Failed to upload preclaims: ${JSON.stringify(errInfo)}`);
                return fail(500, {
                    message: 'An unexpected error occurred while processing the upload.',
                    error: e instanceof Error ? e.message : 'Unknown error'
                });
            }
        },
        [SystemRole.USER]
    )
};
