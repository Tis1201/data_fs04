import type { PageServerLoad } from './$types';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';

function getCurrentAccountId(
    cookies: { get: (name: string) => string | undefined },
    locals: App.Locals
): string | undefined {
    return (
        cookies.get('current_account_id') ||
        (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id
    );
}

export interface DataPageSensor {
    id: string;
    name: string;
}

export const load = restrict(
    async ({ cookies, locals }: AuthenticatedLoadEvent) => {
        const accountId = getCurrentAccountId(cookies, locals);
        const allForAccount = accountId
            ? await prisma.sensor.findMany({
                  where: { accountId },
                  select: { id: true, name: true },
                  orderBy: { name: 'asc' }
              })
            : [];
        const sensors: DataPageSensor[] = allForAccount.slice(0, 10).map((s) => ({ id: s.id, name: s.name }));
        const sensorNameById: Record<string, string> = Object.fromEntries(
            allForAccount.map((s) => [s.id, s.name])
        );
        return { sensors, sensorNameById };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;
