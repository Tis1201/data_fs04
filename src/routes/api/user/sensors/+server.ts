/**
 * GET /api/user/sensors
 * List sensors for the current account. Used by radar analytics filter (first 10, then search).
 * Query: limit (default 10), search (optional, filter by name/id).
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { AuthenticatedEvent } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';

function getAccountId(event: AuthenticatedEvent): string | undefined {
    const auth = event.auth;
    const user = auth?.user as { primaryAccountId?: string } | undefined;
    // Prefer current account (switch-account aware), then auth, then primary
    return (
        (event.locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
        event.cookies?.get?.('current_account_id') ??
        auth?.currentAccount?.account?.id ??
        (auth?.currentAccount as { accountId?: string } | undefined)?.accountId ??
        user?.primaryAccountId
    );
}

export const GET: RequestHandler = restrict(async (event: AuthenticatedEvent) => {
    const { url } = event;
    const accountId = getAccountId(event);
    if (!accountId) {
        return json({ error: 'Account ID required.' }, { status: 400 });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);
    const search = (url.searchParams.get('search') || '').trim();

    type WhereOr = { name: { contains: string; mode: 'insensitive' } } | { id: { contains: string; mode: 'insensitive' } };
    const where: { accountId: string; OR?: WhereOr[] } = { accountId };
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } }
        ];
    }

    const list = await prisma.sensor.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: limit
    });

    return json({ data: list });
}, [SystemRole.USER, SystemRole.ADMIN]);
