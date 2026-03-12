import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/** GET: export preclaim set device list as CSV (for Edit modal download link) */
export const GET = restrict(
    async ({ params, locals, cookies }: { params: { id: string }; locals: any; cookies: any }) => {
        const id = params.id;
        if (!id) throw error(400, 'Preclaim set ID is required');

        // Get current account ID
        const currentAccountId =
            locals.currentAccount?.account?.id ?? cookies.get('current_account_id');
        
        if (!currentAccountId) {
            throw error(403, 'No account selected');
        }

        // Verify preclaim set belongs to current account
        const set = await locals.prisma.preclaimSet.findFirst({
            where: { id, accountId: currentAccountId },
            include: { claims: true }
        });
        if (!set) throw error(404, 'Pre-claim set not found');

        const rows = (set.claims ?? []).map((c: { macId: string; name?: string | null; description?: string | null; expiresAt?: Date | string | null }) => [
            c.macId ?? '',
            c.name ?? '',
            c.description ?? '',
            c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : ''
        ]);
        const header = ['macId', 'name', 'description', 'expiresAt(yyyy-mm-dd)'];
        const csv = [header.join(','), ...rows.map((r: string[]) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="devicelist-${(set.name || id).replace(/\s+/g, '-').slice(0, 30)}.csv"`
            }
        });
    },
    [SystemRole.USER]
) satisfies RequestHandler;
