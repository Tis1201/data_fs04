import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createPreclaimTableOptions } from './preclaimTableOptions';

/**
 * Load preclaim list data
 * Per structural standard: load{Resource}List pattern
 * 
 * Supports both standard Prisma (admin) and enhanced Prisma (user routes with ZenStack)
 */
export async function loadPreclaimList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
        useEnhancedPrisma?: boolean; // Use enhanced Prisma for user routes
    }
) {
    try {
        // For user routes, locals.prisma is already enhanced by middleware
        // For admin routes, use standard Prisma
        const prismaClient = locals.prisma;

        // Create table options with optional ownership filtering
        const tableOptions = options?.checkOwnership
            ? createPreclaimTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createPreclaimTableOptions(); // Admin can see all preclaims

        // Fetch table data with the appropriate options
        // fetchTableData will use locals.prisma which is already enhanced for user routes
        const result = await fetchTableData(locals, url, tableOptions);
        
        return {
            preclaimSets: result.records,
            meta: result.meta
        };
    } catch (e) {
        logger.error(`Error loading preclaims: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load preclaims');
    }
}

/**
 * Load preclaim detail data
 * Per structural standard: load{Resource}Detail pattern
 * 
 * Supports both standard Prisma (admin) and enhanced Prisma (user routes with ZenStack)
 */
export async function loadPreclaimDetail(
    locals: any,
    preclaimId: string,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
        useEnhancedPrisma?: boolean; // Use enhanced Prisma for user routes
    }
) {
    try {
        // For user routes, locals.prisma is already enhanced by middleware
        // For admin routes, use standard Prisma
        const prismaClient = locals.prisma;

        // Build where clause
        const where: any = { id: preclaimId };

        // For user routes, enhanced Prisma will handle authorization automatically
        // For admin routes, no ownership check needed
        // We can still add explicit filtering if needed, but enhanced Prisma handles it

        // Fetch the preclaim set
        const preclaimSet = await prismaClient.preclaimSet.findFirst({
            where,
            include: {
                claims: true,
                account: {
                    select: { id: true, name: true }
                },
                profile: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        isActive: true
                    }
                }
            }
        });

        if (!preclaimSet) {
            throw error(404, 'Pre-claim set not found');
        }

        // Attach creator user (model stores only createdBy string)
        const creator = preclaimSet?.createdBy
            ? await prismaClient.user.findUnique({
                where: { id: preclaimSet.createdBy },
                select: { id: true, name: true, email: true }
            })
            : null;

        // Add fallback display name for creator
        const creatorDisplayName = creator?.name || creator?.email || 'Unknown';
        const preclaimSetOut = {
            ...preclaimSet,
            user: creator ? { ...creator, displayName: creatorDisplayName } : null
        };

        const claims = preclaimSet.claims ?? [];
        // Compute metrics with safe fallbacks
        const total = claims.length;
        const claimed = claims.filter((c: any) => {
            const status = (c?.status ?? '').toString().toUpperCase();
            return !!c?.claimedAt || status === 'CLAIMED' || status === 'USED' || status === 'ASSIGNED';
        }).length;
        const left = Math.max(0, total - claimed);

        return {
            preclaimSet: preclaimSetOut,
            claims,
            metrics: {
                total,
                claimed,
                left
            },
            meta: {
                title: `Pre-claim Set: ${preclaimSet.name || preclaimSet.id}`,
                description: `View details for pre-claim set ${preclaimSet.name || preclaimSet.id}`
            }
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // Re-throw SvelteKit errors
        }
        logger.error(`Error loading preclaim ${preclaimId}: ${err}`);
        throw error(500, 'Failed to load pre-claim set details');
    }
}

