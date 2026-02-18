import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma, { getEnhancedPrisma } from '$lib/server/prisma';
import { loadPreclaimDetail } from '$lib/server/preclaims/preclaimLoader';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/** Parse CSV with header: macId/mac, optional name, description, expiresAt */
function parsePreclaimCsv(content: string): Array<{ macId: string; name?: string; description?: string; expiresAt?: string }> {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const colIndex = {
        macid: header.indexOf('macid') >= 0 ? header.indexOf('macid') : header.indexOf('mac'),
        name: header.indexOf('name'),
        description: header.indexOf('description'),
        expiresat: header.indexOf('expiresat')
    } as const;
    if (colIndex.macid < 0) throw new Error('CSV must include a macId or mac column.');
    const rows: Array<{ macId: string; name?: string; description?: string; expiresAt?: string }> = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length === 0) continue;
        const macRaw = (cols[colIndex.macid] || '').trim();
        if (!macRaw || macRaw.length < 6) continue;
        rows.push({
            macId: macRaw,
            name: colIndex.name >= 0 ? (cols[colIndex.name] || '').trim() || undefined : undefined,
            description: colIndex.description >= 0 ? (cols[colIndex.description] || '').trim() || undefined : undefined,
            expiresAt: colIndex.expiresat >= 0 ? (cols[colIndex.expiresat] || '').trim() || undefined : undefined
        });
    }
    return rows;
}

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:preclaim');
        
        const { id } = params;
        if (!id) {
            throw error(400, 'Preclaim set ID is required');
        }

        try {
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');

            const detailResult = await loadPreclaimDetail(
                locals,
                id,
                {
                    checkOwnership: true,
                    userId,
                    accountId,
                    useEnhancedPrisma: true
                }
            );

            const currentAccountId = (locals as any).currentAccount?.account?.id ?? accountId;
            const profiles = currentAccountId
                ? await locals.prisma.deviceProfile.findMany({
                      where: {
                          isActive: true,
                          level: 'GLOBAL',
                          accountId: currentAccountId
                      },
                      select: { id: true, name: true },
                      orderBy: { name: 'asc' }
                  })
                : [];
            const profileOptions = profiles.map((p: { id: string; name: string }) => ({
                id: p.id,
                label: p.name
            }));

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            const accountOptions = accounts.map((a: { id: string; name: string }) => ({
                id: a.id,
                label: a.name
            }));

            return {
                ...detailResult,
                profileOptions,
                accountOptions
            };
        } catch (err) {
            logger.error(`Error loading preclaim set ${id}: ${err instanceof Error ? err.message : String(err)}`);
            if (err && typeof err === 'object' && 'status' in err) {
                throw err; // Re-throw SvelteKit errors
            }
            throw error(500, 'Failed to load pre-claim set details');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    importDevices: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals, auth } = event;
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized.' });
            }
            const authUser = auth!;
            const setId = params?.id ?? (typeof event.url?.pathname === 'string' ? event.url.pathname.split('/').filter(Boolean).pop()?.split('?')[0] : undefined);
            if (!setId) {
                return fail(400, { message: 'Preclaim set ID is required.' });
            }
            try {
                const formData = await request.formData();
                const rawFile = formData.get('file');
                if (!(rawFile instanceof File)) {
                    return fail(400, { message: 'Please upload a CSV file.' });
                }
                const fileName = (rawFile.name || '').toLowerCase();
                const isCsv = fileName.endsWith('.csv') || rawFile.type === 'text/csv';
                if (!isCsv) {
                    return fail(400, { message: 'Unsupported file type. Please upload a CSV file.' });
                }
                let rows: Array<{ macId: string; name?: string; description?: string; expiresAt?: string }>;
                try {
                    const text = await rawFile.text();
                    rows = parsePreclaimCsv(text);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Invalid CSV format.';
                    return fail(400, { message: msg });
                }
                if (rows.length === 0) {
                    return fail(400, { message: 'No valid rows found in file. CSV must have a macId or mac column.' });
                }
                const prismaClient = locals.prisma;
                const set = await prismaClient.preclaimSet.findFirst({
                    where: { id: setId },
                    select: { id: true, accountId: true }
                });
                if (!set) {
                    return fail(404, { message: 'Pre-claim set not found.' });
                }
                const accountId = set.accountId;
                const userContext = {
                    id: authUser.user.id,
                    systemRole: authUser.user.systemRole,
                    accountMemberships: authUser.memberships ?? []
                };
                const enhancedPrisma = getEnhancedPrisma(userContext, { logPrismaQuery: false });
                const macIds = [...new Set(rows.map((r) => r.macId))];
                const existingPreclaims = await enhancedPrisma.preclaimDevice.findMany({
                    where: {
                        macId: { in: macIds },
                        status: { in: ['PENDING', 'FULFILLED'] }
                    },
                    include: {
                        set: { select: { id: true, name: true } },
                        account: { select: { name: true } },
                        device: { select: { id: true } }
                    }
                });
                const alreadyInThisSet = new Set(
                    existingPreclaims.filter((p) => p.setId === setId).map((p) => p.macId)
                );
                const conflicts = existingPreclaims.filter(
                    (p) => p.setId !== setId && !(p.status === 'FULFILLED' && !p.device)
                );
                if (conflicts.length > 0) {
                    const macList = [...new Set(conflicts.map((c) => c.macId))].slice(0, 5).join(', ');
                    const more = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : '';
                    return fail(400, {
                        message: `Some MAC addresses are already in another pre-claim set: ${macList}${more}. Please remove them from the CSV.`
                    });
                }
                // Dedupe by macId (keep first) to avoid unique constraint (setId, macId)
                const seenMac = new Set<string>();
                const toInsert = rows.filter((r) => {
                    if (alreadyInThisSet.has(r.macId) || seenMac.has(r.macId)) return false;
                    seenMac.add(r.macId);
                    return true;
                });
                if (toInsert.length === 0) {
                    return fail(400, { message: 'All rows are already in this set. No new devices to import.' });
                }
                const created = await enhancedPrisma.$transaction(async (tx: any) => {
                    const devices: any[] = [];
                    for (const r of toInsert) {
                        const rowExpiresAt = r.expiresAt ? new Date(`${r.expiresAt}T00:00:00`) : null;
                        const device = await tx.preclaimDevice.create({
                            data: {
                                macId: r.macId,
                                name: r.name || null,
                                description: r.description || null,
                                expiresAt: rowExpiresAt,
                                setId,
                                accountId
                            }
                        });
                        devices.push(device);
                    }
                    return devices;
                });
                for (const device of created) {
                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'PreclaimDevice',
                        recordId: device.id,
                        oldData: null,
                        newData: device,
                        userId: authUser.user.id,
                        ipAddress: (locals as any).ipAddress,
                        prisma
                    });
                }
                logger.info(`Preclaim set ${setId}: imported ${created.length} devices`);
                return { success: true, data: { imported: created.length } };
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                logger.error(`Import CSV preclaim ${setId}: ${err.message}`, { stack: err.stack });
                return fail(500, { message: err.message || 'Failed to import devices. Please try again.' });
            }
        },
        [SystemRole.USER]
    )
};
