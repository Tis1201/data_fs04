
import type { PageServerLoad } from './$types';
import { logService } from '$lib/server/clickhouse/logService';
import { error } from '@sveltejs/kit';

/**
 * Transform DeviceActionLog to LogEntry format for System Logs table (TC-IOT-DB-0020).
 * Fallback when ClickHouse is unavailable or returns no data.
 */
function actionLogToLogEntry(log: {
    id: string;
    actionType: string;
    status: string;
    message: string | null;
    initiatedAt: Date;
    device: { id: string; accountId: string | null } | null;
}) {
    const level = ['failed', 'timeout', 'cancelled'].includes(log.status) ? 'ERROR' : log.status === 'success' ? 'INFO' : 'WARN';
    const desc = log.message || `${log.actionType} ${log.status}`;
    return {
        timestamp: log.initiatedAt,
        level,
        message: desc,
        device_id: log.device?.id ?? 'N/A',
        account_id: log.device?.accountId ?? 'N/A',
        user_id: '',
        metadata: {}
    };
}

export const load: PageServerLoad = async ({ url, locals, depends, cookies }) => {
    const session = await locals.auth.validate();
    if (!session) {
        throw error(401, 'Unauthorized');
    }

    const user = await locals.prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, primaryAccountId: true }
    });
    if (!user) throw error(401, 'Unauthorized');

    depends('data:logs');

    const page = Number(url.searchParams.get('page')) || 1;
    const per_page = Number(url.searchParams.get('per_page')) || 50;
    const search = url.searchParams.get('search') || undefined;
    const level = url.searchParams.get('level') || undefined;
    const sortBy = url.searchParams.get('sort') || 'timestamp';
    const sortOrder = (url.searchParams.get('order') as 'asc' | 'desc') || 'desc';

    const currentAccountId =
        (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
        cookies.get('current_account_id') ??
        user.primaryAccountId;
    const deviceFilter = currentAccountId
        ? { accountId: currentAccountId }
        : { createdBy: user.id };

    try {
        const { logs, total } = await logService.getLogs({
            page,
            limit: per_page,
            search,
            level,
            sortBy,
            sortOrder,
            accountId: currentAccountId ?? undefined
        });

        if (logs.length > 0 || total > 0) {
            return {
                props: {
                    records: logs,
                    pagination: {
                        page,
                        per_page,
                        total_records: total,
                        total_pages: Math.ceil(total / per_page)
                    },
                    sort: { field: sortBy, order: sortOrder },
                    loading: false
                }
            };
        }
    } catch (err) {
        console.warn('ClickHouse logs unavailable, using DeviceActionLog fallback:', err);
    }

    // Fallback: DeviceActionLog from Prisma when ClickHouse fails or returns no data (TC-IOT-DB-0020)
    const skip = (page - 1) * per_page;
    const orderBy = sortBy === 'timestamp' ? { initiatedAt: sortOrder as 'asc' | 'desc' } : { initiatedAt: 'desc' };
    const searchFilter = search
        ? {
              OR: [
                  { message: { contains: search, mode: 'insensitive' as const } },
                  { actionType: { contains: search, mode: 'insensitive' as const } }
              ]
          }
        : {};
    const levelFilter =
        level === 'ERROR'
            ? { status: { in: ['failed', 'timeout', 'cancelled'] } }
            : level === 'WARN'
              ? { status: { in: ['initiated', 'in_progress'] } }
              : level === 'INFO'
                ? { status: 'success' }
                : {};

    const [actions, totalCount] = await Promise.all([
        locals.prisma.deviceActionLog.findMany({
            where: {
                device: deviceFilter,
                ...searchFilter,
                ...levelFilter
            },
            orderBy,
            skip,
            take: per_page,
            select: {
                id: true,
                actionType: true,
                status: true,
                message: true,
                initiatedAt: true,
                device: { select: { id: true, accountId: true } }
            }
        }),
        locals.prisma.deviceActionLog.count({
            where: {
                device: deviceFilter,
                ...searchFilter,
                ...levelFilter
            }
        })
    ]);

    const records = actions.map(actionLogToLogEntry);
    return {
        props: {
            records,
            pagination: {
                page,
                per_page,
                total_records: totalCount,
                total_pages: Math.ceil(totalCount / per_page)
            },
            sort: { field: sortBy, order: sortOrder },
            loading: false
        }
    };
};
