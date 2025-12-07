import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createPinRuleTableOptions } from './pinRuleTableOptions';

/**
 * Load pin rule list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadPinRuleList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
    }
) {
    try {
        // Create table options with optional ownership filtering
        const tableOptions = options?.checkOwnership
            ? createPinRuleTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createPinRuleTableOptions(); // Admin can see admin-level rules

        // Fetch table data with the appropriate options
        const result = await fetchTableData(locals, url, tableOptions);

        return {
            rules: result.records,
            meta: result.meta
        };
    } catch (e) {
        logger.error(`Error loading pin rules: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load pin rules');
    }
}

/**
 * Load pin rule detail data
 * Per structural standard: load{Resource}Detail pattern
 */
export async function loadPinRuleDetail(
    locals: any,
    pinRuleId: string,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
        includeUserInfo?: boolean;
    }
) {
    try {
        let pinRule;
        
        if (options?.checkOwnership && options?.userId && options?.accountId) {
            // User-specific query with ownership check
            // User can edit their own rules or admin_default rules
            pinRule = await locals.prisma.pinRule.findFirst({
                where: {
                    id: pinRuleId,
                    OR: [
                        { ruleType: 'user_default', accountId: options.accountId },
                        { ruleType: 'user_custom', accountId: options.accountId, createdBy: options.userId },
                        { ruleType: 'admin_default' } // Users can view admin_default rules
                    ]
                },
                include: {
                    account: {
                        select: { id: true, name: true, slug: true }
                    },
                    ...(options?.includeUserInfo ? {
                        createdByUser: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    } : {})
                }
            });
        } else {
            // Admin query (admin_default or admin_custom)
            pinRule = await locals.prisma.pinRule.findFirst({
                where: {
                    id: pinRuleId,
                    OR: [
                        { ruleType: 'admin_default' },
                        { ruleType: 'admin_custom' }
                    ]
                },
                include: {
                    account: {
                        select: { id: true, name: true, slug: true }
                    },
                    ...(options?.includeUserInfo ? {
                        createdByUser: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    } : {})
                }
            });
        }

        if (!pinRule) {
            throw error(404, {
                message: 'Pin rule not found',
                code: 'PIN_RULE_NOT_FOUND'
            });
        }

        return {
            pinRule,
            meta: {
                title: `Pin Rule: ${pinRule.name || pinRule.id}`,
                description: `Details for pin rule ${pinRule.name || pinRule.id}`
            }
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // Re-throw SvelteKit errors
        }
        logger.error(`Error loading pin rule ${pinRuleId}: ${JSON.stringify(err)}`);
        throw error(500, 'Failed to load pin rule details');
    }
}

