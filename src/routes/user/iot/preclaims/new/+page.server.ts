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

// PreclaimSet upload schema (file validated in action)
const preclaimSetSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }).max(255),
    description: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(), // yyyy-MM-dd from date picker
});

export const load = restrict(
    async ({ locals }: any) => {
        const form = await superValidate(zod(preclaimSetSchema), {
            id: 'preclaim-set-form',
            dataType: 'json'
        });

        const { currentAccount } = locals;

        return {
            form,
            accountId: currentAccount?.id ?? currentAccount?.accountId ?? null
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

function normalizeMac(mac: string): string {
    return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

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
        const macId = normalizeMac(macRaw);
        if (!macId || macId.length < 6) continue;
        const row = {
            macId,
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

                // Build synthetic request for validation (preserve boundary)
                const headers = new Headers();
                for (const [key, value] of request.headers) {
                    if (key.toLowerCase() === 'content-type') continue;
                    headers.append(key, value);
                }
                const validateRequest = new Request(request.url, { method: request.method, headers, body: formData });
                const form = await superValidate(validateRequest, zod(preclaimSetSchema));

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

                // Deduplicate by macId within upload
                const seen = new Set<string>();
                rows = rows.filter((r) => {
                    if (seen.has(r.macId)) return false;
                    seen.add(r.macId);
                    return true;
                });

                // Build user context for enhanced prisma
                const userContext = {
                    id: auth.user.id,
                    systemRole: auth.user.systemRole,
                    accountMemberships: auth.memberships
                };

                const enhancedPrisma = getEnhancedPrisma(userContext, { logPrismaQuery: true });

                const { currentAccount } = locals;
                const accountId: string = auth.currentAccount?.account?.id ?? currentAccount?.id ?? currentAccount?.accountId;
                if (!accountId) {
                    return message(form, createErrorResponse('No current account selected. Please select an account first.'), { status: 400 });
                }

                const expiresAt = form.data.expiresAt ? new Date(`${form.data.expiresAt}T00:00:00`) : null;

                try {
                    const result = await enhancedPrisma.$transaction(async (tx: any) => {
                        const set = await tx.preclaimSet.create({
                            data: {
                                name: form.data.name,
                                description: form.data.description || '',
                                status: 'ACTIVE',
                                expiresAt: expiresAt,
                                accountId,
                                createdBy: auth.user.id
                            }
                        });

                        for (const r of rows) {
                            const rowExpiresAt = r.expiresAt ? new Date(`${r.expiresAt}T00:00:00`) : null;
                            await tx.preclaimDevice.create({
                                data: {
                                    macId: r.macId,
                                    name: r.name || null,
                                    description: r.description || null,
                                    expiresAt: rowExpiresAt,
                                    setId: set.id,
                                    accountId
                                }
                            });
                        }
                        return set;
                    });

                    logger.info(`PreclaimSet created ${result.id} with ${rows.length} devices`);
                    return message(
                        form,
                        createSuccessResponse('Preclaim set created successfully', { data: { setId: result.id } }),
                        { status: 200 }
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
                logger.error(`Failed to upload preclaims: ${JSON.stringify(e)}`);
                return fail(500, {
                    message: 'An unexpected error occurred while processing the upload.',
                    error: e instanceof Error ? e.message : 'Unknown error'
                });
            }
        },
        [SystemRole.USER]
    )
};
